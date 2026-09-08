import { Router } from 'express'; import multer from 'multer'; import { z } from 'zod';
import { uploadForumImage } from '../services/cloudflareImages.js';
import { Comment, Discussion, Level, Notification, Subject, User } from '../models/index.js';
import { authenticate, allow } from '../middleware/auth.js';
import { parse, objectId } from '../utils/validation.js';
const router = Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024, files: 6 },
	fileFilter: (req, file, callback) => {
		if (file.mimetype.startsWith('image/')) return callback(null, true);
		const error = new Error('Seules les images sont acceptées.');
		error.status = 422;
		return callback(error);
	},
});

const communityRoles = ['student', 'local_doctor', 'contract_doctor'];
const isCertifiedDoctor = (user) => ['local_doctor', 'contract_doctor'].includes(user.role) && user.certified;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function orderedLevels() {
	return Level.find().select('_id name code order createdAt').sort('order createdAt name');
}

async function accessibleLevelIds(user) {
	if (!user.level) return null;
	const levels = await orderedLevels();
	const index = levels.findIndex((level) => level.id === user.level.toString());
	return index < 0 ? [user.level] : levels.slice(0, index + 1).map((level) => level._id);
}

function assignmentFor(subject, levelId) {
	const assignment = subject.assignments?.find((item) => item.level.toString() === levelId.toString());
	if (assignment) return assignment;
	return subject.doctors?.length ? { doctors: subject.doctors } : null;
}

async function subjectsForUser(user) {
	const subjects = await Subject.find().populate('assignments.level', 'name code').sort('name');
	if (user.role === 'student') {
		if (!user.level) return [];
		return subjects.filter((subject) => !subject.assignments?.length || assignmentFor(subject, user.level));
	}
	if (['local_doctor', 'contract_doctor'].includes(user.role)) {
		return subjects.filter((subject) => subject.assignments?.some((item) => item.doctors.some((doctor) => doctor.toString() === user.id)) || subject.doctors?.some((doctor) => doctor.toString() === user.id));
	}
	return subjects;
}

async function canAccessDiscussion(user, post) {
	if (user.role === 'student') {
		const levels = await accessibleLevelIds(user);
		const postLevel = post.level || post.author?.level;
		return Boolean(postLevel && levels?.some((level) => level.toString() === postLevel.toString()));
	}
	if (['local_doctor', 'contract_doctor'].includes(user.role)) {
		const subject = post.subject;
		const postLevel = post.level || post.author?.level;
		return Boolean(subject && postLevel && assignmentFor(subject, postLevel)?.doctors.some((doctor) => doctor.toString() === user.id));
	}
	return false;
}

async function uploadImages(files = []) {
	return Promise.all(files.map((file) => uploadForumImage(file)));
}

router.use(authenticate);

router.get('/catalog', allow(...communityRoles), async (req, res) => {
	const levels = req.user.role === 'student' ? await accessibleLevelIds(req.user) : null;
	const subjects = await subjectsForUser(req.user);
	res.json({
		levels: (await orderedLevels()).filter((level) => !levels || levels.some((id) => id.toString() === level.id)),
		subjects,
		currentLevel: req.user.level,
	});
});

router.get('/', allow(...communityRoles), async (req, res) => {
	const subjects = await subjectsForUser(req.user);
	const subjectIds = subjects.map((subject) => subject._id);
	const levels = await accessibleLevelIds(req.user);
	const filter = { subject: { $in: subjectIds } };
	if (req.user.role === 'student') filter.level = { $in: levels || [] };
	if (req.query.subject) filter.subject = { $in: subjectIds.filter((id) => id.toString() === req.query.subject) };
	if (req.query.level && (!levels || levels.some((id) => id.toString() === req.query.level))) filter.level = req.query.level;
	if (req.query.search?.trim()) {
		const search = new RegExp(escapeRegex(req.query.search.trim()), 'i');
		filter.$or = [{ title: search }, { text: search }];
	}
	const discussions = await Discussion.find(filter).populate('level', 'name code').populate('subject', 'name code doctors assignments').populate('author', 'firstName lastName role level certified').sort(req.query.sort === 'oldest' ? 'createdAt' : '-createdAt').limit(Math.min(Number(req.query.limit) || 40, 80));
	const ids = discussions.map((post) => post._id);
	const comments = await Comment.find({ discussion: { $in: ids } }).populate('author', 'firstName lastName role level certified').sort('createdAt');
	const acceptedIds = new Set(comments.filter((comment) => comment.accepted).map((comment) => comment.discussion.toString()));
	const countByPost = comments.reduce((counts, comment) => counts.set(comment.discussion.toString(), (counts.get(comment.discussion.toString()) || 0) + 1), new Map());
	const result = discussions.map((post) => ({ ...post.toObject(), comments: comments.filter((comment) => comment.discussion.toString() === post.id), commentCount: countByPost.get(post.id) || 0, hasAcceptedAnswer: acceptedIds.has(post.id) }));
	const filtered = req.query.status === 'unanswered' ? result.filter((post) => !post.commentCount) : req.query.status === 'answered' ? result.filter((post) => post.commentCount > 0) : req.query.status === 'validated' ? result.filter((post) => post.hasAcceptedAnswer) : result;
	res.json(filtered);
});

router.post('/', allow('student'), upload.array('images', 6), async (req, res) => {
	const data = parse(z.object({ subject: objectId, title: z.string().trim().min(4).max(140), text: z.string().trim().min(8).max(5000) }), req.body);
	if (!req.user.level) return res.status(422).json({ message: 'Votre compte n’est associé à aucun niveau.' });
	const subject = await Subject.findById(data.subject);
	const assignment = subject && assignmentFor(subject, req.user.level);
	if (!assignment) return res.status(422).json({ message: 'Cette matière n’est pas disponible pour votre niveau.' });
	const images = await uploadImages(req.files);
	const doctors = await User.find({ _id: { $in: assignment.doctors || [] }, role: { $in: ['local_doctor', 'contract_doctor'] }, active: true }).select('_id');
	const notifiedDoctors = doctors.map((doctor) => doctor.id);
	const post = await Discussion.create({ ...data, level: req.user.level, author: req.user.id, images, notifiedDoctors });
	if (notifiedDoctors.length) await Notification.insertMany(notifiedDoctors.map((recipient) => ({ recipient, type: 'new_discussion', message: `Nouvelle question en ${subject.name}`, link: `/community/${post.id}` })));
	res.status(201).json(post);
});

router.get('/:discussionId/image', allow(...communityRoles), async (req, res) => {
	const post = await Discussion.findById(req.params.discussionId).select('+image.data').populate('subject', 'doctors assignments').populate('level', 'name').populate('author', 'level');
	if (!post?.image?.data || !await canAccessDiscussion(req.user, post)) return res.status(404).json({ message: 'Image introuvable.' });
	res.set({ 'Content-Type': post.image.mime, 'Content-Disposition': `inline; filename="${post.image.name}"` });
	res.send(post.image.data);
});

router.post('/:discussionId/comments', allow(...communityRoles), upload.array('images', 6), async (req, res) => {
	const data = parse(z.object({ text: z.string().trim().min(1).max(3000), parent: objectId.nullable().optional() }), req.body);
	const post = await Discussion.findById(req.params.discussionId).populate('subject', 'doctors assignments').populate('level', 'name');
	if (!post || !await canAccessDiscussion(req.user, post)) return res.status(403).json({ message: 'Cette question n’est pas accessible depuis votre espace.' });
	if (data.parent && !await Comment.exists({ _id: data.parent, discussion: post.id })) return res.status(422).json({ message: 'Commentaire parent invalide.' });
	const comment = await Comment.create({ ...data, discussion: post.id, author: req.user.id, certified: isCertifiedDoctor(req.user), images: await uploadImages(req.files) });
	res.status(201).json(comment);
});

router.post('/:discussionId/comments/:commentId/accept', allow('local_doctor', 'contract_doctor'), async (req, res) => {
	if (!isCertifiedDoctor(req.user)) return res.status(403).json({ message: 'Seul un docteur certifié peut valider une réponse.' });
	const post = await Discussion.findById(req.params.discussionId).populate('subject', 'doctors assignments').populate('level', 'name');
	if (!post || !await canAccessDiscussion(req.user, post)) return res.status(403).json({ message: 'Vous ne pouvez valider que les réponses de vos matières.' });
	const comment = await Comment.findOne({ _id: req.params.commentId, discussion: post.id });
	if (!comment) return res.status(404).json({ message: 'Commentaire introuvable.' });
	await Comment.updateMany({ discussion: post.id }, { accepted: false, $unset: { acceptedBy: 1, acceptedAt: 1 } });
	comment.accepted = true;
	comment.acceptedBy = req.user.id;
	comment.acceptedAt = new Date();
	await comment.save();
	await Notification.create({ recipient: post.author, type: 'answer_accepted', message: 'Une réponse certifiée a été validée pour votre question.', link: `/community/${post.id}` });
	res.json(comment);
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { Level, Schedule, Session, Subject, User } from '../models/index.js';
import { authenticate, allow } from '../middleware/auth.js';
import { parse, objectId } from '../utils/validation.js';
import { findSessionConflicts, conflictPayload } from '../services/conflicts.js';

const router = Router();
router.use(authenticate);

const sessionData = z.object({
  subject: objectId.optional(),
  subjectName: z.string().min(2),
  doctor: objectId,
  room: objectId,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  type: z.enum(['course', 'tutorial', 'lab', 'exam', 'quiz', 'other']).default('course'),
  recurrenceDates: z.array(z.coerce.date()).max(30).optional(),
});

const canEdit = (schedule, user) => {
  if (schedule.status === 'published') return false;
  if (user.role === 'principal_admin') return true;
  return user.role === 'level_admin'
    && ['draft', 'returned'].includes(schedule.status)
    && schedule.level.toString() === user.level?.toString();
};
const weekStart = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
};
const isPastWeek = (value) => weekStart(value) < weekStart(new Date());
const hasSessions = async (schedule) => Session.exists({ schedule: schedule.id });
const assertEditableWeek = async (schedule, startsAt) => {
  if (isPastWeek(startsAt)) {
    const error = new Error('Cette semaine est passée : consultation uniquement.');
    error.status = 409;
    throw error;
  }
  if (await hasSessions(schedule) && !await Session.exists({ schedule: schedule.id, endsAt: { $gte: new Date() } })) {
    const error = new Error('Cet emploi du temps appartient à une période passée et ne peut plus être modifié.');
    error.status = 409;
    throw error;
  }
};
const load = (id) => Schedule.findById(id).populate('level', 'name code').populate('createdBy', 'firstName lastName role');
const details = async (schedule, requestedWeekStart) => ({
  schedule,
  sessions: await Session.find({ schedule: schedule.id, ...(requestedWeekStart ? { startsAt: { $gte: requestedWeekStart, $lt: new Date(requestedWeekStart.getTime() + 7 * 86400000) } } : {}) }).populate('doctor', 'firstName lastName').populate('room', 'name').populate('subject', 'name code').sort('startsAt'),
});

const validateSessionLinks = async (data) => {
  const doctor = await User.findOne({ _id: data.doctor, active: true, role: { $in: ['local_doctor', 'contract_doctor'] } });
  if (!doctor) {
    const error = new Error('L’enseignant sélectionné est introuvable ou inactif.');
    error.status = 422;
    throw error;
  }
  if (!data.subject) return;
  const subject = await Subject.findById(data.subject);
  if (!subject) {
    const error = new Error('La matière sélectionnée est introuvable.');
    error.status = 422;
    throw error;
  }
  if (!subject.doctors.some((doctorId) => doctorId.toString() === doctor.id)) {
    const error = new Error('Cet enseignant n’est pas référencé pour la matière sélectionnée. Utilisez la saisie directe si l’association n’est pas encore enregistrée.');
    error.status = 422;
    throw error;
  }
};

const invalidateManualCheck = (schedule) => {
  schedule.externalCheck = { checked: false };
  if (schedule.status === 'validated') schedule.status = 'submitted';
};

const allScheduleConflicts = async (schedule) => {
  const sessions = await Session.find({ schedule: schedule.id });
  const conflicts = [];
  for (const session of sessions) {
    const found = await findSessionConflicts({ room: session.room, doctor: session.doctor, level: session.level, startsAt: session.startsAt, endsAt: session.endsAt, excludeSessionId: session.id });
    conflicts.push(...conflictPayload(found, session));
  }
  return conflicts;
};

router.get('/', allow('principal_admin', 'level_admin'), async (req, res) => {
  const where = req.user.role === 'level_admin' ? { level: req.user.level } : {};
  const schedules = await Schedule.find(where).populate('level', 'name code').populate('createdBy', 'firstName lastName').sort('-updatedAt');
  res.json(schedules);
});

router.post('/', allow('principal_admin', 'level_admin'), async (req, res) => {
  const { level, publicationIntent } = parse(z.object({ level: objectId, publicationIntent: z.enum(['draft', 'publish']).default('draft') }), req.body);
  const levelExists = await Level.exists({ _id: level });
  if (!levelExists) return res.status(422).json({ message: 'Le niveau sélectionné est introuvable.' });
  if (req.user.role === 'level_admin' && req.user.level?.toString() !== level) return res.status(403).json({ message: 'Vous ne pouvez créer que l’emploi du temps de votre niveau.' });
  if (publicationIntent === 'publish' && req.user.role !== 'principal_admin') return res.status(403).json({ message: 'Seul le secrétaire principal peut demander une publication directe.' });
  const schedule = await Schedule.create({ level, publicationIntent, createdBy: req.user.id });
  res.status(201).json(await load(schedule.id));
});

router.get('/:scheduleId', allow('principal_admin', 'level_admin'), async (req, res) => {
  const schedule = await load(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  if (req.user.role === 'level_admin' && schedule.level.id !== req.user.level?.toString()) return res.status(403).json({ message: 'Accès non autorisé.' });
  const requestedWeek = req.query.weekStart ? new Date(req.query.weekStart) : null;
  if (requestedWeek && Number.isNaN(requestedWeek.getTime())) return res.status(422).json({ message: 'Semaine invalide.' });
  res.json(await details(schedule, requestedWeek));
});

router.get('/:scheduleId/conflicts', allow('principal_admin', 'level_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  if (req.user.role === 'level_admin' && schedule.level.toString() !== req.user.level?.toString()) return res.status(403).json({ message: 'Accès non autorisé.' });
  res.json({ conflicts: await allScheduleConflicts(schedule) });
});

router.post('/:scheduleId/sessions', allow('principal_admin', 'level_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  if (!canEdit(schedule, req.user)) return res.status(409).json({ message: schedule.status === 'published' ? 'Un emploi du temps publié ne peut plus être modifié.' : 'Cette proposition doit être renvoyée par le secrétariat avant modification.' });

  const data = parse(sessionData, req.body);
  if (data.endsAt <= data.startsAt) return res.status(422).json({ message: 'L’heure de fin doit être postérieure à l’heure de début.' });
  await assertEditableWeek(schedule, data.startsAt);
  await validateSessionLinks(data);

  const dates = data.recurrenceDates?.length ? data.recurrenceDates : [data.startsAt];
  const created = [];
  const conflicts = [];

  for (const start of dates) {
    const duration = data.endsAt.getTime() - data.startsAt.getTime();
    const end = new Date(start.getTime() + duration);
    const found = await findSessionConflicts({ room: data.room, doctor: data.doctor, level: schedule.level, startsAt: start, endsAt: end });
    if (found.length) conflicts.push(...conflictPayload(found, { ...data, level: schedule.level, startsAt: start, endsAt: end }));
    created.push(await Session.create({ ...data, startsAt: start, endsAt: end, level: schedule.level, schedule: schedule.id, recurrenceGroup: dates.length > 1 ? crypto.randomUUID() : undefined }));
  }

  invalidateManualCheck(schedule);
  await schedule.save();
  res.status(201).json({ session: created[0], sessions: created, conflicts });
});

router.patch('/:scheduleId/sessions/:sessionId', allow('principal_admin', 'level_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule || !canEdit(schedule, req.user)) return res.status(403).json({ message: 'Accès non autorisé.' });

  const current = await Session.findOne({ _id: req.params.sessionId, schedule: schedule.id });
  if (!current) return res.status(404).json({ message: 'Créneau introuvable.' });

  const data = parse(sessionData.partial(), req.body);
  const next = { ...current.toObject(), ...data };
  if (next.endsAt <= next.startsAt) return res.status(422).json({ message: 'L’heure de fin doit être postérieure à l’heure de début.' });
  await validateSessionLinks(next);

  const found = await findSessionConflicts({
    room: next.room,
    doctor: next.doctor,
    level: schedule.level,
    startsAt: next.startsAt,
    endsAt: next.endsAt,
    excludeSessionId: current.id,
  });
  await assertEditableWeek(schedule, next.startsAt);

  Object.assign(current, data);
  current.level = schedule.level;
  await current.save();
  invalidateManualCheck(schedule);
  await schedule.save();
  res.json({ session: current, conflicts: conflictPayload(found, { ...next, level: schedule.level }) });
});

router.delete('/:scheduleId/sessions/:sessionId', allow('principal_admin', 'level_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule || !canEdit(schedule, req.user)) return res.status(403).json({ message: 'Accès non autorisé.' });
  const session = await Session.findOne({ _id: req.params.sessionId, schedule: schedule.id });
  if (!session) return res.status(404).json({ message: 'Créneau introuvable.' });
  await assertEditableWeek(schedule, session.startsAt);
  await session.deleteOne();
  invalidateManualCheck(schedule);
  await schedule.save();
  res.status(204).end();
});

router.post('/:scheduleId/submit', allow('level_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule || schedule.level.toString() !== req.user.level?.toString()) return res.status(403).json({ message: 'Accès non autorisé.' });
  if (!['draft', 'returned'].includes(schedule.status)) return res.status(409).json({ message: 'Seule une proposition en brouillon ou renvoyée peut être soumise.' });
  if (!await Session.exists({ schedule: schedule.id })) return res.status(422).json({ message: 'Ajoutez au moins un créneau avant soumission.' });
  schedule.status = 'submitted';
  schedule.submittedAt = new Date();
  await schedule.save();
  res.json(schedule);
});

router.post('/:scheduleId/publish', allow('principal_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId).populate('createdBy', 'role');
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  const isPrincipalDraft = schedule.status === 'draft' && schedule.createdBy?.role === 'principal_admin';
  if (!isPrincipalDraft && schedule.status !== 'validated') return res.status(409).json({ message: 'Validez d’abord cette proposition avant de la publier.' });
  if (!await Session.exists({ schedule: schedule.id })) return res.status(422).json({ message: 'Ajoutez au moins un créneau avant publication.' });
  const conflicts = await allScheduleConflicts(schedule);
  if (conflicts.length) return res.status(409).json({ message: 'Publication bloquée : des conflits internes doivent être résolus.', conflicts });
  if (!isPrincipalDraft && !schedule.externalCheck?.checked) return res.status(422).json({ message: 'La vérification externe manuelle doit être confirmée avant publication.' });
  schedule.status = 'published';
  schedule.publishedAt = new Date();
  await schedule.save();
  res.json(schedule);
});

router.post('/:scheduleId/external-check', allow('principal_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  if (!['submitted', 'validated'].includes(schedule.status)) return res.status(409).json({ message: 'La vérification externe est disponible après soumission.' });
  const data = parse(z.object({ notes: z.string().min(3) }), req.body);
  schedule.externalCheck = { checked: true, notes: data.notes, checkedBy: req.user.id, checkedAt: new Date() };
  await schedule.save();
  res.json(schedule);
});

router.post('/:scheduleId/validate', allow('principal_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  if (schedule.status !== 'submitted') return res.status(409).json({ message: 'Seule une proposition soumise peut être validée.' });
  const conflicts = await allScheduleConflicts(schedule);
  if (conflicts.length) return res.status(409).json({ message: 'Validation impossible : des conflits internes doivent être résolus.', conflicts });
  schedule.status = 'validated';
  schedule.validatedAt = new Date();
  schedule.validatedBy = req.user.id;
  await schedule.save();
  res.json(schedule);
});

router.post('/:scheduleId/return', allow('principal_admin'), async (req, res) => {
  const schedule = await Schedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message: 'Emploi du temps introuvable.' });
  if (!['submitted', 'validated'].includes(schedule.status)) return res.status(409).json({ message: 'Seule une proposition en révision peut être renvoyée.' });
  schedule.status = 'returned';
  await schedule.save();
  res.json(schedule);
});

export default router;

import express, { Router } from 'express';
import { z } from 'zod';
import { Communication, Level, Session, User } from '../models/index.js';
import { authenticate, allow } from '../middleware/auth.js';
import { parse, objectId } from '../utils/validation.js';
import { dispatchSmsCampaign, updateSmsDeliveryStatus } from '../services/delivery.js';

const router = Router();

// Twilio sends form-encoded status callbacks and cannot authenticate with the app JWT.
router.post('/webhooks/twilio/status', express.urlencoded({ extended: false }), async (req, res) => {
  await updateSmsDeliveryStatus({ messageSid: req.body.MessageSid, status: req.body.MessageStatus, errorCode: req.body.ErrorCode, errorMessage: req.body.ErrorMessage });
  res.sendStatus(204);
});

router.use(authenticate);
const doctors = ['local_doctor', 'contract_doctor'];
const payload = z.object({
  channel: z.enum(['sms', 'email']), title: z.string().trim().min(1, 'Le titre du SMS est obligatoire.').max(160),
  recipientIds: z.array(objectId).min(1).optional(), audience: z.enum(['all_students', 'all_doctors', 'all_users', 'level_students', 'level_doctors', 'selected_doctors']).optional(),
  levelId: objectId.optional(), subject: z.string().max(160).optional(), body: z.string().trim().min(1, 'Le message est obligatoire.').max(3000)
}).refine((data) => data.recipientIds?.length || data.audience, 'Choisissez au moins un destinataire ou une audience.');

const levelDoctorIds = async (levelId) => Session.distinct('doctor', { level: levelId });
const levelScope = (req, levelId) => req.user.role === 'level_admin' ? req.user.level?.toString() : levelId;

const resolveRecipients = async (req, data) => {
  if (req.user.role === 'level_admin' && (data.channel !== 'sms' || (data.audience && !['level_students'].includes(data.audience)))) {
    const error = new Error('Le responsable de niveau peut uniquement écrire aux étudiants de son niveau.'); error.status = 403; throw error;
  }
  if (data.channel !== 'sms') { const error = new Error('L’envoi d’e-mail est momentanément désactivé.'); error.status = 422; throw error; }
  const levelId = levelScope(req, data.levelId);
  if (['level_students', 'level_doctors', 'selected_doctors'].includes(data.audience) && !levelId && data.audience !== 'selected_doctors') {
    const error = new Error('Sélectionnez un niveau.'); error.status = 422; throw error;
  }
  let filter = { active: true };
  if (data.audience === 'all_students') filter.role = 'student';
  else if (data.audience === 'all_doctors') filter.role = { $in: doctors };
  else if (data.audience === 'all_users') filter.role = { $exists: true };
  else if (data.audience === 'level_students') filter = { ...filter, role: 'student', level: levelId };
  else if (data.audience === 'level_doctors') filter = { ...filter, role: { $in: doctors }, _id: { $in: await levelDoctorIds(levelId) } };
  else if (data.audience === 'selected_doctors') {
    filter = { ...filter, role: { $in: doctors }, _id: { $in: data.recipientIds || [] } };
    if (levelId) filter._id.$in = (await levelDoctorIds(levelId)).filter((id) => data.recipientIds.includes(id.toString()));
  } else if (data.recipientIds?.length) filter._id = { $in: data.recipientIds };
  if (req.user.role === 'level_admin') filter = { ...filter, role: 'student', level: req.user.level };
  const users = await User.find(filter).select('firstName lastName phone role level').populate('level', 'name').sort('lastName firstName');
  if (!users.length) { const error = new Error('Aucun destinataire correspondant.'); error.status = 422; throw error; }
  return { users, levelId };
};

const recipientKind = (user) => user.role === 'student' ? 'student' : doctors.includes(user.role) ? 'doctor' : 'user';
const validPhone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone || '');

router.post('/', allow('principal_admin', 'level_admin'), async (req, res) => {
  const data = parse(payload, req.body);
  const { users, levelId } = await resolveRecipients(req, data);
  const deliveries = users.map((person) => {
    const phoneNumber = person.phone || '';
    const valid = validPhone(phoneNumber);
    return { recipient: person._id, recipientType: recipientKind(person), name: `${person.firstName} ${person.lastName}`, phoneNumber: phoneNumber || 'Non renseigné', level: person.level?._id, levelName: person.level?.name, status: valid ? 'pending' : 'failed', error: valid ? undefined : 'Numéro de téléphone absent ou invalide.' };
  });
  const pending = deliveries.filter((delivery) => delivery.status === 'pending');
  const campaign = await Communication.create({ channel: 'sms', sender: req.user.id, recipients: users.map((person) => person._id), recipientType: data.audience || 'selected', level: levelId, audience: data.audience, title: data.title, subject: data.title, body: data.body, totalRecipients: deliveries.length, failedCount: deliveries.length - pending.length, status: pending.length ? 'processing' : 'failed', deliveries });
  if (pending.length) {
    dispatchSmsCampaign({ campaignId: campaign._id, deliveries: campaign.deliveries.filter((delivery) => delivery.status === 'pending'), title: data.title, body: data.body }).catch(async (error) => {
      await Communication.updateOne({ _id: campaign._id }, { $set: { status: 'failed', error: error.message } });
    });
  }
  res.status(201).json({ campaignId: campaign.id, title: campaign.title, totalRecipients: campaign.totalRecipients, failedCount: campaign.failedCount, status: campaign.status });
});

router.get('/recipients', allow('principal_admin', 'level_admin'), async (req, res) => {
  const levelFilter = req.user.role === 'level_admin' ? { _id: req.user.level } : {};
  const levels = await Level.find(levelFilter).select('name code').sort('name').lean();
  const filter = req.user.role === 'level_admin' ? { active: true, role: 'student', level: req.user.level } : { active: true, role: { $in: ['student', ...doctors] } };
  const users = await User.find(filter).select('firstName lastName phone role level').populate('level', 'name').sort('lastName firstName').lean();
  const doctorIds = users.filter((user) => doctors.includes(user.role)).map((user) => user._id);
  const teaching = await Session.find({ doctor: { $in: doctorIds } }).select('doctor level').populate('level', 'name').lean();
  const teachingByDoctor = new Map();
  teaching.forEach((item) => { const current = teachingByDoctor.get(item.doctor.toString()) || []; if (item.level && !current.some((level) => level._id.toString() === item.level._id.toString())) current.push(item.level); teachingByDoctor.set(item.doctor.toString(), current); });
  res.json({ levels, recipients: users.map((user) => ({ ...user, teachingLevels: teachingByDoctor.get(user._id.toString()) || [] })) });
});

router.get('/', allow('principal_admin', 'level_admin'), async (req, res) => {
  const filter = req.user.role === 'level_admin' ? { sender: req.user.id } : {};
  res.json(await Communication.find(filter).populate('sender', 'firstName lastName').populate('level', 'name').sort('-createdAt').limit(100).lean());
});

router.get('/:communicationId', allow('principal_admin', 'level_admin'), async (req, res) => {
  const filter = { _id: req.params.communicationId, ...(req.user.role === 'level_admin' ? { sender: req.user.id } : {}) };
  const campaign = await Communication.findOne(filter).populate('sender', 'firstName lastName').populate('level', 'name').lean();
  if (!campaign) return res.status(404).json({ message: 'Campagne introuvable.' });
  res.json(campaign);
});

export default router;

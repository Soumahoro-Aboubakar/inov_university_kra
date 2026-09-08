import { Router } from 'express';
import { z } from 'zod';
import { Level, Room, Subject, User } from '../models/index.js';
import { authenticate, allow } from '../middleware/auth.js';
import { parse, objectId } from '../utils/validation.js';
import { generateCode } from '../utils/codeGenerator.js';

const router = Router();
router.use(authenticate);

// GET catalog
router.get('/', allow('principal_admin', 'level_admin', 'student', 'local_doctor'), async (req, res) => {
  if (['student', 'local_doctor'].includes(req.user.role)) {
    return res.json({ subjects: await Subject.find().sort('name') });
  }
  const [levels, rooms, subjects, doctors] = await Promise.all([
    Level.find(req.user.role === 'level_admin' ? { _id: req.user.level } : {}).populate('manager', 'firstName lastName').sort('name'),
    Room.find().sort('name'),
    Subject.find().populate('doctors', 'firstName lastName').sort('name'),
    User.find({ role: { $in: ['local_doctor', 'contract_doctor'] }, active: true })
      .select('firstName lastName email role').sort('lastName')
  ]);
  res.json({ levels, rooms, subjects, doctors });
});

// Code generation endpoint
router.get('/generate-code', allow('principal_admin'), async (req, res) => {
  const { type, name } = req.query;
  if (!type || !name) {
    return res.status(400).json({ message: 'Les paramètres "type" et "name" sont requis.' });
  }
  if (!['level', 'room', 'subject'].includes(type)) {
    return res.status(400).json({ message: 'Type invalide. Utilisez : level, room ou subject.' });
  }
  const code = await generateCode(type, name);
  res.json({ code });
});

// CREATE
router.post('/levels', allow('principal_admin'), async (req, res) => {
  const data = parse(z.object({
    name: z.string().min(2),
    code: z.string().min(2).optional(),
    manager: objectId.optional(),
    order: z.number().int().nonnegative().optional()
  }), req.body);
  if (!data.code) data.code = await generateCode('level', data.name);
  if (data.order === undefined) data.order = await Level.countDocuments() + 1;
  res.status(201).json(await Level.create(data));
});

router.post('/rooms', allow('principal_admin'), async (req, res) => {
  const data = parse(z.object({
    name: z.string().min(1),
    code: z.string().min(2).optional(),
    capacity: z.number().int().positive().optional(),
    location: z.string().optional()
  }), req.body);
  if (!data.code) data.code = await generateCode('room', data.name);
  res.status(201).json(await Room.create(data));
});

router.post('/subjects', allow('principal_admin'), async (req, res) => {
  const data = parse(z.object({
    name: z.string().min(2),
    code: z.string().min(2).optional(),
    doctors: z.array(objectId).optional(),
    assignments: z.array(z.object({ level: objectId, doctors: z.array(objectId).min(1) })).optional()
  }), req.body);
  if (!data.code) data.code = await generateCode('subject', data.name);
  if (!data.doctors?.length && !data.assignments?.length) return res.status(422).json({ message: 'Associez au moins un docteur référent à cette matière.' });
  const doctorIds = [...new Set([...(data.doctors || []), ...(data.assignments || []).flatMap((assignment) => assignment.doctors)])];
  const validDoctors = await User.countDocuments({ _id: { $in: doctorIds }, role: { $in: ['local_doctor', 'contract_doctor'] }, active: true });
  if (validDoctors !== doctorIds.length) return res.status(422).json({ message: 'Chaque affectation doit désigner un docteur actif.' });
  res.status(201).json(await Subject.create(data));
});

// DELETE
router.delete('/levels/:id', allow('principal_admin'), async (req, res) => {
  await Level.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
router.delete('/rooms/:id', allow('principal_admin'), async (req, res) => {
  await Room.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
router.delete('/subjects/:id', allow('principal_admin'), async (req, res) => {
  await Subject.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;

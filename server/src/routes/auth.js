import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { parse } from '../utils/validation.js';
const router = Router();
const publicUser = (user) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, role: user.role, level: user.level });

router.post('/login', async (req, res) => { const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(8) }), req.body); const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash').populate('level', 'name code'); if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Identifiants incorrects.' }); res.json({ token: signToken(user), user: publicUser(user) }); });
router.post('/bootstrap', async (req, res) => { if (await User.exists({})) return res.status(403).json({ message: 'L’initialisation est déjà terminée.' }); const data = parse(z.object({ firstName: z.string().min(2), lastName: z.string().min(2), email: z.string().email(), password: z.string().min(12) }), req.body); const user = await User.create({ ...data, email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(data.password, 12), role: 'principal_admin' }); res.status(201).json({ token: signToken(user), user: publicUser(user) }); });
router.get('/me', authenticate, async (req, res) => { await req.user.populate('level', 'name code'); res.json({ user: publicUser(req.user) }); });
export default router;

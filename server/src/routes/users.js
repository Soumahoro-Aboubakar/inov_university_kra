import { Router } from 'express'; import bcrypt from 'bcryptjs'; import { z } from 'zod';
import { User, ROLES } from '../models/index.js'; import { authenticate, allow } from '../middleware/auth.js'; import { parse, objectId } from '../utils/validation.js';
const router = Router(); router.use(authenticate, allow('principal_admin'));
router.get('/', async (req, res) => res.json(await User.find().select('-passwordHash').populate('level', 'name code').sort('lastName')));
router.post('/', async (req, res) => { const data = parse(z.object({ firstName: z.string().min(2), lastName: z.string().min(2), email: z.string().email(), phone: z.string().optional(), role: z.enum(ROLES), level: objectId.optional(), password: z.string().min(12) }), req.body); const user = await User.create({ ...data, email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(data.password, 12) }); res.status(201).json({ id: user.id, email: user.email }); });
router.delete('/:id', async (req, res) => { await User.findByIdAndDelete(req.params.id); res.status(204).end(); });
export default router;

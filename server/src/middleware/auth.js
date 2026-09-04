import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentification requise.' });
  try { const { sub } = jwt.verify(token, env.jwtSecret); req.user = await User.findById(sub); if (!req.user?.active) throw new Error(); next(); }
  catch { return res.status(401).json({ message: 'Session invalide ou expirée.' }); }
};
export const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Accès non autorisé.' });
export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

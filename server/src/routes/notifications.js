import { Router } from 'express';
import { Notification } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const where = { recipient: req.user.id };
  if (req.query.unread === 'true') where.readAt = null;
  res.json(await Notification.find(where).sort('-createdAt').limit(50));
});

router.patch('/:notificationId/read', async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, recipient: req.user.id }, { readAt: new Date() }, { new: true });
  if (!notification) return res.status(404).json({ message: 'Notification introuvable.' });
  res.json(notification);
});

export default router;

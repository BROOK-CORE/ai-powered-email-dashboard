import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { requireAuth, requireAssistant, asyncHandler } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAssistant);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ ownerId: req.ownerId }).sort({ createdAt: -1 }).limit(25),
      Notification.countDocuments({ ownerId: req.ownerId, read: false }),
    ]);
    res.json({ items: items.map((n) => ({ ...n.toObject(), id: n._id })), unread });
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ ownerId: req.ownerId, read: false }, { read: true });
    res.json({ ok: true });
  })
);

export default router;

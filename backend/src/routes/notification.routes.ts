import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
    res.json({ notifications, unreadCount });
  } catch (e) { next(e); }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    const n = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { isRead: true } });
    res.json({ updated: n.count });
  } catch (e) { next(e); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const n = await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ updated: n.count });
  } catch (e) { next(e); }
});

export default router;

import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const orgId = req.query.orgId as string | undefined;
    let userIds: string[] | undefined;
    if (orgId) {
      const memberships = await prisma.membership.findMany({ where: { orgId, isActive: true }, select: { userId: true } });
      userIds = memberships.map(m => m.userId);
    }
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(userIds ? { id: { in: userIds } } : {}),
        ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { fullName: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true, bio: true, timezone: true },
      take: 100,
    });
    res.json(users);
  } catch (e) { next(e); }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true, bio: true, timezone: true, createdAt: true },
    });
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json(u);
  } catch (e) { next(e); }
});

router.patch('/me', async (req, res, next) => {
  try {
    const { fullName, bio, avatarUrl, timezone, status } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });
    res.json({ id: updated.id, email: updated.email, fullName: updated.fullName, avatarUrl: updated.avatarUrl, bio: updated.bio, timezone: updated.timezone, status: updated.status });
  } catch (e) { next(e); }
});

export default router;

import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Global search across users, messages, files, tasks, projects, channels
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const orgId = req.query.orgId as string | undefined;
    if (q.length < 2) return res.json({ users: [], messages: [], tasks: [], projects: [], channels: [], files: [] });
    const like = { contains: q, mode: 'insensitive' as const };
    const orgFilter = orgId ? { orgId } : {};
    const users = await prisma.user.findMany({
      where: { OR: [{ email: like }, { fullName: like }] },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
      take: 10,
    });
    const messages = await prisma.message.findMany({
      where: { content: like, isDeleted: false, ...(orgId ? { channel: { orgId } } : {}) },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } }, channel: true },
      take: 15, orderBy: { createdAt: 'desc' },
    });
    const tasks = await prisma.task.findMany({
      where: { title: like, deletedAt: null, ...orgFilter },
      include: { project: true, assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
      take: 10,
    });
    const projects = await prisma.project.findMany({
      where: { name: like, deletedAt: null, ...(orgId ? { team: { department: { orgId } } } : {}) },
      take: 10,
    });
    const channels = await prisma.channel.findMany({
      where: { name: like, deletedAt: null, ...orgFilter },
      take: 10,
    });
    const files = await prisma.fileAsset.findMany({
      where: { originalName: like, ...(orgId ? { orgId } : { uploaderId: req.user!.id }) },
      include: { uploader: { select: { id: true, fullName: true, avatarUrl: true } } },
      take: 10, orderBy: { createdAt: 'desc' },
    });
    res.json({ users, messages, tasks, projects, channels, files });
  } catch (e) { next(e); }
});

export default router;

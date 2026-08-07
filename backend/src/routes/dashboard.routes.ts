import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Common metrics helper
async function orgMetrics(orgId: string, userId: string) {
  const members = await prisma.membership.count({ where: { orgId, isActive: true } });
  const departments = await prisma.department.count({ where: { orgId, deletedAt: null } });
  const teams = await prisma.team.count({ where: { department: { orgId }, deletedAt: null } });
  const projects = await prisma.project.count({ where: { team: { department: { orgId } }, deletedAt: null } });
  const channels = await prisma.channel.count({ where: { orgId, deletedAt: null } });
  const tasks = await prisma.task.count({ where: { orgId, deletedAt: null } });
  const tasksByStatus = await prisma.task.groupBy({ by: ['status'], where: { orgId, deletedAt: null }, _count: { _all: true } });
  const meetings = await prisma.meeting.count({ where: { orgId } });
  const files = await prisma.fileAsset.count({ where: { orgId } });
  return {
    members,
    departments,
    teams,
    projects,
    channels,
    tasks,
    tasksByStatus: Object.fromEntries(tasksByStatus.map(r => [r.status, r._count._all])),
    meetings,
    files,
  };
}

router.get('/employee', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const myTasks = await prisma.task.findMany({
      where: { orgId, deletedAt: null, assignees: { some: { userId: req.user!.id } } },
      take: 10,
      orderBy: { dueDate: 'asc' },
      include: { project: true, assignees: { include: { user: true } } },
    });
    const myMeetings = await prisma.meeting.findMany({
      where: { orgId, startTime: { gte: new Date() }, attendees: { some: { userId: req.user!.id } } },
      orderBy: { startTime: 'asc' }, take: 5,
    });
    const unread = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
    const channels = await prisma.channel.count({ where: { orgId, members: { some: { userId: req.user!.id } } } });
    const aiConvos = await prisma.aIConversation.count({ where: { userId: req.user!.id } });
    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      where: { orgId, deletedAt: null, assignees: { some: { userId: req.user!.id } } },
      _count: { _all: true },
    });
    res.json({
      myTasks,
      myMeetings,
      unreadNotifications: unread,
      myChannels: channels,
      aiConversations: aiConvos,
      taskStatusChart: tasksByStatus.map(t => ({ status: t.status, count: t._count._all })),
    });
  } catch (e) { next(e); }
});

router.get('/manager', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId } });
    if (!m || !['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(m.role)) return res.status(403).json({ error: 'Insufficient role' });
    const metrics = await orgMetrics(orgId, req.user!.id);
    const tasksByAssignee = await prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { orgId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } } },
      _count: { _all: true },
    });
    const users = await prisma.user.findMany({ where: { id: { in: tasksByAssignee.map(t => t.userId) } }, select: { id: true, fullName: true, avatarUrl: true } });
    const workload = tasksByAssignee.map(t => ({
      userId: t.userId,
      user: users.find(u => u.id === t.userId),
      openTasks: t._count._all,
    }));
    const recentActivity = await prisma.task.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: { assignees: { include: { user: true } }, createdBy: true },
    });
    res.json({ metrics, workload, recentActivity });
  } catch (e) { next(e); }
});

router.get('/org-admin', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId } });
    if (!m || !['OWNER', 'ADMIN', 'PRINCIPAL', 'DIRECTOR'].includes(m.role)) return res.status(403).json({ error: 'Insufficient role' });
    const metrics = await orgMetrics(orgId, req.user!.id);
    // Employee growth (last 6 months)
    const now = new Date();
    const growth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await prisma.membership.count({ where: { orgId, joinedAt: { gte: start, lt: end } } });
      growth.push({ month: start.toLocaleString('en-US', { month: 'short' }), count });
    }
    // AI usage total
    const aiUsage = await prisma.aIMessage.count({ where: { conversation: { user: { memberships: { some: { orgId } } } } } });
    const channelsActive = await prisma.channel.count({ where: { orgId, deletedAt: null } });
    res.json({ metrics, growth, aiUsage, channelsActive });
  } catch (e) { next(e); }
});

router.get('/director', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId } });
    if (!m || !['OWNER', 'ADMIN', 'PRINCIPAL', 'DIRECTOR'].includes(m.role)) return res.status(403).json({ error: 'Insufficient role' });
    const departments = await prisma.department.findMany({
      where: { orgId, deletedAt: null },
      include: {
        teams: { include: { _count: { select: { memberships: true, projects: true } } } },
        _count: { select: { memberships: true, teams: true } },
      },
    });
    const projectStatus = await prisma.project.groupBy({
      by: ['status'],
      where: { team: { department: { orgId } }, deletedAt: null },
      _count: { _all: true },
    });
    const lateTasks = await prisma.task.count({
      where: { orgId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
    res.json({ departments, projectStatus, lateTasks });
  } catch (e) { next(e); }
});

router.get('/super-admin', async (req, res, next) => {
  try {
    if (req.user!.systemRole !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super admin only' });
    const [orgs, users, activeUsers, channels, messages, tasks, files, aiMessages] = await Promise.all([
      prisma.organization.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.channel.count(),
      prisma.message.count(),
      prisma.task.count(),
      prisma.fileAsset.count(),
      prisma.aIMessage.count(),
    ]);
    const now = new Date();
    const growth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lt: end } } });
      growth.push({ month: start.toLocaleString('en-US', { month: 'short' }), count });
    }
    res.json({
      metrics: { orgs, users, activeUsers, channels, messages, tasks, files, aiMessages },
      growth,
    });
  } catch (e) { next(e); }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId } });
    if (!m || !['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(m.role)) return res.status(403).json({ error: 'Insufficient role' });
    const messagesPerDay: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(); start.setDate(start.getDate() - i); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const count = await prisma.message.count({ where: { channel: { orgId }, createdAt: { gte: start, lt: end } } });
      messagesPerDay.push({ day: start.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }
    const taskCompletion = await prisma.task.groupBy({
      by: ['status'],
      where: { orgId, deletedAt: null },
      _count: { _all: true },
    });
    const workloadTop = await prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { task: { orgId, status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] }, deletedAt: null } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 8,
    });
    const users = await prisma.user.findMany({ where: { id: { in: workloadTop.map(w => w.userId) } }, select: { id: true, fullName: true, avatarUrl: true } });
    const workload = workloadTop.map(w => ({ user: users.find(u => u.id === w.userId), count: w._count._all }));
    res.json({ messagesPerDay, taskCompletion, workload });
  } catch (e) { next(e); }
});

export default router;

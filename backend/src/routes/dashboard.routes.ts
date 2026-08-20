import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Common metrics helper
async function orgMetrics(orgId: string, userId: string) {
  const [members, departments, teams, projects, channels, tasks, tasksByStatus, meetings, files] = await Promise.all([
    prisma.membership.count({ where: { orgId, isActive: true } }),
    prisma.department.count({ where: { orgId, deletedAt: null } }),
    prisma.team.count({ where: { department: { orgId }, deletedAt: null } }),
    prisma.project.count({ where: { team: { department: { orgId } }, deletedAt: null } }),
    prisma.channel.count({ where: { orgId, deletedAt: null } }),
    prisma.task.count({ where: { orgId, deletedAt: null } }),
    prisma.task.groupBy({ by: ['status'], where: { orgId, deletedAt: null }, _count: { _all: true } }),
    prisma.meeting.count({ where: { orgId } }),
    prisma.fileAsset.count({ where: { orgId } }),
  ]);
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
    const [myTasks, myMeetings, unread, channels, aiConvos, tasksByStatus] = await Promise.all([
      prisma.task.findMany({
        where: { orgId, deletedAt: null, assignees: { some: { userId: req.user!.id } } },
        take: 10,
        orderBy: { dueDate: 'asc' },
        include: {
          project: true,
          assignees: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      }),
      prisma.meeting.findMany({
        where: { orgId, startTime: { gte: new Date() }, attendees: { some: { userId: req.user!.id } } },
        orderBy: { startTime: 'asc' }, take: 5,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
      prisma.channel.count({ where: { orgId, members: { some: { userId: req.user!.id } } } }),
      prisma.aIConversation.count({ where: { userId: req.user!.id } }),
      prisma.task.groupBy({
        by: ['status'],
        where: { orgId, deletedAt: null, assignees: { some: { userId: req.user!.id } } },
        _count: { _all: true },
      }),
    ]);
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
    
    const [metrics, tasksByAssignee, recentActivity] = await Promise.all([
      orgMetrics(orgId, req.user!.id),
      prisma.taskAssignee.groupBy({
        by: ['userId'],
        where: { task: { orgId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } } },
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        include: {
          assignees: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, avatarUrl: true },
              },
            },
          },
          createdBy: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      }),
    ]);

    const users = await prisma.user.findMany({ where: { id: { in: tasksByAssignee.map(t => t.userId) } }, select: { id: true, fullName: true, avatarUrl: true } });
    const workload = tasksByAssignee.map(t => ({
      userId: t.userId,
      user: users.find(u => u.id === t.userId),
      openTasks: t._count._all,
    }));
    res.json({ metrics, workload, recentActivity });
  } catch (e) { next(e); }
});

router.get('/org-admin', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId } });
    if (!m || !['OWNER', 'ADMIN', 'PRINCIPAL', 'DIRECTOR'].includes(m.role)) return res.status(403).json({ error: 'Insufficient role' });

    const now = new Date();
    const monthIndices = [5, 4, 3, 2, 1, 0];
    const growthPromises = monthIndices.map(async (i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await prisma.membership.count({ where: { orgId, joinedAt: { gte: start, lt: end } } });
      return { month: start.toLocaleString('en-US', { month: 'short' }), count };
    });

    const [metrics, growth, aiUsage, channelsActive] = await Promise.all([
      orgMetrics(orgId, req.user!.id),
      Promise.all(growthPromises),
      prisma.aIMessage.count({ where: { conversation: { user: { memberships: { some: { orgId } } } } } }),
      prisma.channel.count({ where: { orgId, deletedAt: null } }),
    ]);

    res.json({ metrics, growth, aiUsage, channelsActive });
  } catch (e) { next(e); }
});

router.get('/director', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId } });
    if (!m || !['OWNER', 'ADMIN', 'PRINCIPAL', 'DIRECTOR'].includes(m.role)) return res.status(403).json({ error: 'Insufficient role' });

    const [departments, projectStatus, lateTasks] = await Promise.all([
      prisma.department.findMany({
        where: { orgId, deletedAt: null },
        include: {
          teams: { include: { _count: { select: { memberships: true, projects: true } } } },
          _count: { select: { memberships: true, teams: true } },
        },
      }),
      prisma.project.groupBy({
        by: ['status'],
        where: { team: { department: { orgId } }, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.task.count({
        where: { orgId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
    ]);

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
    const monthIndices = [5, 4, 3, 2, 1, 0];
    const growth = await Promise.all(monthIndices.map(async (i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lt: end } } });
      return { month: start.toLocaleString('en-US', { month: 'short' }), count };
    }));
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

    const dayIndices = [6, 5, 4, 3, 2, 1, 0];
    const dayPromises = dayIndices.map(async (i) => {
      const start = new Date(); start.setDate(start.getDate() - i); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const count = await prisma.message.count({ where: { channel: { orgId }, createdAt: { gte: start, lt: end } } });
      return { day: start.toLocaleDateString('en-US', { weekday: 'short' }), count };
    });

    const [messagesPerDay, taskCompletion, workloadTop] = await Promise.all([
      Promise.all(dayPromises),
      prisma.task.groupBy({
        by: ['status'],
        where: { orgId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.taskAssignee.groupBy({
        by: ['userId'],
        where: {
          task: { orgId, status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] }, deletedAt: null },
          user: { memberships: { some: { orgId, role: { in: ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'ACCOUNTANT'] }, isActive: true } } },
        },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 8,
      }),
    ]);

    const users = workloadTop.length > 0 ? await prisma.user.findMany({ where: { id: { in: workloadTop.map(w => w.userId) } }, select: { id: true, fullName: true, avatarUrl: true } }) : [];
    const workload = workloadTop.map(w => ({ user: users.find(u => u.id === w.userId), count: w._count._all }));
    res.json({ messagesPerDay, taskCompletion, workload });
  } catch (e) { next(e); }
});

export default router;

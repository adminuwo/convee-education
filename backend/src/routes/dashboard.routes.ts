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
    const [orgs, users, activeUsers, channels, messages, tasks, files, aiMessages, orgList] = await Promise.all([
      prisma.organization.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.channel.count(),
      prisma.message.count(),
      prisma.task.count(),
      prisma.fileAsset.count(),
      prisma.aIMessage.count(),
      prisma.organization.findMany({
        where: { deletedAt: null },
        include: {
          owner: { select: { id: true, fullName: true, email: true, status: true, lastSeenAt: true } },
          _count: {
            select: {
              memberships: true,
              channels: true,
              tasks: true,
              departments: true,
              meetings: true,
              files: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const now = new Date();
    const monthIndices = [5, 4, 3, 2, 1, 0];
    const growth = await Promise.all(monthIndices.map(async (i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lt: end } } });
      return { month: start.toLocaleString('en-US', { month: 'short' }), count };
    }));

    const formattedOrgs = orgList.map((o) => {
      const match = (o.description || '').match(/\[ADDONS:([^\]]+)\]/);
      const addons = match ? match[1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        logoUrl: o.logoUrl,
        description: o.description,
        hasAiLegal: addons.includes('AI_LEGAL'),
        addons,
        createdAt: o.createdAt,
        owner: o.owner,
        metrics: {
          members: o._count.memberships,
          departments: o._count.departments,
          channels: o._count.channels,
          tasks: o._count.tasks,
          meetings: o._count.meetings,
          files: o._count.files,
        },
      };
    });


    res.json({
      metrics: { orgs, users, activeUsers, channels, messages, tasks, files, aiMessages },
      growth,
      organizations: formattedOrgs,
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

router.get('/super-admin/token-analytics', async (req, res, next) => {
  try {
    if (req.user!.systemRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Super admin only' });
    }

    // 1. Fetch All Organizations
    const allOrgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true, description: true, createdAt: true },
    });

    // 2. Fetch all token usage records
    const allTokenLogs = await prisma.aITokenUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    // 3. Fetch Guardrail Events
    const guardrailEvents = await prisma.aIGuardrailEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Aggregate Global Token Totals
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;
    const distinctUsers = new Set<string>();

    // Breakdowns
    const roleStats: Record<string, { role: string; totalTokens: number; promptTokens: number; completionTokens: number; estimatedCost: number; count: number }> = {};
    const modelStats: Record<string, { model: string; provider: string; totalTokens: number; estimatedCost: number; count: number }> = {};
    const orgStatsMap: Record<string, {
      orgId: string;
      orgName: string;
      slug: string;
      campusType: string;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      studentTokens: number;
      teacherTokens: number;
      estimatedCostUsd: number;
      estimatedCostInr: number;
      studentUsers: Set<string>;
      teacherUsers: Set<string>;
      queryCount: number;
      lastActive: Date | null;
    }> = {};

    // Initialize org stats with all orgs
    allOrgs.forEach((org) => {
      const matchType = (org.description || '').match(/\[CAMPUS_TYPE:([^\]]+)\]/);
      const campusType = matchType ? matchType[1].trim() : 'K-12 School';
      orgStatsMap[org.id] = {
        orgId: org.id,
        orgName: org.name,
        slug: org.slug,
        campusType,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        studentTokens: 0,
        teacherTokens: 0,
        estimatedCostUsd: 0,
        estimatedCostInr: 0,
        studentUsers: new Set(),
        teacherUsers: new Set(),
        queryCount: 0,
        lastActive: null,
      };
    });

    allTokenLogs.forEach((log) => {
      totalPromptTokens += log.promptTokens;
      totalCompletionTokens += log.completionTokens;
      totalTokens += log.totalTokens;
      totalCostUsd += log.estimatedCost;
      distinctUsers.add(log.userId);

      // By Role
      const roleKey = log.role || 'STUDENT';
      if (!roleStats[roleKey]) {
        roleStats[roleKey] = { role: roleKey, totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0, count: 0 };
      }
      roleStats[roleKey].totalTokens += log.totalTokens;
      roleStats[roleKey].promptTokens += log.promptTokens;
      roleStats[roleKey].completionTokens += log.completionTokens;
      roleStats[roleKey].estimatedCost += log.estimatedCost;
      roleStats[roleKey].count += 1;

      // By Model / Provider
      const modelKey = `${log.provider}::${log.model}`;
      if (!modelStats[modelKey]) {
        modelStats[modelKey] = { model: log.model, provider: log.provider, totalTokens: 0, estimatedCost: 0, count: 0 };
      }
      modelStats[modelKey].totalTokens += log.totalTokens;
      modelStats[modelKey].estimatedCost += log.estimatedCost;
      modelStats[modelKey].count += 1;

      // By Organization
      if (log.orgId && orgStatsMap[log.orgId]) {
        const oStat = orgStatsMap[log.orgId];
        oStat.totalTokens += log.totalTokens;
        oStat.promptTokens += log.promptTokens;
        oStat.completionTokens += log.completionTokens;
        oStat.estimatedCostUsd += log.estimatedCost;
        oStat.queryCount += 1;
        if (!oStat.lastActive || log.createdAt > oStat.lastActive) {
          oStat.lastActive = log.createdAt;
        }

        if (roleKey === 'STUDENT') {
          oStat.studentTokens += log.totalTokens;
          oStat.studentUsers.add(log.userId);
        } else {
          oStat.teacherTokens += log.totalTokens;
          oStat.teacherUsers.add(log.userId);
        }
      }
    });

    // 4. Daily Trends for past 30 days & Peak Usage Analysis
    const dailyTrends: Array<{
      date: string;
      displayDate: string;
      studentTokens: number;
      teacherTokens: number;
      totalTokens: number;
      queryCount: number;
      costUsd: number;
      costInr: number;
    }> = [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const logsOnDay = allTokenLogs.filter((l) => l.createdAt.toISOString().startsWith(dateStr));
      let studentTok = 0;
      let teacherTok = 0;
      let dayCost = 0;

      logsOnDay.forEach((l) => {
        if (l.role === 'STUDENT') studentTok += l.totalTokens;
        else teacherTok += l.totalTokens;
        dayCost += l.estimatedCost;
      });

      dailyTrends.push({
        date: dateStr,
        displayDate,
        studentTokens: studentTok,
        teacherTokens: teacherTok,
        totalTokens: studentTok + teacherTok,
        queryCount: logsOnDay.length,
        costUsd: Number(dayCost.toFixed(4)),
        costInr: Number((dayCost * 86.5).toFixed(2)),
      });
    }

    // Today & Yesterday Metrics
    const todayLogs = allTokenLogs.filter((l) => l.createdAt.toISOString().startsWith(todayStr));
    let todayPromptTokens = 0;
    let todayCompletionTokens = 0;
    let todayTotalTokens = 0;
    let todayCostUsd = 0;
    const todayUsers = new Set<string>();
    todayLogs.forEach((l) => {
      todayPromptTokens += l.promptTokens;
      todayCompletionTokens += l.completionTokens;
      todayTotalTokens += l.totalTokens;
      todayCostUsd += l.estimatedCost;
      todayUsers.add(l.userId);
    });

    const yesterdayLogs = allTokenLogs.filter((l) => l.createdAt.toISOString().startsWith(yesterdayStr));
    let yesterdayTotalTokens = 0;
    let yesterdayCostUsd = 0;
    yesterdayLogs.forEach((l) => {
      yesterdayTotalTokens += l.totalTokens;
      yesterdayCostUsd += l.estimatedCost;
    });

    // Peak Day in past 30 days
    const peakDay = [...dailyTrends].sort((a, b) => b.totalTokens - a.totalTokens)[0] || {
      date: todayStr,
      displayDate: 'Today',
      totalTokens: 0,
      queryCount: 0,
      costUsd: 0,
      costInr: 0,
    };

    // 5. Hourly Time-of-Day Traffic Distribution (24 Hours)
    const hourlyDistribution: Array<{
      hour: number;
      label: string;
      fullLabel: string;
      totalTokens: number;
      studentTokens: number;
      teacherTokens: number;
      queryCount: number;
      percentage: number;
    }> = [];

    const hourBuckets: Array<{ studentTokens: number; teacherTokens: number; totalTokens: number; queryCount: number }> = Array.from(
      { length: 24 },
      () => ({ studentTokens: 0, teacherTokens: 0, totalTokens: 0, queryCount: 0 })
    );

    allTokenLogs.forEach((log) => {
      const h = new Date(log.createdAt).getHours();
      if (h >= 0 && h < 24) {
        hourBuckets[h].totalTokens += log.totalTokens;
        hourBuckets[h].queryCount += 1;
        if (log.role === 'STUDENT') {
          hourBuckets[h].studentTokens += log.totalTokens;
        } else {
          hourBuckets[h].teacherTokens += log.totalTokens;
        }
      }
    });

    const allTokensCount = totalTokens || 1;
    for (let h = 0; h < 24; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const nextHour = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
      const nextAmpm = h + 1 >= 12 && h + 1 < 24 ? 'PM' : h + 1 === 24 ? 'AM' : 'AM';

      const b = hourBuckets[h];
      hourlyDistribution.push({
        hour: h,
        label: `${displayHour} ${ampm}`,
        fullLabel: `${displayHour}:00 ${ampm} - ${nextHour}:00 ${nextAmpm}`,
        totalTokens: b.totalTokens,
        studentTokens: b.studentTokens,
        teacherTokens: b.teacherTokens,
        queryCount: b.queryCount,
        percentage: Number(((b.totalTokens / allTokensCount) * 100).toFixed(1)),
      });
    }

    const peakHourObj = [...hourlyDistribution].sort((a, b) => b.totalTokens - a.totalTokens)[0] || hourlyDistribution[10];

    // 6. Monthly Billing Aggregations & History (Group by YYYY-MM)
    const monthlyMap: Record<string, {
      monthKey: string;
      monthName: string;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      studentTokens: number;
      teacherTokens: number;
      estimatedCostUsd: number;
      estimatedCostInr: number;
      queryCount: number;
      activeOrgs: Set<string>;
      activeUsers: Set<string>;
      isCurrentMonth: boolean;
    }> = {};

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Initialize past 6 calendar months
    for (let m = 5; m >= 0; m--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
      const mName = mDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      monthlyMap[mKey] = {
        monthKey: mKey,
        monthName: mName,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        studentTokens: 0,
        teacherTokens: 0,
        estimatedCostUsd: 0,
        estimatedCostInr: 0,
        queryCount: 0,
        activeOrgs: new Set(),
        activeUsers: new Set(),
        isCurrentMonth: mKey === currentMonthKey,
      };
    }

    allTokenLogs.forEach((log) => {
      const logDate = new Date(log.createdAt);
      const mKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[mKey]) {
        const mName = logDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthlyMap[mKey] = {
          monthKey: mKey,
          monthName: mName,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          studentTokens: 0,
          teacherTokens: 0,
          estimatedCostUsd: 0,
          estimatedCostInr: 0,
          queryCount: 0,
          activeOrgs: new Set(),
          activeUsers: new Set(),
          isCurrentMonth: mKey === currentMonthKey,
        };
      }

      const mBucket = monthlyMap[mKey];
      mBucket.totalTokens += log.totalTokens;
      mBucket.promptTokens += log.promptTokens;
      mBucket.completionTokens += log.completionTokens;
      mBucket.estimatedCostUsd += log.estimatedCost;
      mBucket.queryCount += 1;
      if (log.orgId) mBucket.activeOrgs.add(log.orgId);
      mBucket.activeUsers.add(log.userId);

      if (log.role === 'STUDENT') {
        mBucket.studentTokens += log.totalTokens;
      } else {
        mBucket.teacherTokens += log.totalTokens;
      }
    });

    // Format Monthly Billing Ledger
    const monthlyHistory = Object.values(monthlyMap)
      .map((m) => ({
        monthKey: m.monthKey,
        monthName: m.monthName,
        totalTokens: m.totalTokens,
        promptTokens: m.promptTokens,
        completionTokens: m.completionTokens,
        studentTokens: m.studentTokens,
        teacherTokens: m.teacherTokens,
        estimatedCostUsd: Number(m.estimatedCostUsd.toFixed(4)),
        estimatedCostInr: Number((m.estimatedCostUsd * 86.5).toFixed(2)),
        queryCount: m.queryCount,
        activeOrgsCount: m.activeOrgs.size,
        activeUsersCount: m.activeUsers.size,
        isCurrentMonth: m.isCurrentMonth,
        status: m.isCurrentMonth ? 'ACTIVE_UNBILLED' : 'FINALIZED_INVOICED',
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // Calculate Month-End Forecast
    const currentMonthBucket = monthlyMap[currentMonthKey] || {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      queryCount: 0,
      activeOrgs: new Set(),
      activeUsers: new Set(),
    };
    const prevMonthBucket = monthlyMap[prevMonthKey] || { totalTokens: 0, estimatedCostUsd: 0, queryCount: 0 };

    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const forecastMultiplier = daysInMonth / Math.max(1, dayOfMonth);

    const currentMonthTokens = currentMonthBucket.totalTokens;
    const currentMonthCostUsd = currentMonthBucket.estimatedCostUsd;
    const currentMonthCostInr = currentMonthCostUsd * 86.5;

    const projectedTokens = Math.round(currentMonthTokens * forecastMultiplier);
    const projectedCostUsd = Number((currentMonthCostUsd * forecastMultiplier).toFixed(4));
    const projectedCostInr = Number((projectedCostUsd * 86.5).toFixed(2));

    const prevMonthTokens = prevMonthBucket.totalTokens;
    const monthGrowthPercent = prevMonthTokens > 0
      ? Number((((currentMonthTokens - prevMonthTokens) / prevMonthTokens) * 100).toFixed(1))
      : 100;

    // Format Organization Table Rows
    const orgLeaderboard = Object.values(orgStatsMap).map((o) => ({
      orgId: o.orgId,
      orgName: o.orgName,
      slug: o.slug,
      campusType: o.campusType,
      totalTokens: o.totalTokens,
      promptTokens: o.promptTokens,
      completionTokens: o.completionTokens,
      studentTokens: o.studentTokens,
      teacherTokens: o.teacherTokens,
      estimatedCostUsd: Number(o.estimatedCostUsd.toFixed(4)),
      estimatedCostInr: Number((o.estimatedCostUsd * 86.5).toFixed(2)),
      activeStudentsCount: o.studentUsers.size,
      activeTeachersCount: o.teacherUsers.size,
      queryCount: o.queryCount,
      lastActive: o.lastActive,
    })).sort((a, b) => b.totalTokens - a.totalTokens);

    // Guardrail Summary Counts
    const crisisCount = guardrailEvents.filter((e) => e.severity === 'CRISIS' || e.category === 'SELF_HARM').length;
    const reframedCount = guardrailEvents.filter((e) => e.actionTaken === 'REFRAMED_ACADEMIC' || e.actionTaken === 'REFRAMED').length;
    const piiCount = guardrailEvents.filter((e) => e.category === 'PII_LEAK' || e.actionTaken === 'SANITIZED').length;
    const blockedCount = guardrailEvents.filter((e) => e.actionTaken === 'BLOCKED').length;

    res.json({
      summary: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        totalCostInr: Number((totalCostUsd * 86.5).toFixed(2)),
        activeAiUsers: distinctUsers.size,
        totalQueries: allTokenLogs.length,
        totalOrgsCount: allOrgs.length,
      },
      dailySummary: {
        today: {
          date: todayStr,
          displayDate: 'Today',
          totalTokens: todayTotalTokens,
          promptTokens: todayPromptTokens,
          completionTokens: todayCompletionTokens,
          costUsd: Number(todayCostUsd.toFixed(4)),
          costInr: Number((todayCostUsd * 86.5).toFixed(2)),
          queryCount: todayLogs.length,
          activeUsers: todayUsers.size,
        },
        yesterday: {
          date: yesterdayStr,
          displayDate: 'Yesterday',
          totalTokens: yesterdayTotalTokens,
          costUsd: Number(yesterdayCostUsd.toFixed(4)),
          costInr: Number((yesterdayCostUsd * 86.5).toFixed(2)),
          queryCount: yesterdayLogs.length,
        },
        peakDay: {
          date: peakDay.date,
          displayDate: peakDay.displayDate,
          totalTokens: peakDay.totalTokens,
          costInr: peakDay.costInr,
          queryCount: peakDay.queryCount,
        },
        peakHour: {
          hour: peakHourObj.hour,
          label: peakHourObj.label,
          fullLabel: peakHourObj.fullLabel,
          totalTokens: peakHourObj.totalTokens,
          percentage: peakHourObj.percentage,
        },
      },
      monthlySummary: {
        currentMonth: {
          monthKey: currentMonthKey,
          monthName: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalTokens: currentMonthTokens,
          promptTokens: currentMonthBucket.promptTokens,
          completionTokens: currentMonthBucket.completionTokens,
          costUsd: Number(currentMonthCostUsd.toFixed(4)),
          costInr: Number(currentMonthCostInr.toFixed(2)),
          queryCount: currentMonthBucket.queryCount,
          activeOrgsCount: currentMonthBucket.activeOrgs.size,
          activeUsersCount: currentMonthBucket.activeUsers.size,
          daysElapsed: dayOfMonth,
          daysInMonth,
          projectedMonthEndTokens: projectedTokens,
          projectedMonthEndCostUsd: projectedCostUsd,
          projectedMonthEndCostInr: projectedCostInr,
        },
        previousMonth: {
          monthKey: prevMonthKey,
          monthName: prevMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalTokens: prevMonthTokens,
          costUsd: Number(prevMonthBucket.estimatedCostUsd.toFixed(4)),
          costInr: Number((prevMonthBucket.estimatedCostUsd * 86.5).toFixed(2)),
          queryCount: prevMonthBucket.queryCount,
        },
        monthGrowthPercent,
      },
      hourlyDistribution,
      monthlyHistory,
      dailyTrends,
      roleBreakdown: Object.values(roleStats),
      modelBreakdown: Object.values(modelStats),
      orgLeaderboard,
      guardrailSummary: {
        totalEvents: guardrailEvents.length,
        crisisCount,
        reframedCount,
        piiCount,
        blockedCount,
        recentEvents: guardrailEvents.slice(0, 15),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;

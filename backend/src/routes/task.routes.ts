import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const CreateTaskSchema = z.object({
  orgId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED']).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  checklist: z.array(z.string()).optional(),
  isHomework: z.boolean().optional(),
  classTeamIds: z.array(z.string()).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });
    const status = req.query.status as string | undefined;
    const assignee = req.query.assignee as string | undefined;
    const createdById = req.query.createdById as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const isHomework = req.query.isHomework as string | undefined;
    const where: any = { orgId, deletedAt: null };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (createdById) where.createdById = createdById;

    const roleUpper = (m.role || '').toUpperCase();
    const titleUpper = (m.title || '').toUpperCase();
    const isHigherAuthority = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'OWNER'].some(
      (r) => roleUpper.includes(r) || titleUpper.includes(r)
    );

    // Standard teachers only see homework tasks they personally created
    if (isHomework === 'true' && roleUpper === 'TEACHER' && !isHigherAuthority && !assignee && !createdById) {
      where.createdById = req.user!.id;
    }

    if (assignee === 'me') where.assignees = { some: { userId: req.user!.id } };
    else if (assignee) where.assignees = { some: { userId: assignee } };
    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { subtasks: true, comments: true } },
        checklist: true,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    const homeworkTaskIds = tasks.filter((t) => (t.metadata as any)?.isHomework).map((t) => t.id);
    const submissionsMap = new Map();
    if (homeworkTaskIds.length > 0) {
      const submissions = await prisma.homeworkSubmission.findMany({
        where: { taskId: { in: homeworkTaskIds } },
      });
      submissions.forEach((s) => submissionsMap.set(s.taskId, s));
    }

    const tasksWithSubmissions = tasks.map((t) => ({
      ...t,
      submission: submissionsMap.get(t.id) || null,
    }));

    res.json(tasksWithSubmissions);
  } catch (e) { next(e); }
});

router.post('/', validate(CreateTaskSchema), async (req, res, next) => {
  try {
    const { orgId, title, description, projectId, parentId, priority, status, dueDate, assigneeIds, checklist, isHomework, classTeamIds } = req.body;
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    let finalAssigneeIds: string[] = assigneeIds || [];
    let targetClassNames: string[] = [];

    // If marked as homework and classTeamIds provided, fetch all student members of those classes
    if (isHomework && classTeamIds && classTeamIds.length > 0) {
      const studentMemberships = await prisma.membership.findMany({
        where: {
          orgId,
          teamId: { in: classTeamIds },
          role: 'STUDENT',
          isActive: true,
        },
        select: { userId: true },
      });
      const studentUserIds = studentMemberships.map((sm) => sm.userId);
      finalAssigneeIds = Array.from(new Set([...finalAssigneeIds, ...studentUserIds]));

      // Fetch class team names for notification body
      const teams = await prisma.team.findMany({
        where: { id: { in: classTeamIds } },
        select: { name: true },
      });
      targetClassNames = teams.map((t) => t.name);
    }

    const task = await prisma.task.create({
      data: {
        orgId,
        title,
        description,
        projectId: projectId || null,
        parentId: parentId || null,
        priority: (priority || 'MEDIUM') as any,
        status: (status || 'TODO') as any,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: req.user!.id,
        metadata: isHomework ? { isHomework: true, classTeamIds, targetClassNames } : undefined,
        assignees: finalAssigneeIds.length
          ? { create: finalAssigneeIds.map((uid: string) => ({ userId: uid })) }
          : undefined,
        checklist: checklist && checklist.length
          ? { create: checklist.map((c: string, i: number) => ({ content: c, position: i })) }
          : undefined,
      },
      include: {
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
        checklist: true,
      },
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${orgId}`).emit('task:updated', { taskId: task.id, type: 'CREATED' });
    }

    const creatorName = task.createdBy?.fullName || 'Teacher';

    // Notify assignees (students for homework, staff for tasks)
    if (task.assignees.length > 0) {
      const isHw = Boolean(isHomework);
      const notifTitle = isHw ? `📚 New Homework: ${title}` : 'New task assigned';
      const classStr = targetClassNames.length > 0 ? ` for ${targetClassNames.join(', ')}` : '';
      const notifBody = isHw
        ? `${creatorName} assigned homework${classStr}: "${title}"`
        : `You were assigned to: ${title}`;
      const linkUrl = isHw ? `/app/homework?taskId=${task.id}` : `/app/tasks?taskId=${task.id}`;

      const notifData = task.assignees.map((a) => ({
        userId: a.userId,
        orgId,
        type: 'TASK_ASSIGNED' as const,
        title: notifTitle,
        body: notifBody,
        linkUrl,
        metadata: { taskId: task.id, isHomework: isHw },
      }));

      await prisma.notification.createMany({ data: notifData }).catch(() => {});

      if (io) {
        for (const a of task.assignees) {
          io.to(`user:${a.userId}`).emit('notification:new', {
            type: 'TASK_ASSIGNED',
            taskId: task.id,
            title: notifTitle,
            body: notifBody,
            linkUrl,
          });
        }
      }
    }

    res.status(201).json(task);
  } catch (e) { next(e); }
});

router.get('/:taskId', async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: {
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true } } } },
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
        project: true,
        subtasks: { include: { assignees: { include: { user: true } } } },
        comments: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
        checklist: { orderBy: { position: 'asc' } },
        dependencies: { include: { dependsOn: true } },
        attachments: { include: { file: true } },
      },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (e) { next(e); }
});

router.patch('/:taskId', async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task) return res.status(404).json({ error: 'Not found' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: task.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Forbidden' });
    if (task.status === 'CANCELLED' && req.body.status && req.body.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Cancelled tasks are locked and cannot be reopened or moved.' });
    }
    const data: any = {};
    ['title', 'description', 'status', 'priority', 'projectId'].forEach((k) => {
      if (req.body[k] !== undefined) data[k] = req.body[k];
    });
    if (req.body.dueDate !== undefined) data.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    if (req.body.status === 'COMPLETED') {
      data.completedAt = new Date();
      await prisma.taskAssignee.updateMany({
        where: { taskId: task.id },
        data: { status: 'COMPLETED' },
      }).catch(() => {});
    }
    if (req.body.status === 'CANCELLED') {
      await prisma.taskAssignee.updateMany({
        where: { taskId: task.id },
        data: { status: 'REJECTED' },
      }).catch(() => {});
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: req.user!.id,
          content: `🚫 Task was cancelled by the manager.`,
        },
      }).catch(() => {});
    }
    if (Array.isArray(req.body.assigneeIds)) {
      for (const uId of req.body.assigneeIds) {
        await prisma.taskAssignee.upsert({
          where: { taskId_userId: { taskId: task.id, userId: uId } },
          create: { taskId: task.id, userId: uId, status: 'PENDING' },
          update: {},
        }).catch(() => {});
      }
    }
    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
      include: { assignees: { include: { user: true } }, checklist: true },
    });
    const io = req.app.locals.io;
    if (io) io.to(`org:${task.orgId}`).emit('task:updated', updated);
    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/:taskId/comments', async (req, res, next) => {
  try {
    const c = await prisma.taskComment.create({
      data: { taskId: req.params.taskId, userId: req.user!.id, content: req.body.content },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.status(201).json(c);
  } catch (e) { next(e); }
});

router.post('/:taskId/assignees/:userId/respond', async (req, res, next) => {
  try {
    const existingTask = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!existingTask) return res.status(404).json({ error: 'Not found' });
    if (existingTask.status === 'CANCELLED' || existingTask.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This task is locked and cannot accept responses.' });
    }
    const { status, note, requestedDueDate } = req.body;
    const targetUserId = req.params.userId || req.user!.id;

    let parsedDate: Date | null = null;
    if (requestedDueDate) {
      try { parsedDate = new Date(requestedDueDate); } catch (e) { parsedDate = null; }
    }

    if (parsedDate) {
      await prisma.taskAssignee.updateMany({
        where: { taskId: req.params.taskId, userId: targetUserId },
        data: { status, note: note || null, requestedDueDate: parsedDate, respondedAt: new Date() },
      });
    } else {
      await prisma.taskAssignee.updateMany({
        where: { taskId: req.params.taskId, userId: targetUserId },
        data: { status, note: note || null, respondedAt: new Date() },
      });
    }

    if (status === 'EXTENSION_REQUESTED') {
      const dateStr = parsedDate ? parsedDate.toLocaleDateString() : '';
      const commentText = `📢 Requested deadline extension${dateStr ? ` to ${dateStr}` : ''}${note ? `: "${note}"` : ''}`;
      await prisma.taskComment.create({
        data: { taskId: req.params.taskId, userId: req.user!.id, content: commentText },
      }).catch(() => {});
    } else if (status === 'SUBMITTED') {
      const commentText = `📤 Work submitted for review${note ? `: "${note}"` : ''}`;
      await prisma.taskComment.create({
        data: { taskId: req.params.taskId, userId: req.user!.id, content: commentText },
      }).catch(() => {});
    }

    if (status === 'SUBMITTED') {
      await prisma.task.update({
        where: { id: req.params.taskId },
        data: { status: 'REVIEW' },
      }).catch(() => {});
    } else if (status === 'ACCEPTED') {
      const t = await prisma.task.findUnique({ where: { id: req.params.taskId } });
      if (t && t.status === 'TODO') {
        await prisma.task.update({
          where: { id: t.id },
          data: { status: 'IN_PROGRESS' },
        }).catch(() => {});
      }
    } else if (status === 'COMPLETED') {
      const t = await prisma.task.findUnique({ where: { id: req.params.taskId }, include: { assignees: true } });
      if (t) {
        const allDone = t.assignees.every(a => a.status === 'COMPLETED');
        if (allDone) {
          await prisma.task.update({ where: { id: t.id }, data: { status: 'COMPLETED', completedAt: new Date() } }).catch(() => {});
        } else {
          await prisma.task.update({ where: { id: t.id }, data: { status: 'REVIEW' } }).catch(() => {});
        }
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:taskId/approve-submission', async (req, res, next) => {
  try {
    const { assigneeUserId } = req.body;
    const targetUserId = assigneeUserId || req.user!.id;

    await prisma.taskAssignee.updateMany({
      where: { taskId: req.params.taskId, userId: targetUserId },
      data: { status: 'COMPLETED' },
    });

    await prisma.task.update({
      where: { id: req.params.taskId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await prisma.taskAssignee.updateMany({
      where: { taskId: req.params.taskId },
      data: { status: 'COMPLETED' },
    });

    await prisma.taskComment.create({
      data: {
        taskId: req.params.taskId,
        userId: req.user!.id,
        content: `✅ Work submission approved. Task marked as COMPLETED.`,
      },
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:taskId/request-changes', async (req, res, next) => {
  try {
    const { assigneeUserId, feedback } = req.body;
    const targetUserId = assigneeUserId || req.user!.id;
    await prisma.taskAssignee.updateMany({
      where: { taskId: req.params.taskId, userId: targetUserId },
      data: { status: 'ACCEPTED', note: feedback || null },
    });

    await prisma.task.update({
      where: { id: req.params.taskId },
      data: { status: 'IN_PROGRESS' },
    });

    await prisma.taskComment.create({
      data: {
        taskId: req.params.taskId,
        userId: req.user!.id,
        content: `↺ Changes requested${feedback ? `: "${feedback}"` : ''}`,
      },
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:taskId/approve-extension', async (req, res, next) => {
  try {
    const { assigneeUserId, newDueDate } = req.body;
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    let finalDueDate = task.dueDate;
    if (newDueDate) {
      finalDueDate = new Date(newDueDate);
    } else {
      const assigneeRow = await prisma.taskAssignee.findFirst({
        where: { taskId: task.id, userId: assigneeUserId },
        select: { requestedDueDate: true },
      }).catch(() => null);
      if (assigneeRow?.requestedDueDate) {
        finalDueDate = new Date(assigneeRow.requestedDueDate);
      }
    }

    await prisma.task.update({
      where: { id: task.id },
      data: { dueDate: finalDueDate },
    });

    await prisma.taskAssignee.updateMany({
      where: { taskId: task.id, userId: assigneeUserId },
      data: { status: 'ACCEPTED' },
    });

    const dateStr = finalDueDate ? finalDueDate.toLocaleDateString() : 'unspecified date';
    await prisma.taskComment.create({
      data: {
        taskId: task.id,
        userId: req.user!.id,
        content: `✅ Extension request granted. New due date set to ${dateStr}.`,
      },
    }).catch(() => {});

    res.json({ ok: true, dueDate: finalDueDate });
  } catch (e) { next(e); }
});

router.post('/:taskId/reject-extension', async (req, res, next) => {
  try {
    const { assigneeUserId, note } = req.body;
    await prisma.taskAssignee.updateMany({
      where: { taskId: req.params.taskId, userId: assigneeUserId },
      data: { status: 'ACCEPTED' },
    });

    await prisma.taskComment.create({
      data: {
        taskId: req.params.taskId,
        userId: req.user!.id,
        content: `❌ Extension request declined.${note ? ` Reason: "${note}"` : ''}`,
      },
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.patch('/:taskId/checklist/:itemId', async (req, res, next) => {
  try {
    const item = await prisma.taskChecklist.update({
      where: { id: req.params.itemId },
      data: { isDone: req.body.isDone },
    });
    res.json(item);
  } catch (e) { next(e); }
});

router.delete('/:taskId', async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task) return res.status(404).json({ error: 'Not found' });
    await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;

import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ==================== OVERSIGHT ROUTES ====================

// 1. Department Overview for Principal / Director / Admin (Lists departments with teacher counts and total homework given)
router.get('/oversight/departments-overview', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    const [departments, memberships, orgTasks] = await Promise.all([
      prisma.department.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      prisma.membership.findMany({
        where: { orgId, isActive: true },
        include: {
          user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        },
      }),
      prisma.task.findMany({
        where: { orgId, deletedAt: null },
        select: { id: true, createdById: true, metadata: true, status: true },
      }),
    ]);

    const homeworkTasks = orgTasks.filter((t) => (t.metadata as any)?.isHomework);
    const teacherTaskCountMap = new Map<string, number>();
    homeworkTasks.forEach((t) => {
      if (t.createdById) {
        teacherTaskCountMap.set(t.createdById, (teacherTaskCountMap.get(t.createdById) || 0) + 1);
      }
    });

    const deptMembersMap = new Map<string, any[]>();
    memberships.forEach((m) => {
      if (m.departmentId) {
        const list = deptMembersMap.get(m.departmentId) || [];
        list.push(m);
        deptMembersMap.set(m.departmentId, list);
      }
    });

    const result = departments.map((dept) => {
      const deptMembers = deptMembersMap.get(dept.id) || [];
      const teachers = deptMembers
        .filter((m) => ['TEACHER', 'HOD', 'DEAN'].includes((m.role || '').toUpperCase()))
        .map((m) => ({
          ...m.user,
          role: m.role,
          title: m.title || m.role,
          homeworkCount: teacherTaskCountMap.get(m.user.id) || 0,
        }));

      const totalHomeworkCount = teachers.reduce((sum, t) => sum + t.homeworkCount, 0);

      const headMem = dept.headId
        ? deptMembers.find((m) => m.userId === dept.headId)
        : deptMembers.find((m) => ['HOD', 'DEAN'].includes((m.role || '').toUpperCase()));

      return {
        id: dept.id,
        name: dept.name,
        headUser: headMem?.user || null,
        teacherCount: teachers.length,
        totalHomeworkCount,
        teachers,
      };
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// 2. Department Teachers List for HOD / Dean / Principal (Lists teachers in department with individual homework metrics)
router.get('/oversight/department-teachers', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    const departmentId = req.query.departmentId as string | undefined;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    let targetDeptId = departmentId;

    if (!targetDeptId) {
      const myMem = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId, isActive: true },
      });
      targetDeptId = myMem?.departmentId || undefined;
    }

    const whereDept: any = { orgId, isActive: true };
    if (targetDeptId) {
      whereDept.departmentId = targetDeptId;
    }

    const memberships = await prisma.membership.findMany({
      where: whereDept,
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        department: { select: { id: true, name: true } },
      },
    });

    const facultyMembers = memberships.filter((m) =>
      ['TEACHER', 'HOD', 'DEAN'].includes((m.role || '').toUpperCase())
    );

    const facultyUserIds = facultyMembers.map((m) => m.userId);

    const homeworkTasks = await prisma.task.findMany({
      where: {
        orgId,
        createdById: { in: facultyUserIds },
        deletedAt: null,
      },
      include: {
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        _count: { select: { checklist: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const teacherTasksMap = new Map<string, any[]>();
    homeworkTasks.filter((t) => (t.metadata as any)?.isHomework).forEach((t) => {
      if (t.createdById) {
        const list = teacherTasksMap.get(t.createdById) || [];
        list.push(t);
        teacherTasksMap.set(t.createdById, list);
      }
    });

    const result = facultyMembers.map((m) => {
      const teacherTasks = teacherTasksMap.get(m.userId) || [];
      return {
        id: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        title: m.title || m.role,
        department: m.department,
        homeworkCount: teacherTasks.length,
        pendingReviewCount: teacherTasks.filter((t) => t.status === 'REVIEW').length,
        completedCount: teacherTasks.filter((t) => t.status === 'COMPLETED').length,
        recentHomework: teacherTasks.slice(0, 5),
      };
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// 3. Specific Teacher Homework Assignments (Drill-down view of all homework given by a teacher)
router.get('/oversight/teacher-assignments', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    const teacherId = req.query.teacherId as string;
    if (!orgId || !teacherId) return res.status(400).json({ error: 'orgId and teacherId required' });

    const tasks = await prisma.task.findMany({
      where: {
        orgId,
        createdById: teacherId,
        deletedAt: null,
      },
      include: {
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
        checklist: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const homeworkTasks = tasks.filter((t) => (t.metadata as any)?.isHomework);

    const taskIds = homeworkTasks.map((t) => t.id);
    const submissions = await prisma.homeworkSubmission.findMany({
      where: { taskId: { in: taskIds } },
    });

    const subMap = new Map(submissions.map((s) => [s.taskId, s]));

    const result = homeworkTasks.map((t) => ({
      ...t,
      submission: subMap.get(t.id) || null,
      submissionsCount: submissions.filter((s) => s.taskId === t.id).length,
    }));

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ==================== REGULAR HOMEWORK ROUTES ====================

// 4. Student submits homework text/attachments for review
router.post('/:taskId/submit', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { content, attachmentUrl } = req.body;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Homework task not found' });

    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        taskId_studentId: {
          taskId,
          studentId: req.user!.id,
        },
      },
      create: {
        taskId,
        studentId: req.user!.id,
        content: content || '',
        attachmentUrl: attachmentUrl || null,
        submittedAt: new Date(),
      },
      update: {
        content: content || undefined,
        attachmentUrl: attachmentUrl || undefined,
        submittedAt: new Date(),
      },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'REVIEW' },
    });

    if (task.createdById) {
      await prisma.notification.create({
        data: {
          userId: task.createdById,
          orgId: task.orgId,
          type: 'TASK_UPDATED',
          title: 'Homework Submission Received',
          body: `${req.user!.email} submitted homework for "${task.title}".`,
          linkUrl: `/app/homework?tab=review`,
        },
      }).catch(() => {});
    }

    res.json({ ok: true, submission });
  } catch (e) {
    next(e);
  }
});

// 5. Teacher fetches submissions for a homework task
router.get('/:taskId/submissions', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const submissions = await prisma.homeworkSubmission.findMany({
      where: { taskId },
    });

    const studentIds = submissions.map((s) => s.studentId);
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, fullName: true, email: true, avatarUrl: true },
    });
    const studentMap = new Map(students.map((u) => [u.id, u]));

    const result = submissions.map((s) => ({
      ...s,
      student: studentMap.get(s.studentId) || null,
    }));

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// 6. Teacher grades submission with rubric criterion scores, numerical score & feedback
router.post('/:taskId/submissions/:submissionId/grade', async (req, res, next) => {
  try {
    const { taskId, submissionId } = req.params;
    const { gradeScore, gradeMax, rubricScores, feedbackNotes } = req.body;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });
    if (!task) return res.status(404).json({ error: 'Homework task not found' });

    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: task.orgId, isActive: true } });
    const roleUpper = (m?.role || '').toUpperCase();
    const titleUpper = (m?.title || '').toUpperCase();
    const isHigherAuthority = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'OWNER'].some(
      (r) => roleUpper.includes(r) || titleUpper.includes(r)
    );

    if (task.createdById !== req.user!.id && !isHigherAuthority) {
      return res.status(403).json({ error: 'Only the teacher who assigned this homework can grade it.' });
    }

    let submission: any = null;
    if (submissionId && submissionId !== 'demo-sub' && submissionId !== 'new') {
      submission = await prisma.homeworkSubmission.findUnique({ where: { id: submissionId } }).catch(() => null);
    }

    if (!submission) {
      submission = await prisma.homeworkSubmission.findFirst({ where: { taskId } }).catch(() => null);
    }

    const studentId = submission?.studentId || task.assignees[0]?.userId || req.user!.id;

    const updated = await prisma.homeworkSubmission.upsert({
      where: {
        taskId_studentId: { taskId, studentId },
      },
      create: {
        taskId,
        studentId,
        gradeScore: gradeScore !== undefined ? Number(gradeScore) : null,
        gradeMax: gradeMax !== undefined ? Number(gradeMax) : 100,
        rubricScores: rubricScores || null,
        feedbackNotes: feedbackNotes || null,
        gradedAt: new Date(),
      },
      update: {
        gradeScore: gradeScore !== undefined ? Number(gradeScore) : undefined,
        gradeMax: gradeMax !== undefined ? Number(gradeMax) : undefined,
        rubricScores: rubricScores || undefined,
        feedbackNotes: feedbackNotes !== undefined ? feedbackNotes : undefined,
        gradedAt: new Date(),
      },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' },
    });

    if (studentId) {
      await prisma.notification.create({
        data: {
          userId: studentId,
          orgId: task.orgId,
          type: 'TASK_UPDATED',
          title: 'Homework Graded 🎉',
          body: `Your homework submission for "${task.title}" has been graded (${gradeScore}/${gradeMax || 100}).`,
          linkUrl: `/app/homework?tab=completed`,
        },
      }).catch(() => {});
    }

    res.json({ ok: true, submission: updated });
  } catch (e) {
    next(e);
  }
});

export default router;

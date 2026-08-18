import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 1. Fetch linked children for parent user
router.get('/my-children', async (req, res, next) => {
  try {
    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: req.user!.id },
    });

    const studentIds = Array.from(new Set(links.map((l) => l.studentUserId)));
    const memberships = await prisma.membership.findMany({
      where: { userId: { in: studentIds } },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        team: { select: { id: true, name: true, managerId: true } },
        department: { select: { id: true, name: true } },
      },
    });

    const uniqueStudents = Array.from(
      new Map(memberships.map((m) => [m.userId, m])).values()
    );

    res.json(uniqueStudents);
  } catch (e) {
    next(e);
  }
});

// 2. Fetch comprehensive student report for parent (attendance stats, homework, teacher DMs)
router.get('/child/:studentId/report', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const orgId = req.query.orgId as string;

    const studentMem = await prisma.membership.findFirst({
      where: { userId: studentId, ...(orgId ? { orgId } : {}) },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        team: { select: { id: true, name: true, managerId: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!studentMem) return res.status(404).json({ error: 'Student not found' });

    // Authorization: User must be either the student themselves, a linked parent, an authorized faculty member, or SUPER_ADMIN
    const isSelf = req.user!.id === studentId;
    const isSuperAdmin = req.user!.systemRole === 'SUPER_ADMIN';
    const isLinkedParent = await prisma.parentStudentLink.findFirst({
      where: { parentUserId: req.user!.id, studentUserId: studentId },
    });

    let isFaculty = false;
    if (studentMem.orgId) {
      const callerMem = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId: studentMem.orgId, isActive: true },
      });
      if (callerMem && ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'OWNER'].includes(callerMem.role)) {
        isFaculty = true;
      }
    }

    if (!isSelf && !isSuperAdmin && !isLinkedParent && !isFaculty) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to view this student report' });
    }

    // Class Teacher details
    let classTeacher: any = null;
    if (studentMem.team?.managerId) {
      classTeacher = await prisma.user.findUnique({
        where: { id: studentMem.team.managerId },
        select: { id: true, fullName: true, email: true, avatarUrl: true },
      });
    }

    // Head of Department (HOD) details
    let hodUser: any = null;
    if (studentMem.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: studentMem.departmentId },
        select: { headId: true },
      });
      if (dept?.headId) {
        hodUser = await prisma.user.findUnique({
          where: { id: dept.headId },
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        });
      }
      if (!hodUser) {
        const hodMem = await prisma.membership.findFirst({
          where: { departmentId: studentMem.departmentId, role: { in: ['HOD', 'DEAN'] }, isActive: true },
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
        });
        if (hodMem?.user) {
          hodUser = hodMem.user;
        }
      }
    }

    // Attendance stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { studentId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' },
    });

    const totalClasses = attendanceRecords.length;
    const presentClasses = attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED').length;
    const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;

    // Homework tasks & submissions
    const assignedTasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        assignees: { some: { userId: studentId } },
      },
      include: {
        assignees: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const submissions = await prisma.homeworkSubmission.findMany({
      where: { studentId },
    });

    const subMap = new Map(submissions.map((s) => [s.taskId, s]));

    const homeworkReport = assignedTasks.map((t) => ({
      ...t,
      submission: subMap.get(t.id) || null,
    }));

    res.json({
      student: studentMem,
      classTeacher,
      hodUser,
      attendance: {
        totalClasses,
        presentClasses,
        percentage: attendancePercentage,
        isLowAttendance: attendancePercentage < 75,
        recentRecords: attendanceRecords.slice(0, 10),
      },
      homeworkReport,
    });
  } catch (e) {
    next(e);
  }
});

// 3. Admin links a parent account to a student account
router.post('/link', async (req, res, next) => {
  try {
    const { orgId, parentEmail, studentEmail } = req.body;
    if (!orgId || !parentEmail || !studentEmail) {
      return res.status(400).json({ error: 'orgId, parentEmail, and studentEmail required' });
    }

    const callerMem = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!callerMem || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN'].includes(callerMem.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    let parentUser = await prisma.user.findUnique({ where: { email: parentEmail } });
    if (!parentUser) {
      const pwHash = await prisma.user.findFirst().then((u) => u?.passwordHash || '');
      parentUser = await prisma.user.create({
        data: {
          email: parentEmail,
          fullName: `Parent (${parentEmail.split('@')[0]})`,
          passwordHash: pwHash,
          isVerified: true,
        },
      });
    }

    const studentUser = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!studentUser) return res.status(404).json({ error: `Student email ${studentEmail} not found` });

    // Create Parent Membership as PARENT
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: parentUser.id, orgId } },
      create: { userId: parentUser.id, orgId, role: 'PARENT', title: 'Parent / Guardian' },
      update: { role: 'PARENT', isActive: true },
    });

    const link = await prisma.parentStudentLink.upsert({
      where: {
        orgId_parentUserId_studentUserId: {
          orgId,
          parentUserId: parentUser.id,
          studentUserId: studentUser.id,
        },
      },
      create: { orgId, parentUserId: parentUser.id, studentUserId: studentUser.id },
      update: {},
    });

    res.json({ ok: true, link, parentUser, studentUser });
  } catch (e) {
    next(e);
  }
});

export default router;

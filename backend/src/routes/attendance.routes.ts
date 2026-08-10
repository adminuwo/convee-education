import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 1. Batch log attendance for a class section (Class Teacher / Admin action)
router.post('/batch', async (req, res, next) => {
  try {
    const { orgId, teamId, date, records } = req.body;
    if (!orgId || !teamId || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'orgId, teamId, and records array required' });
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!membership || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to log attendance' });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const savedRecords: any[] = [];

    for (const rec of records) {
      if (!rec.studentId || !rec.status) continue;
      const result = await prisma.attendanceRecord.upsert({
        where: {
          teamId_studentId_date: {
            teamId,
            studentId: rec.studentId,
            date: targetDate,
          },
        },
        create: {
          orgId,
          teamId,
          studentId: rec.studentId,
          date: targetDate,
          status: rec.status,
          notes: rec.notes || null,
          recordedById: req.user!.id,
        },
        update: {
          status: rec.status,
          notes: rec.notes || null,
          recordedById: req.user!.id,
        },
      });
      savedRecords.push(result);
    }

    res.json({ ok: true, count: savedRecords.length, records: savedRecords });
  } catch (e) {
    next(e);
  }
});

// 2. Fetch section attendance for a specific date or date range
router.get('/team/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        teamId,
        date: targetDate,
      },
    });

    res.json(records);
  } catch (e) {
    next(e);
  }
});

// 3. Compute overall monthly attendance statistics and flag low-attendance (<75%) alerts
router.get('/stats', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!membership) return res.status(403).json({ error: 'Not a member' });

    // Fetch student memberships in org
    const studentMembers = await prisma.membership.findMany({
      where: { orgId, role: 'STUDENT', isActive: true },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        orgId,
        date: { gte: thirtyDaysAgo },
      },
    });

    // Group records by student
    const studentMap = new Map<string, { total: number; present: number; records: any[] }>();

    attendanceRecords.forEach((rec) => {
      if (!studentMap.has(rec.studentId)) {
        studentMap.set(rec.studentId, { total: 0, present: 0, records: [] });
      }
      const item = studentMap.get(rec.studentId)!;
      item.total += 1;
      if (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'EXCUSED') {
        item.present += 1;
      }
      item.records.push(rec);
    });

    const lowAttendanceAlerts: any[] = [];
    const studentStats = studentMembers.map((sm) => {
      const stats = studentMap.get(sm.userId) || { total: 0, present: 0, records: [] };
      const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 100;

      const obj = {
        studentId: sm.userId,
        studentName: sm.user?.fullName || 'Student',
        studentEmail: sm.user?.email,
        avatarUrl: sm.user?.avatarUrl,
        className: sm.team?.name || 'Unassigned',
        wingName: sm.department?.name || 'General',
        totalClasses: stats.total,
        presentClasses: stats.present,
        percentage: pct,
        isLowAttendance: pct < 75,
      };

      if (pct < 75 && stats.total >= 3) {
        lowAttendanceAlerts.push(obj);
      }

      return obj;
    });

    const totalRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const overallCampusPercentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 95;

    res.json({
      overallCampusPercentage,
      totalStudents: studentMembers.length,
      lowAttendanceCount: lowAttendanceAlerts.length,
      lowAttendanceAlerts,
      studentStats,
    });
  } catch (e) {
    next(e);
  }
});

export default router;

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

// 4. Department-Wide Attendance Analytics (For HOD, Dean, and Leadership)
router.get('/department/:departmentId/analytics', async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const orgId = req.query.orgId as string;
    if (!orgId || !departmentId) return res.status(400).json({ error: 'orgId and departmentId required' });

    const userMembership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!userMembership) return res.status(403).json({ error: 'Not a member of this organization' });

    const department = await prisma.department.findFirst({
      where: { id: departmentId, orgId, deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            memberships: {
              where: { role: 'STUDENT', isActive: true },
              select: { id: true, userId: true },
            },
          },
        },
      },
    });
    if (!department) return res.status(404).json({ error: 'Department not found' });

    // RBAC: Top leadership, or HOD/Dean assigned to this department
    const roleUpper = (userMembership.role || '').toUpperCase();
    const isLeadership = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER'].includes(roleUpper) || req.user?.systemRole === 'SUPER_ADMIN';
    const isDeptHead = department.headId === req.user!.id;
    const isDeptHODorDean = userMembership.departmentId === departmentId && ['HOD', 'DEAN'].includes(roleUpper);

    if (!isLeadership && !isDeptHead && !isDeptHODorDean) {
      return res.status(403).json({ error: 'Access restricted: You must be HOD or Dean of this department' });
    }

    const headUser = department.headId ? await prisma.user.findUnique({ where: { id: department.headId }, select: { id: true, fullName: true, email: true } }) : null;
    const managerIds = department.teams.map((t) => t.managerId).filter(Boolean) as string[];
    const managers = await prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, fullName: true, email: true } });
    const managerMap = new Map(managers.map((m) => [m.id, m]));

    const teamIds = department.teams.map((t) => t.id);

    // Fetch past 30 days attendance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        teamId: { in: teamIds },
        date: { gte: thirtyDaysAgo },
      },
    });

    // Student memberships in department
    const studentMemberships = await prisma.membership.findMany({
      where: {
        departmentId,
        role: 'STUDENT',
        isActive: true,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Student attendance map
    const studentAttendanceMap = new Map<string, { total: number; present: number; late: number; absent: number }>();
    attendanceRecords.forEach((r) => {
      if (!studentAttendanceMap.has(r.studentId)) {
        studentAttendanceMap.set(r.studentId, { total: 0, present: 0, late: 0, absent: 0 });
      }
      const item = studentAttendanceMap.get(r.studentId)!;
      item.total += 1;
      if (r.status === 'PRESENT') item.present += 1;
      else if (r.status === 'LATE') item.late += 1;
      else if (r.status === 'ABSENT') item.absent += 1;
    });

    // Class breakdown
    const classBreakdown = department.teams.map((team) => {
      const teamRecords = attendanceRecords.filter((r) => r.teamId === team.id);
      const teamPresent = teamRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const teamTotal = teamRecords.length;
      const teamPct = teamTotal > 0 ? Math.round((teamPresent / teamTotal) * 100) : 92;
      const mgr = team.managerId ? managerMap.get(team.managerId) : null;

      return {
        teamId: team.id,
        className: team.name,
        classTeacher: mgr?.fullName || 'Not Assigned',
        studentCount: team.memberships.length,
        totalRecords: teamTotal,
        presentRecords: teamPresent,
        attendancePercentage: teamPct,
      };
    });

    // 14-day daily trends
    const dailyMap = new Map<string, { present: number; late: number; absent: number; total: number }>();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    attendanceRecords
      .filter((r) => new Date(r.date) >= fourteenDaysAgo)
      .forEach((r) => {
        const dateKey = new Date(r.date).toISOString().split('T')[0];
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { present: 0, late: 0, absent: 0, total: 0 });
        }
        const item = dailyMap.get(dateKey)!;
        item.total += 1;
        if (r.status === 'PRESENT') item.present += 1;
        else if (r.status === 'LATE') item.late += 1;
        else if (r.status === 'ABSENT') item.absent += 1;
      });

    const dailyTrends = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        total: counts.total,
        percentage: counts.total > 0 ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 95,
      }));

    // Low attendance alerts (<75%)
    const lowAttendanceStudents: any[] = [];
    studentMemberships.forEach((sm) => {
      const stats = studentAttendanceMap.get(sm.userId) || { total: 0, present: 0, late: 0, absent: 0 };
      const pct = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 100;
      if (pct < 75 && stats.total >= 3) {
        lowAttendanceStudents.push({
          studentId: sm.userId,
          studentName: sm.user?.fullName || 'Student',
          email: sm.user?.email,
          avatarUrl: sm.user?.avatarUrl,
          className: sm.team?.name || 'Class',
          totalSessions: stats.total,
          presentSessions: stats.present + stats.late,
          absentSessions: stats.absent,
          percentage: pct,
        });
      }
    });

    const deptTotalRecords = attendanceRecords.length;
    const deptTotalPresent = attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const averageAttendancePercentage = deptTotalRecords > 0 ? Math.round((deptTotalPresent / deptTotalRecords) * 100) : 93;

    res.json({
      department: {
        id: department.id,
        name: department.name,
        headName: headUser?.fullName || 'Not Appointed',
      },
      totalClasses: department.teams.length,
      totalStudents: studentMemberships.length,
      averageAttendancePercentage,
      classBreakdown,
      dailyTrends,
      lowAttendanceStudents,
    });
  } catch (e) {
    next(e);
  }
});

// 5. Classroom (Team / Section) Attendance Analytics (For Class Teachers and HODs)
router.get('/team/:teamId/analytics', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const orgId = req.query.orgId as string;
    if (!orgId || !teamId) return res.status(400).json({ error: 'orgId and teamId required' });

    const userMembership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!userMembership) return res.status(403).json({ error: 'Not a member of this organization' });

    const team = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null, department: { orgId } },
      include: {
        department: { select: { id: true, name: true, headId: true } },
      },
    });
    if (!team) return res.status(404).json({ error: 'Class section not found' });

    const classTeacher = team.managerId ? await prisma.user.findUnique({ where: { id: team.managerId }, select: { id: true, fullName: true, email: true } }) : null;

    // RBAC: Leadership, HOD of parent dept, or Class Teacher / assigned teacher
    const roleUpper = (userMembership.role || '').toUpperCase();
    const isLeadership = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER'].includes(roleUpper) || req.user?.systemRole === 'SUPER_ADMIN';
    const isHOD = (userMembership.departmentId === team.departmentId && ['HOD', 'DEAN'].includes(roleUpper)) || team.department?.headId === req.user!.id;
    const isClassTeacher = team.managerId === req.user!.id;
    const isAssignedTeacher = userMembership.teamId === teamId;

    if (!isLeadership && !isHOD && !isClassTeacher && !isAssignedTeacher) {
      return res.status(403).json({ error: 'Access restricted to Class Teachers and Department Leadership' });
    }

    // Student memberships in team
    const studentMemberships = await prisma.membership.findMany({
      where: {
        teamId,
        role: 'STUDENT',
        isActive: true,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    // Past 30 days attendance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        teamId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
    });

    // Student attendance stats
    const studentAttendanceMap = new Map<string, { total: number; present: number; late: number; absent: number; excused: number }>();
    attendanceRecords.forEach((r) => {
      if (!studentAttendanceMap.has(r.studentId)) {
        studentAttendanceMap.set(r.studentId, { total: 0, present: 0, late: 0, absent: 0, excused: 0 });
      }
      const item = studentAttendanceMap.get(r.studentId)!;
      item.total += 1;
      if (r.status === 'PRESENT') item.present += 1;
      else if (r.status === 'LATE') item.late += 1;
      else if (r.status === 'ABSENT') item.absent += 1;
      else if (r.status === 'EXCUSED') item.excused += 1;
    });

    const studentLedger = studentMemberships.map((sm, idx) => {
      const stats = studentAttendanceMap.get(sm.userId) || { total: 0, present: 0, late: 0, absent: 0, excused: 0 };
      const pct = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 100;
      const rollMatch = sm.title?.match(/\[(.*?)\]/)?.[1] || sm.title?.match(/([A-Z]{3,4}-\d{4}-[A-Za-z0-9]+)/i)?.[1] || `STU-2026-${String(idx + 1).padStart(3, '0')}`;

      return {
        studentId: sm.userId,
        studentName: sm.user?.fullName || 'Student',
        email: sm.user?.email,
        avatarUrl: sm.user?.avatarUrl,
        rollNo: rollMatch,
        totalSessions: stats.total,
        presentCount: stats.present,
        lateCount: stats.late,
        absentCount: stats.absent,
        excusedCount: stats.excused,
        percentage: pct,
        status: pct >= 85 ? 'GOOD' : pct >= 75 ? 'AVERAGE' : 'CRITICAL',
      };
    });

    // 14-day daily trends
    const dailyMap = new Map<string, { present: number; late: number; absent: number; excused: number; total: number }>();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    attendanceRecords
      .filter((r) => new Date(r.date) >= fourteenDaysAgo)
      .forEach((r) => {
        const dateKey = new Date(r.date).toISOString().split('T')[0];
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { present: 0, late: 0, absent: 0, excused: 0, total: 0 });
        }
        const item = dailyMap.get(dateKey)!;
        item.total += 1;
        if (r.status === 'PRESENT') item.present += 1;
        else if (r.status === 'LATE') item.late += 1;
        else if (r.status === 'ABSENT') item.absent += 1;
        else if (r.status === 'EXCUSED') item.excused += 1;
      });

    const dailyTrends = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        excused: counts.excused,
        total: counts.total,
        percentage: counts.total > 0 ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 95,
      }));

    const totalRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const classAverageAttendancePercentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 94;

    res.json({
      team: {
        id: team.id,
        name: team.name,
        departmentName: team.department?.name || 'General',
        classTeacherName: classTeacher?.fullName || 'Not Assigned',
      },
      totalStudents: studentMemberships.length,
      classAverageAttendancePercentage,
      dailyTrends,
      studentLedger,
    });
  } catch (e) {
    next(e);
  }
});

export default router;

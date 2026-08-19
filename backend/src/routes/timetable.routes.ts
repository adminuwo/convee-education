import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
const db = prisma as any;

// Apply auth middleware
router.use(authenticate);

async function getOrgId(req: Request): Promise<string | null> {
  let orgId = (req.headers['x-org-id'] as string) || (req.headers['org-id'] as string);
  if (!orgId || orgId === 'undefined' || orgId === 'null') {
    const userId = req.user?.id;
    if (userId) {
      const membership = await prisma.membership.findFirst({ where: { userId } });
      if (membership) orgId = membership.orgId;
    }
  }
  if (!orgId || orgId === 'undefined' || orgId === 'null') {
    const firstOrg = await prisma.organization.findFirst();
    if (firstOrg) orgId = firstOrg.id;
  }
  return orgId || null;
}

// Auto-seed sample timetable data if empty or using legacy dummy names
async function ensureSampleTimetableData(orgId: string) {
  try {
    // Clear old dummy generic slots if any exist with fake names
    await db.timetableSlot.deleteMany({
      where: {
        orgId,
        OR: [
          { className: { contains: 'Class 10-A (Science)' } },
          { primaryTeacherName: { contains: 'Dr. Ramesh Kumar' } },
        ],
      },
    }).catch(() => {});

    await db.teacherAbsence.deleteMany({
      where: {
        orgId,
        teacherName: { contains: 'Dr. Ramesh Kumar' },
      },
    }).catch(() => {});

    // Deduplication: Remove exact duplicate slots (same day + class + period)
    const allSlots = await db.timetableSlot.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, dayOfWeek: true, className: true, periodNumber: true },
    });

    const seen = new Set<string>();
    const duplicateIds: string[] = [];
    for (const slot of allSlots) {
      const key = `${slot.dayOfWeek}|${slot.className}|${slot.periodNumber}`;
      if (seen.has(key)) {
        duplicateIds.push(slot.id);
      } else {
        seen.add(key);
      }
    }

    if (duplicateIds.length > 0) {
      await db.timetableSlot.deleteMany({ where: { id: { in: duplicateIds } } }).catch(() => {});
    }

    const count = await db.timetableSlot.count({ where: { orgId } });
    if (count === 0) {
      // Query REAL departments for this org
      const departments = await prisma.department.findMany({ where: { orgId } });
      const deptIds = departments.map((d) => d.id);

      // Query REAL teams (Classes) for this org
      const teams = await prisma.team.findMany({
        where: { departmentId: { in: deptIds } },
        include: { department: true },
      });

      // Query REAL faculty members (Teachers, HODs, Deans, Principal, Director)
      const facultyMembers = await prisma.membership.findMany({
        where: {
          orgId,
          role: { in: ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'DIRECTOR', 'ADMIN'] },
        },
        include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } }, department: true },
      });

      const teacherNames = facultyMembers.map((m) => m.user.fullName).filter(Boolean);

      // Real faculty members list from DB
      const t1 = teacherNames[0] || 'Sarah Chen (Teacher)';
      const t2 = teacherNames[1] || 'Dr. Emily Watson (Teacher)';
      const t3 = teacherNames[2] || 'Mike Johnson (Teacher)';
      const t4 = teacherNames[3] || 'Prof. Alan Turing (HOD)';
      const t5 = teacherNames[4] || 'Dr. Marie Curie (HOD)';

      // REAL class sections from DB
      const targetTeams = teams.length > 0
        ? teams
        : [
            { name: 'Grade 10 - Sec A', departmentId: departments[0]?.id },
            { name: 'Grade 11 - Science A', departmentId: departments[1]?.id },
            { name: 'Grade 6 - Sec A', departmentId: departments[2]?.id },
            { name: 'Grade 1 - Sec A', departmentId: departments[3]?.id },
          ];

      const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const subjects = [
        ['Physics', 'Mathematics', 'Computer Science', 'Chemistry'],
        ['Accountancy', 'Economics', 'English Literature', 'Business Studies'],
        ['Science', 'Social Studies', 'English', 'Hindi'],
        ['Environmental Studies', 'Mathematics', 'English', 'Art & Craft'],
      ];

      const timings = [
        { period: 1, start: '09:00 AM', end: '09:45 AM', room: 'Room 101' },
        { period: 2, start: '09:45 AM', end: '10:30 AM', room: 'Room 102' },
        { period: 3, start: '10:45 AM', end: '11:30 AM', room: 'Lab 1' },
        { period: 4, start: '11:30 AM', end: '12:15 PM', room: 'Lab 2' },
      ];

      const assignedTeachers = [t1, t2, t3, t4, t5];

      for (const day of days) {
        for (let teamIdx = 0; teamIdx < targetTeams.length; teamIdx++) {
          const teamObj: any = targetTeams[teamIdx];
          for (let periodIdx = 0; periodIdx < timings.length; periodIdx++) {
            const t = timings[periodIdx];
            const subjList = subjects[teamIdx % subjects.length];
            const subjectName = subjList[periodIdx % subjList.length];
            const primaryTeacherName = assignedTeachers[(teamIdx + periodIdx) % assignedTeachers.length];

            await db.timetableSlot.create({
              data: {
                orgId,
                departmentId: teamObj.departmentId || null,
                teamId: teamObj.id || null,
                className: teamObj.name,
                dayOfWeek: day,
                periodNumber: t.period,
                startTime: t.start,
                endTime: t.end,
                subjectName,
                roomNumber: t.room,
                primaryTeacherName,
              },
            }).catch(() => {});
          }
        }
      }

      // Create a REAL sample teacher absence for today using a real faculty member
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const absentTeacher = t3; // e.g. Mike Johnson (Teacher)
      await db.teacherAbsence.create({
        data: {
          orgId,
          teacherUserId: facultyMembers.find((m) => m.user.fullName === absentTeacher)?.userId || 'absent-id',
          teacherName: absentTeacher,
          date: today,
          reason: 'Medical Leave / Personal Emergency',
          status: 'ABSENT',
        },
      }).catch(() => {});

      // Sample Proxy Assignment for Period 1 of the absent teacher
      const p1Slot = await db.timetableSlot.findFirst({
        where: { orgId, primaryTeacherName: absentTeacher, periodNumber: 1, dayOfWeek: 'MONDAY' },
      });

      if (p1Slot) {
        await db.proxyAssignment.create({
          data: {
            orgId,
            slotId: p1Slot.id,
            date: today,
            originalTeacherName: absentTeacher,
            substituteTeacherId: facultyMembers.find((m) => m.user.fullName === t4)?.userId || 'sub-id',
            substituteTeacherName: t4, // e.g. Prof. Alan Turing (HOD)
            assignedByUserId: 'admin-id',
            assignedByRole: 'HOD',
            status: 'ASSIGNED',
            notes: `Covering Period 1 ${p1Slot.subjectName} for ${p1Slot.className}`,
          },
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Error seeding sample timetable data:', e);
  }
}

/**
 * GET /api/v1/timetable/slots
 * Get timetable slots filtered by class, department, or teacher
 */
router.get('/slots', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    await ensureSampleTimetableData(orgId);

    const { departmentId, className, dayOfWeek = 'MONDAY' } = req.query;

    const where: any = { orgId };
    if (dayOfWeek) where.dayOfWeek = (dayOfWeek as string).toUpperCase();
    if (departmentId && departmentId !== 'ALL') where.departmentId = departmentId as string;
    if (className && className !== 'ALL') where.className = className as string;

    const slots = await db.timetableSlot.findMany({
      where,
      orderBy: [{ periodNumber: 'asc' }],
    });

    // Also fetch today's proxy assignments to merge dynamic substitute info
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const proxies = await db.proxyAssignment.findMany({
      where: { orgId, date: today },
    });

    const proxyMap = new Map(proxies.map((p) => [p.slotId, p]));

    const enrichedSlots = slots.map((s: any) => {
      const proxy: any = proxyMap.get(s.id);
      return {
        ...s,
        isProxyAssigned: !!proxy,
        proxyInfo: proxy
          ? {
              substituteTeacherName: proxy.substituteTeacherName,
              assignedByRole: proxy.assignedByRole,
              status: proxy.status,
            }
          : null,
      };
    });

    res.json({ slots: enrichedSlots });
  } catch (err: any) {
    console.error('Error fetching timetable slots:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch timetable' });
  }
});

/**
 * GET /api/v1/timetable/free-teachers
 * Query available free teachers for a specific day, period, and department
 */
router.get('/free-teachers', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const { dayOfWeek = 'MONDAY', periodNumber = '1', departmentId } = req.query;
    const period = parseInt(periodNumber as string, 10);

    // Find all teachers occupied in this period
    const busySlots = await db.timetableSlot.findMany({
      where: {
        orgId,
        dayOfWeek: (dayOfWeek as string).toUpperCase(),
        periodNumber: period,
      },
      select: { primaryTeacherName: true },
    });

    const busyNames = new Set(busySlots.map((s) => s.primaryTeacherName));

    // Today's absences
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const absences = await db.teacherAbsence.findMany({
      where: { orgId, date: today },
    });
    const absentNames = new Set(absences.map((a) => a.teacherName));

    // Get all organization members with TEACHER/HOD/DEAN role
    const membersWhere: any = {
      orgId,
      role: { in: ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL'] },
    };
    if (departmentId && departmentId !== 'ALL') {
      membersWhere.departmentId = departmentId as string;
    }

    const members = await prisma.membership.findMany({
      where: membersWhere,
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } }, department: true },
    });

    const freeTeachers = members
      .map((m) => ({
        id: m.userId,
        name: m.user.fullName,
        role: m.role,
        departmentName: m.department?.name || 'General',
        isBusy: busyNames.has(m.user.fullName),
        isAbsent: absentNames.has(m.user.fullName),
      }))
      .filter((t) => !t.isBusy && !t.isAbsent);

    res.json({
      periodNumber: period,
      dayOfWeek,
      freeTeachers,
      totalFree: freeTeachers.length,
    });
  } catch (err: any) {
    console.error('Error fetching free teachers:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch free teachers' });
  }
});

/**
 * POST /api/v1/timetable/absences
 * Mark a teacher absent for today or a specific date
 */
router.post('/absences', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const { teacherName, teacherUserId, departmentId, reason, date } = req.body;

    if (!teacherName) return res.status(400).json({ error: 'teacherName is required' });

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const absence = await db.teacherAbsence.create({
      data: {
        orgId,
        teacherUserId: teacherUserId || 'unknown',
        teacherName,
        departmentId: departmentId || null,
        date: targetDate,
        reason: reason || 'Leave of Absence',
        status: 'ABSENT',
      },
    });

    // Automatically ensure Faculty Lounge channel exists & post announcement
    try {
      let loungeChannel = await db.channel.findFirst({
        where: {
          orgId,
          name: { contains: 'faculty-lounge', mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (!loungeChannel) {
        loungeChannel = await db.channel.create({
          data: {
            orgId,
            name: 'faculty-lounge',
            description: 'Private Faculty & Staff Lounge for leave notices, announcements, and academic discussion',
            topic: 'Private Faculty & Staff Lounge for leave notices, announcements, and academic discussion',
            type: 'PRIVATE',
            createdById: (req as any).user?.id || null,
          },
        });

        // Add all faculty and management members to faculty-lounge channel
        const facultyMemberships = await db.membership.findMany({
          where: { orgId, role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true },
          select: { userId: true },
        });

        for (const fm of facultyMemberships) {
          await db.channelMember.create({
            data: {
              channelId: loungeChannel.id,
              userId: fm.userId,
              role: 'MEMBER',
            },
          }).catch(() => {});
        }
      }

      // Post Leave Notice Announcement in Faculty Lounge channel
      const dateStr = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      const noticeContent = `🚨 **Faculty Leave Notice**\n\n**${teacherName}** has marked themselves on leave for **${dateStr}**.\n📌 **Reason**: ${reason || 'Leave of Absence'}\n⚠️ *Principal, Deans & HODs: Please check Timetable & Substitutes Hub to assign proxy coverage for their periods.*`;

      const newMsg = await db.message.create({
        data: {
          channelId: loungeChannel.id,
          senderId: (req as any).user?.id || null,
          content: noticeContent,
        },
        include: {
          sender: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      });

      // Emit Socket.IO events for real-time unread badge & new message sign
      const io = req.app.locals.io;
      if (io) {
        io.to(`channel:${loungeChannel.id}`).emit('message:new', newMsg);
        io.to(`org:${orgId}`).emit('message:new', newMsg);
        io.to(`org:${orgId}`).emit('channel:updated', { channelId: loungeChannel.id, hasUnread: true });

        // Broadcast unread notification badges to all faculty & staff members
        const facultyMemberships = await db.membership.findMany({
          where: { orgId, isActive: true },
          select: { userId: true },
        });

        for (const fm of facultyMemberships) {
          const notif = await db.notification.create({
            data: {
              orgId,
              userId: fm.userId,
              title: `🚨 Faculty Leave Notice: ${teacherName}`,
              body: `${teacherName} marked on leave (${reason || 'Leave of Absence'}). Click to view in #faculty-lounge`,
              type: 'ANNOUNCEMENT',
              linkUrl: `/app/channels/${loungeChannel.id}`,
            },
          }).catch(() => null);

          if (notif && io) {
            io.to(`user:${fm.userId}`).emit('notification:new', notif);
          }
          if (io) {
            io.to(`user:${fm.userId}`).emit('unread:update', { channelId: loungeChannel.id, count: 1 });
          }
        }
      }
    } catch (chErr) {
      console.error('Error broadcasting faculty leave notice to faculty-lounge:', chErr);
    }

    res.status(201).json({ absence, message: 'Absence reported and broadcasted to Faculty Lounge!' });
  } catch (err: any) {
    console.error('Error reporting teacher absence:', err);
    res.status(500).json({ error: err.message || 'Failed to report absence' });
  }
});

/**
 * GET /api/v1/timetable/absences
 * List today's absent teachers and their unassigned periods requiring substitute (proxy) teachers
 */
router.get('/absences', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    // Support ?date= query param to fetch absences for a specific date (today or future)
    const queryDate = req.query.date as string | undefined;
    const targetDate = queryDate ? new Date(queryDate) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const absences = await db.teacherAbsence.findMany({
      where: { orgId, date: targetDate },
      orderBy: { createdAt: 'desc' },
    });

    const absentTeacherNames = absences.map((a) => a.teacherName);

    // Find all slots assigned to absent teachers for Monday (or current day)
    const absentSlots = await db.timetableSlot.findMany({
      where: {
        orgId,
        primaryTeacherName: { in: absentTeacherNames },
      },
    });

    // Check existing proxy assignments
    const proxies = await db.proxyAssignment.findMany({
      where: { orgId, date: targetDate },
    });

    const assignedSlotIds = new Set(proxies.map((p) => p.slotId));

    const pendingProxySlots = absentSlots.map((slot) => ({
      ...slot,
      isAssigned: assignedSlotIds.has(slot.id),
      proxyAssignment: proxies.find((p) => p.slotId === slot.id) || null,
    }));

    res.json({
      absences,
      totalAbsent: absences.length,
      pendingProxySlots,
      unassignedCount: pendingProxySlots.filter((s) => !s.isAssigned).length,
    });
  } catch (err: any) {
    console.error('Error fetching teacher absences:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch absences' });
  }
});

/**
 * POST /api/v1/timetable/proxy/assign
 * HOD, Dean, or Principal 1-click substitute (proxy) teacher assignment
 */
router.post('/proxy/assign', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      slotId,
      substituteTeacherId,
      substituteTeacherName,
      assignedByRole = 'HOD',
      notes,
    } = req.body;

    if (!slotId || !substituteTeacherName) {
      return res.status(400).json({ error: 'slotId and substituteTeacherName are required' });
    }

    const slot = await db.timetableSlot.findUnique({ where: { id: slotId } });
    if (!slot) return res.status(404).json({ error: 'Timetable slot not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const proxy = await db.proxyAssignment.create({
      data: {
        orgId,
        slotId: slot.id,
        date: today,
        originalTeacherId: slot.primaryTeacherId || null,
        originalTeacherName: slot.primaryTeacherName,
        substituteTeacherId: substituteTeacherId || 'sub-id',
        substituteTeacherName,
        assignedByUserId: req.user?.id || 'admin',
        assignedByRole,
        status: 'ASSIGNED',
        notes: notes || `Proxy assignment for Period ${slot.periodNumber} (${slot.className})`,
      },
    });

    res.status(201).json({
      success: true,
      proxy,
      message: `Assigned ${substituteTeacherName} as Substitute Teacher for Period ${slot.periodNumber} (${slot.className})`,
    });
  } catch (err: any) {
    console.error('Error assigning proxy teacher:', err);
    res.status(500).json({ error: err.message || 'Failed to assign proxy teacher' });
  }
});

/**
 * POST /api/v1/timetable/slots
 * Create or update a timetable slot
 */
router.post('/slots', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      id,
      departmentId,
      teamId,
      className,
      dayOfWeek = 'MONDAY',
      periodNumber,
      startTime,
      endTime,
      subjectName,
      roomNumber,
      primaryTeacherName,
    } = req.body;

    if (!className || !subjectName || !periodNumber || !primaryTeacherName) {
      return res.status(400).json({
        error: 'className, subjectName, periodNumber, and primaryTeacherName are required',
      });
    }

    const day = dayOfWeek.toUpperCase();
    const period = parseInt(periodNumber, 10);

    let slot;
    if (id) {
      slot = await db.timetableSlot.update({
        where: { id },
        data: {
          className,
          dayOfWeek: day,
          periodNumber: period,
          startTime: startTime || '09:00 AM',
          endTime: endTime || '09:45 AM',
          subjectName,
          roomNumber: roomNumber || 'Room 101',
          primaryTeacherName,
          ...(departmentId ? { departmentId } : {}),
          ...(teamId ? { teamId } : {}),
        },
      });
    } else {
      // Check if slot exists for same class, day, period
      const existing = await db.timetableSlot.findFirst({
        where: {
          orgId,
          className,
          dayOfWeek: day,
          periodNumber: period,
        },
      });

      if (existing) {
        // Return a clear conflict error — do NOT silently override
        return res.status(409).json({
          error: 'SLOT_CONFLICT',
          message: `Period ${period} is already occupied for ${className} on ${day}. Existing slot: ${existing.subjectName} (${existing.primaryTeacherName}).`,
          conflictType: 'CLASS_PERIOD',
          existingSlot: {
            id: existing.id,
            className: existing.className,
            subjectName: existing.subjectName,
            primaryTeacherName: existing.primaryTeacherName,
            startTime: existing.startTime,
            endTime: existing.endTime,
          },
        });
      }

      // Check teacher conflict: same teacher already assigned to another class at same day+period
      const teacherConflict = await db.timetableSlot.findFirst({
        where: {
          orgId,
          dayOfWeek: day,
          periodNumber: period,
          primaryTeacherName,
        },
      });

      if (teacherConflict) {
        return res.status(409).json({
          error: 'TEACHER_CONFLICT',
          message: `${primaryTeacherName} is already teaching ${teacherConflict.className} — ${teacherConflict.subjectName} during Period ${period} on ${day}.`,
          conflictType: 'TEACHER_BUSY',
          existingSlot: {
            id: teacherConflict.id,
            className: teacherConflict.className,
            subjectName: teacherConflict.subjectName,
            primaryTeacherName: teacherConflict.primaryTeacherName,
            startTime: teacherConflict.startTime,
            endTime: teacherConflict.endTime,
          },
        });
      }

      slot = await db.timetableSlot.create({
        data: {
          orgId,
          departmentId: departmentId || null,
          teamId: teamId || null,
          className,
          dayOfWeek: day,
          periodNumber: period,
          startTime: startTime || '09:00 AM',
          endTime: endTime || '09:45 AM',
          subjectName,
          roomNumber: roomNumber || 'Room 101',
          primaryTeacherName,
        },
      });
    }

    res.status(200).json({ slot });
  } catch (err: any) {
    console.error('Error saving timetable slot:', err);
    res.status(500).json({ error: err.message || 'Failed to save timetable slot' });
  }
});

/**
 * DELETE /api/v1/timetable/slots/:id
 * Delete a timetable slot
 */
router.delete('/slots/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.timetableSlot.delete({ where: { id } });
    res.json({ message: 'Timetable slot deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting timetable slot:', err);
    res.status(500).json({ error: err.message || 'Failed to delete timetable slot' });
  }
});

export default router;

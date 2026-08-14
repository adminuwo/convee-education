import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

// Helper to check admin authorization
async function verifyAdminRole(userId: string, orgId: string) {
  const member = await prisma.membership.findFirst({
    where: { userId, orgId, isActive: true },
  });
  if (!member || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN'].includes(member.role)) {
    return false;
  }
  return true;
}

// 1. GET Promotion Pipeline Configuration
router.get('/config', async (req, res, next) => {
  try {
    const orgId = (req.params as any).orgId;
    if (!await verifyAdminRole(req.user!.id, orgId)) {
      return res.status(403).json({ error: 'Access restricted to Admin roles.' });
    }

    let configs = await (prisma as any).academicPromotionConfig.findMany({
      where: { orgId },
      orderBy: { orderIndex: 'asc' },
    });

    // If no config exists, generate smart default progression pipeline from current org teams
    if (configs.length === 0) {
      const defaultSequence = [
        { from: 'Playschool', to: 'Nursery', entry: true },
        { from: 'Nursery', to: 'LKG - Sec A' },
        { from: 'LKG - Sec A', to: 'UKG - Sec A' },
        { from: 'UKG - Sec A', to: 'Grade 1 - Sec A' },
        { from: 'Grade 1 - Sec A', to: 'Grade 2 - Sec A' },
        { from: 'Grade 2 - Sec A', to: 'Grade 3 - Sec A' },
        { from: 'Grade 3 - Sec A', to: 'Grade 4 - Sec A' },
        { from: 'Grade 4 - Sec A', to: 'Grade 5 - Sec A' },
        { from: 'Grade 5 - Sec A', to: 'Grade 6 - Sec A' },
        { from: 'Grade 6 - Sec A', to: 'Grade 7 - Sec A' },
        { from: 'Grade 7 - Sec A', to: 'Grade 8 - Sec A' },
        { from: 'Grade 8 - Sec A', to: 'Grade 9 - Sec A' },
        { from: 'Grade 9 - Sec A', to: 'Grade 10 - Sec A' },
        { from: 'Grade 10 - Sec A', to: 'Class 11 - Unified', unified: true },
        { from: 'Class 11 - Unified', to: 'Grade 12 - Science A' },
        { from: 'Grade 12 - Science A', to: 'Alumni Network', alumni: true },
      ];

      const createdConfigs: any[] = [];
      for (let i = 0; i < defaultSequence.length; i++) {
        const item = defaultSequence[i];
        const cfg = await (prisma as any).academicPromotionConfig.create({
          data: {
            orgId,
            orderIndex: i + 1,
            fromClassName: item.from,
            toClassName: item.to,
            isEntryLevel: item.entry || false,
            isUnifiedPool: item.unified || false,
            isAlumniTarget: item.alumni || false,
          },
        });
        createdConfigs.push(cfg);
      }
      configs = createdConfigs;
    }

    res.json(configs);
  } catch (err) {
    next(err);
  }
});

// 2. SAVE/UPDATE Promotion Pipeline Configuration
router.post('/config', async (req, res, next) => {
  try {
    const orgId = (req.params as any).orgId;
    if (!await verifyAdminRole(req.user!.id, orgId)) {
      return res.status(403).json({ error: 'Access restricted to Admin roles.' });
    }

    const { pipeline = [] } = req.body;
    if (!Array.isArray(pipeline)) {
      return res.status(400).json({ error: 'Pipeline must be an array of step configurations.' });
    }

    // Delete existing config and recreate
    await (prisma as any).academicPromotionConfig.deleteMany({ where: { orgId } });

    const newConfigs: any[] = [];
    for (let i = 0; i < pipeline.length; i++) {
      const step = pipeline[i];
      const cfg = await (prisma as any).academicPromotionConfig.create({
        data: {
          orgId,
          orderIndex: i + 1,
          fromClassName: step.fromClassName || step.from || '',
          toClassName: step.toClassName || step.to || '',
          isEntryLevel: Boolean(step.isEntryLevel),
          isUnifiedPool: Boolean(step.isUnifiedPool),
          isAlumniTarget: Boolean(step.isAlumniTarget),
        },
      });
      newConfigs.push(cfg);
    }

    res.json({ message: 'Promotion pipeline updated successfully', configs: newConfigs });
  } catch (err) {
    next(err);
  }
});

// 3. EXECUTE BATCH PROMOTION & ARCHIVE ACADEMIC SESSION
router.post('/execute', async (req, res, next) => {
  try {
    const orgId = (req.params as any).orgId;
    if (!await verifyAdminRole(req.user!.id, orgId)) {
      return res.status(403).json({ error: 'Access restricted to Admin roles.' });
    }

    const {
      sessionName = `${new Date().getFullYear() - 1}-${new Date().getFullYear()} Academic Session`,
      retainedStudentIds = [],
    } = req.body;

    const retainedSet = new Set<string>(retainedStudentIds);

    // A. Snapshot Current Structure & Roster into Archive
    const departments = await prisma.department.findMany({
      where: { orgId, deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            memberships: {
              where: { role: 'STUDENT', isActive: true },
              include: { user: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
      },
    });

    const activeStudents = await prisma.membership.findMany({
      where: { orgId, role: 'STUDENT', isActive: true },
      include: { user: { select: { id: true, fullName: true, email: true } }, team: true, department: true },
    });

    const archiveData = {
      sessionName,
      archivedAt: new Date().toISOString(),
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        teams: d.teams.map((t) => ({
          id: t.id,
          name: t.name,
          studentCount: t.memberships.length,
          students: t.memberships.map((m) => ({
            studentId: m.title,
            fullName: m.user?.fullName,
            email: m.user?.email,
          })),
        })),
      })),
    };

    const archiveRecord = await (prisma as any).academicBatchArchive.create({
      data: {
        orgId,
        sessionName,
        structureJson: JSON.stringify(archiveData),
        studentCount: activeStudents.length,
      },
    });

    // B. Fetch Promotion Pipeline Sequence
    let configs = await (prisma as any).academicPromotionConfig.findMany({
      where: { orgId },
      orderBy: { orderIndex: 'desc' }, // Process in reverse order so lower grades don't overwrite higher ones
    });

    const currentYear = new Date().getFullYear();
    let alumniChannelId = '';

    // Create or find Alumni Channel for this passing year (e.g. "Alumni 2026")
    const alumniChannelName = `Alumni - Batch of ${currentYear}`;
    let alumniChannel = await prisma.channel.findFirst({
      where: { orgId, name: alumniChannelName },
    });
    if (!alumniChannel) {
      alumniChannel = await prisma.channel.create({
        data: {
          orgId,
          name: alumniChannelName,
          type: 'ANNOUNCEMENT',
          topic: `Official communication and networking channel for Alumni Batch of ${currentYear}`,
        },
      });
    }
    alumniChannelId = alumniChannel.id;

    // Track promotion summary counters
    let promotedCount = 0;
    let alumniCount = 0;
    let unifiedCount = 0;
    let retainedCount = 0;

    // C. Execute Promotions Following Config Pipeline (Students ONLY, Faculty & Timetables Unchanged)
    for (const step of configs) {
      const fromName = step.fromClassName.trim();
      const toName = step.toClassName.trim();

      // Find teams matching 'fromName' and 'toName'
      const fromTeams = await prisma.team.findMany({
        where: { department: { orgId }, name: { mode: 'insensitive', contains: fromName } },
      });

      if (step.isAlumniTarget) {
        // Class 12 ➔ Alumni Batch
        for (const ft of fromTeams) {
          const students = await prisma.membership.findMany({
            where: { orgId, teamId: ft.id, role: 'STUDENT', isActive: true },
          });

          for (const st of students) {
            if (retainedSet.has(st.id) || retainedSet.has(st.userId)) {
              retainedCount++;
              // Retained/Exempted student becomes an Unassigned Student
              await prisma.membership.update({
                where: { id: st.id },
                data: { teamId: null },
              });
              continue;
            }

            await prisma.membership.update({
              where: { id: st.id },
              data: {
                role: 'STUDENT', // Retain student/alumni role tag
                title: `${st.title || ''} [Alumni ${currentYear}]`,
              },
            });

            // Add to Alumni Channel
            const isMember = await prisma.channelMember.findUnique({
              where: { channelId_userId: { channelId: alumniChannelId, userId: st.userId } },
            });
            if (!isMember) {
              await prisma.channelMember.create({
                data: { channelId: alumniChannelId, userId: st.userId, isAdmin: false },
              });
            }
            alumniCount++;
          }
        }
      } else if (step.isUnifiedPool) {
        // Class 10 ➔ Class 11 - Unified Holding Pool
        let unifiedDept = await prisma.department.findFirst({
          where: { orgId, name: { mode: 'insensitive', contains: 'Higher Secondary' } },
        });
        if (!unifiedDept) {
          unifiedDept = await prisma.department.findFirst({ where: { orgId } });
        }

        let unifiedTeam = await prisma.team.findFirst({
          where: { department: { orgId }, name: { mode: 'insensitive', contains: 'Class 11 - Unified' } },
        });
        if (!unifiedTeam && unifiedDept) {
          unifiedTeam = await prisma.team.create({
            data: {
              name: 'Class 11 - Unified',
              departmentId: unifiedDept.id,
            },
          });
        }

        if (unifiedTeam) {
          for (const ft of fromTeams) {
            const students = await prisma.membership.findMany({
              where: { orgId, teamId: ft.id, role: 'STUDENT', isActive: true },
            });

            for (const st of students) {
              if (retainedSet.has(st.id) || retainedSet.has(st.userId)) {
                retainedCount++;
                // Retained/Exempted student becomes an Unassigned Student
                await prisma.membership.update({
                  where: { id: st.id },
                  data: { teamId: null },
                });
                continue;
              }

              await prisma.membership.update({
                where: { id: st.id },
                data: {
                  departmentId: unifiedTeam.departmentId,
                  teamId: unifiedTeam.id,
                },
              });
              unifiedCount++;
            }
          }
        }
      } else {
        // Standard Grade 1 ➔ Grade 2, Grade 2 ➔ Grade 3 Promotion
        let targetTeam = await prisma.team.findFirst({
          where: { department: { orgId }, name: { mode: 'insensitive', equals: toName } },
        });
        if (!targetTeam) {
          targetTeam = await prisma.team.findFirst({
            where: { department: { orgId }, name: { mode: 'insensitive', contains: toName } },
          });
        }

        // Auto-create new target class section if it does not exist yet
        if (!targetTeam && fromTeams.length > 0) {
          const targetDeptId = fromTeams[0].departmentId;
          targetTeam = await prisma.team.create({
            data: {
              name: toName,
              departmentId: targetDeptId,
            },
          });
        }

        if (targetTeam) {
          for (const ft of fromTeams) {
            if (ft.id === targetTeam.id) continue;
            const students = await prisma.membership.findMany({
              where: { orgId, teamId: ft.id, role: 'STUDENT', isActive: true },
            });

            for (const st of students) {
              if (retainedSet.has(st.id) || retainedSet.has(st.userId)) {
                retainedCount++;
                // Retained/Exempted student becomes an Unassigned Student
                await prisma.membership.update({
                  where: { id: st.id },
                  data: { teamId: null },
                });
                continue;
              }

              await prisma.membership.update({
                where: { id: st.id },
                data: {
                  departmentId: targetTeam.departmentId,
                  teamId: targetTeam.id,
                },
              });
              promotedCount++;
            }
          }
        }
      }
    }

    // D. Emit WebSocket Events for Instant Real-Time UI Refresh
    const io = req.app.locals.io;
    if (io) {
      io.emit('membership:updated', { orgId });
      io.emit('department:updated', { orgId });
      io.emit('promotion:executed', { orgId, archiveId: archiveRecord.id });
    }

    res.json({
      message: `Academic Session Promotion executed successfully! Faculty timetables remain untouched. Archive saved under "${sessionName}".`,
      archiveId: archiveRecord.id,
      summary: {
        totalPromoted: promotedCount,
        unifiedPool: unifiedCount,
        alumniGraduated: alumniCount,
        retainedStudents: retainedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET PAST BATCH ARCHIVES
router.get('/archives', async (req, res, next) => {
  try {
    const orgId = (req.params as any).orgId;
    if (!await verifyAdminRole(req.user!.id, orgId)) {
      return res.status(403).json({ error: 'Access restricted to Admin roles.' });
    }

    const archives = await (prisma as any).academicBatchArchive.findMany({
      where: { orgId },
      orderBy: { archivedAt: 'desc' },
    });

    res.json(archives);
  } catch (err) {
    next(err);
  }
});

// 5. ALLOCATE STREAM (Move from Class 11 - Unified ➔ Class 11 Science/Commerce/Arts)
router.post('/allocate-stream', async (req, res, next) => {
  try {
    const orgId = (req.params as any).orgId;
    if (!await verifyAdminRole(req.user!.id, orgId)) {
      return res.status(403).json({ error: 'Access restricted to Admin roles.' });
    }

    const { studentMembershipId, targetTeamId } = req.body;
    if (!studentMembershipId || !targetTeamId) {
      return res.status(400).json({ error: 'Student membership ID and target stream team ID are required.' });
    }

    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: { department: true },
    });

    if (!targetTeam) {
      return res.status(404).json({ error: 'Target stream class not found.' });
    }

    const updated = await prisma.membership.update({
      where: { id: studentMembershipId },
      data: {
        departmentId: targetTeam.departmentId,
        teamId: targetTeam.id,
      },
    });

    const io = req.app.locals.io;
    if (io) {
      io.emit('membership:updated', { orgId });
    }

    res.json({ message: `Student allocated successfully to ${targetTeam.name}`, membership: updated });
  } catch (err) {
    next(err);
  }
});

export default router;

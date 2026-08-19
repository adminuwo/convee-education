import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

// 1. List exams for an organization / department / teacher
router.get('/', async (req, res, next) => {
  try {
    const { orgId, departmentId, status, teamId } = req.query as {
      orgId?: string;
      departmentId?: string;
      status?: string;
      teamId?: string;
    };

    if (!orgId) return res.status(400).json({ error: 'orgId is required' });

    const userMem = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!userMem) return res.status(403).json({ error: 'Not a member of this organization' });

    const whereClause: any = { orgId };
    if (departmentId) whereClause.departmentId = departmentId;
    if (status) whereClause.status = status;

    const exams = await prisma.exam.findMany({
      where: whereClause,
      include: {
        subjects: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If filtered by class section teamId, filter targetClassIds
    let filteredExams = exams;
    if (teamId) {
      filteredExams = exams.filter((e) => {
        const targetIds = Array.isArray(e.targetClassIds) ? (e.targetClassIds as string[]) : [];
        return targetIds.length === 0 || targetIds.includes(teamId);
      });
    }

    // Enrich with class section names & submission summary stats
    const enriched = await Promise.all(
      filteredExams.map(async (exam) => {
        const targetIds = Array.isArray(exam.targetClassIds) ? (exam.targetClassIds as string[]) : [];
        const teams = targetIds.length > 0
          ? await prisma.team.findMany({
              where: { id: { in: targetIds } },
              select: { id: true, name: true, managerId: true },
            })
          : [];

        // Count scores entered
        const totalScoresCount = await prisma.examScore.count({
          where: { examId: exam.id },
        });

        // Count absentees & failed scores
        const defaulterScoresCount = await prisma.examScore.count({
          where: {
            examId: exam.id,
            OR: [{ isAbsent: true }, { isPassed: false }],
          },
        });

        return {
          ...exam,
          targetTeams: teams,
          totalScoresCount,
          defaulterScoresCount,
        };
      })
    );

    res.json(enriched);
  } catch (e) {
    logger.error('Error fetching exams:', e);
    next(e);
  }
});

// 2. Create an exam with subjects and lab overrides (HOD, Dean, Principal, Admin)
router.post('/', async (req, res, next) => {
  try {
    const {
      orgId,
      departmentId,
      title,
      term = 'Term 1',
      academicSession = '2026-2027',
      examType = 'MID_TERM',
      startDate,
      endDate,
      defaultGradingType = 'NUMERICAL',
      defaultMaxMarks = 100,
      defaultPassingMarks = 33,
      targetClassIds = [],
      subjects = [],
    } = req.body;

    if (!orgId || !title) {
      return res.status(400).json({ error: 'orgId and title are required' });
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!membership || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(membership.role)) {
      return res.status(403).json({ error: 'Only HODs, Deans, and Administrators can create exams' });
    }

    const exam = await prisma.exam.create({
      data: {
        orgId,
        departmentId: departmentId || membership.departmentId || null,
        title,
        term,
        academicSession,
        examType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: 'DRAFT',
        defaultGradingType,
        defaultMaxMarks: Number(defaultMaxMarks),
        defaultPassingMarks: Number(defaultPassingMarks),
        targetClassIds,
        createdById: req.user!.id,
        subjects: {
          create: subjects.map((s: any, idx: number) => ({
            subjectName: s.subjectName || `Subject ${idx + 1}`,
            isLabOrPractical: !!s.isLabOrPractical,
            gradingType: s.gradingType || defaultGradingType,
            maxMarks: s.maxMarks !== undefined ? Number(s.maxMarks) : Number(defaultMaxMarks),
            passingMarks: s.passingMarks !== undefined ? Number(s.passingMarks) : Number(defaultPassingMarks),
            passingGrade: s.passingGrade || 'D',
            examDate: s.examDate ? new Date(s.examDate) : null,
            orderIndex: idx,
          })),
        },
      },
      include: {
        subjects: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.status(201).json(exam);
  } catch (e) {
    logger.error('Error creating exam:', e);
    next(e);
  }
});

// 3. Update exam metadata & subjects
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      term,
      academicSession,
      examType,
      startDate,
      endDate,
      defaultGradingType,
      defaultMaxMarks,
      defaultPassingMarks,
      targetClassIds,
      subjects,
    } = req.body;

    const existing = await prisma.exam.findUnique({
      where: { id },
      include: { subjects: true },
    });
    if (!existing) return res.status(404).json({ error: 'Exam not found' });

    // Update main exam record
    const updated = await prisma.exam.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(term && { term }),
        ...(academicSession && { academicSession }),
        ...(examType && { examType }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(defaultGradingType && { defaultGradingType }),
        ...(defaultMaxMarks !== undefined && { defaultMaxMarks: Number(defaultMaxMarks) }),
        ...(defaultPassingMarks !== undefined && { defaultPassingMarks: Number(defaultPassingMarks) }),
        ...(targetClassIds && { targetClassIds }),
      },
    });

    // If subjects array provided, replace/sync
    if (Array.isArray(subjects)) {
      await prisma.examSubject.deleteMany({ where: { examId: id } });
      await prisma.examSubject.createMany({
        data: subjects.map((s: any, idx: number) => ({
          examId: id,
          subjectName: s.subjectName || `Subject ${idx + 1}`,
          isLabOrPractical: !!s.isLabOrPractical,
          gradingType: s.gradingType || updated.defaultGradingType,
          maxMarks: s.maxMarks !== undefined ? Number(s.maxMarks) : updated.defaultMaxMarks,
          passingMarks: s.passingMarks !== undefined ? Number(s.passingMarks) : updated.defaultPassingMarks,
          passingGrade: s.passingGrade || 'D',
          examDate: s.examDate ? new Date(s.examDate) : null,
          orderIndex: idx,
        })),
      });
    }

    const fullExam = await prisma.exam.findUnique({
      where: { id },
      include: { subjects: { orderBy: { orderIndex: 'asc' } } },
    });

    res.json(fullExam);
  } catch (e) {
    logger.error('Error updating exam:', e);
    next(e);
  }
});

// 4. Delete exam draft
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.exam.delete({ where: { id } });
    res.json({ ok: true, message: 'Exam deleted successfully' });
  } catch (e) {
    next(e);
  }
});

// 5. Open exam for Class Teacher grading
router.patch('/:id/open-grading', async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { subjects: true },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const updated = await prisma.exam.update({
      where: { id },
      data: { status: 'OPEN_FOR_GRADING' },
      include: { subjects: { orderBy: { orderIndex: 'asc' } } },
    });

    // Notify class teachers through Socket.IO
    if (req.app.locals.io) {
      req.app.locals.io.to(`org:${exam.orgId}`).emit('exam:opened_for_grading', {
        examId: exam.id,
        title: exam.title,
        targetClassIds: exam.targetClassIds,
      });
    }

    res.json({ ok: true, exam: updated });
  } catch (e) {
    logger.error('Error opening exam for grading:', e);
    next(e);
  }
});

// 6. Get grading matrix sheet for a Class Section (Team)
router.get('/:id/class/:teamId/grading-sheet', async (req, res, next) => {
  try {
    const { id: examId, teamId } = req.params;

    const [exam, team] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        include: { subjects: { orderBy: { orderIndex: 'asc' } } },
      }),
      prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, name: true, managerId: true, departmentId: true },
      }),
    ]);

    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (!team) return res.status(404).json({ error: 'Class section not found' });

    // Enforce faculty / teacher role barrier
    const userMem = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId: exam.orgId, isActive: true },
    });
    if (!userMem || ['STUDENT', 'PARENT', 'ALUMNI'].includes(userMem.role)) {
      return res.status(403).json({ error: 'Access denied. Only class teachers and faculty can access class grading sheets.' });
    }

    // Fetch all active students in this team
    const studentMemberships = await prisma.membership.findMany({
      where: {
        teamId,
        role: 'STUDENT',
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    // Fetch existing scores for this exam and team
    const existingScores = await prisma.examScore.findMany({
      where: { examId, teamId },
    });

    // Map scores by studentId and subjectId
    const scoreMap: Record<string, Record<string, any>> = {};
    for (const sc of existingScores) {
      if (!scoreMap[sc.studentId]) scoreMap[sc.studentId] = {};
      scoreMap[sc.studentId][sc.subjectId] = {
        id: sc.id,
        marksObtained: sc.marksObtained,
        grade: sc.grade,
        isAbsent: sc.isAbsent,
        isPassed: sc.isPassed,
        remarks: sc.remarks,
        status: sc.status,
      };
    }

    const roster = studentMemberships.map((m, index) => {
      const u = m.user;
      return {
        studentId: u.id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        rollNo: `STU-${String(index + 1).padStart(3, '0')}`,
        scores: scoreMap[u.id] || {},
      };
    });

    res.json({
      exam,
      team,
      students: roster,
    });
  } catch (e) {
    logger.error('Error fetching grading sheet:', e);
    next(e);
  }
});

// 7. Class Teacher submits grades, absences, and remarks
router.post('/:id/class/:teamId/submit-grades', async (req, res, next) => {
  try {
    const { id: examId, teamId } = req.params;
    const { submissions = [], isFinalSubmit = false } = req.body;

    if (!Array.isArray(submissions)) {
      return res.status(400).json({ error: 'submissions must be an array' });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { subjects: true },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const subjectMap = new Map(exam.subjects.map((s) => [s.id, s]));

    const savedList: any[] = [];

    for (const sub of submissions) {
      const { studentId, subjectId, marksObtained, grade, isAbsent, remarks } = sub;
      if (!studentId || !subjectId) continue;

      const subject = subjectMap.get(subjectId);
      if (!subject) continue;

      let isPassed = true;
      let finalGrade = grade;
      const numMarks = marksObtained !== undefined && marksObtained !== null && marksObtained !== '' ? Number(marksObtained) : null;

      if (isAbsent) {
        isPassed = false;
        finalGrade = 'ABS';
      } else if (numMarks !== null) {
        isPassed = numMarks >= subject.passingMarks;
        if (!finalGrade && subject.maxMarks > 0) {
          finalGrade = calculateGrade((numMarks / subject.maxMarks) * 100);
        }
      }

      const scoreRecord = await prisma.examScore.upsert({
        where: {
          examId_subjectId_studentId: {
            examId,
            subjectId,
            studentId,
          },
        },
        create: {
          examId,
          subjectId,
          studentId,
          teamId,
          marksObtained: isAbsent ? null : numMarks,
          grade: finalGrade || null,
          isAbsent: !!isAbsent,
          isPassed,
          remarks: remarks || null,
          gradedById: req.user!.id,
          gradedAt: new Date(),
          status: isFinalSubmit ? 'SUBMITTED' : 'DRAFT',
        },
        update: {
          marksObtained: isAbsent ? null : numMarks,
          grade: finalGrade || null,
          isAbsent: !!isAbsent,
          isPassed,
          remarks: remarks || null,
          gradedById: req.user!.id,
          gradedAt: new Date(),
          status: isFinalSubmit ? 'SUBMITTED' : 'DRAFT',
        },
      });

      savedList.push(scoreRecord);
    }

    // Socket update
    if (req.app.locals.io) {
      req.app.locals.io.to(`org:${exam.orgId}`).emit('exam:grades_updated', {
        examId,
        teamId,
        count: savedList.length,
        isFinalSubmit,
      });
    }

    res.json({ ok: true, count: savedList.length, isFinalSubmit });
  } catch (e) {
    logger.error('Error saving exam grades:', e);
    next(e);
  }
});

// 8. HOD Live Defaulters & Absentee Tracker
router.get('/:id/defaulters', async (req, res, next) => {
  try {
    const { id: examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { subjects: true },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Fetch all scores that are marked Absent OR Failed
    const defaulterScores = await prisma.examScore.findMany({
      where: {
        examId,
        OR: [{ isAbsent: true }, { isPassed: false }],
      },
      include: {
        subject: true,
      },
    });

    if (defaulterScores.length === 0) {
      return res.json({ examTitle: exam.title, totalDefaulters: 0, defaulters: [] });
    }

    const studentIds = Array.from(new Set(defaulterScores.map((s) => s.studentId)));
    const teamIds = Array.from(new Set(defaulterScores.map((s) => s.teamId)));

    const [students, teams, parentLinks] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, fullName: true, email: true, phoneNumber: true, avatarUrl: true },
      }),
      prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true, managerId: true },
      }),
      prisma.parentStudentLink.findMany({
        where: { studentUserId: { in: studentIds }, orgId: exam.orgId },
      }),
    ]);

    const studentMap = new Map(students.map((st) => [st.id, st]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const parentSet = new Set(parentLinks.map((p) => p.studentUserId));

    // Group by student
    const studentGrouped: Record<string, any> = {};

    for (const sc of defaulterScores) {
      if (!studentGrouped[sc.studentId]) {
        const u = studentMap.get(sc.studentId);
        const t = teamMap.get(sc.teamId);
        studentGrouped[sc.studentId] = {
          studentId: sc.studentId,
          fullName: u?.fullName || 'Unknown Student',
          email: u?.email || '',
          phoneNumber: u?.phoneNumber || '',
          avatarUrl: u?.avatarUrl || null,
          teamId: sc.teamId,
          teamName: t?.name || 'Class Section',
          hasLinkedParent: parentSet.has(sc.studentId),
          issues: [],
          hasAbsence: false,
          hasFailure: false,
        };
      }

      if (sc.isAbsent) studentGrouped[sc.studentId].hasAbsence = true;
      if (!sc.isPassed) studentGrouped[sc.studentId].hasFailure = true;

      studentGrouped[sc.studentId].issues.push({
        scoreId: sc.id,
        subjectId: sc.subjectId,
        subjectName: sc.subject?.subjectName || 'Subject',
        marksObtained: sc.marksObtained,
        maxMarks: sc.subject?.maxMarks,
        passingMarks: sc.subject?.passingMarks,
        grade: sc.grade,
        isAbsent: sc.isAbsent,
        isPassed: sc.isPassed,
        remarks: sc.remarks,
      });
    }

    const defaulters = Object.values(studentGrouped);

    res.json({
      examTitle: exam.title,
      totalDefaulters: defaulters.length,
      defaulters,
    });
  } catch (e) {
    logger.error('Error fetching defaulters:', e);
    next(e);
  }
});

// 9. Generate and save official Report Cards for an exam
router.post('/:id/generate-report-cards', async (req, res, next) => {
  try {
    const { id: examId } = req.params;
    const { teamId } = req.body; // optional class filter

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { subjects: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Find all scores for this exam
    const whereScores: any = { examId };
    if (teamId) whereScores.teamId = teamId;

    const scores = await prisma.examScore.findMany({
      where: whereScores,
      include: { subject: true },
    });

    const studentIds = Array.from(new Set(scores.map((s) => s.studentId)));

    // Fetch student info & attendance
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, fullName: true, email: true },
    });

    const reportCardsCreated: any[] = [];

    for (const student of students) {
      const studentScores = scores.filter((s) => s.studentId === student.id);
      if (studentScores.length === 0) continue;

      const studentTeamId = studentScores[0].teamId;

      let totalMarksObtained = 0;
      let totalMaxMarks = 0;
      let hasFailed = false;
      let allAbsent = true;

      const subjectsJson = studentScores.map((sc) => {
        const maxM = sc.subject?.maxMarks || 100;
        const passM = sc.subject?.passingMarks || 33;
        const marks = sc.marksObtained || 0;

        if (!sc.isAbsent) {
          allAbsent = false;
          totalMarksObtained += marks;
          totalMaxMarks += maxM;
        }
        if (!sc.isPassed || sc.isAbsent) {
          hasFailed = true;
        }

        return {
          subjectId: sc.subjectId,
          subjectName: sc.subject?.subjectName,
          isLabOrPractical: sc.subject?.isLabOrPractical,
          maxMarks: maxM,
          passingMarks: passM,
          marksObtained: sc.isAbsent ? null : marks,
          grade: sc.grade || (sc.isAbsent ? 'ABS' : calculateGrade((marks / maxM) * 100)),
          isAbsent: sc.isAbsent,
          isPassed: sc.isPassed,
          remarks: sc.remarks || '',
        };
      });

      const percentage = totalMaxMarks > 0 ? Number(((totalMarksObtained / totalMaxMarks) * 100).toFixed(1)) : 0;
      const overallGrade = allAbsent ? 'ABS' : calculateGrade(percentage);
      const resultStatus = allAbsent ? 'ABSENT' : (hasFailed ? 'FAILED' : 'PASSED');

      // Fetch student attendance records
      const attendanceCount = await prisma.attendanceRecord.count({
        where: { orgId: exam.orgId, studentId: student.id },
      });
      const presentCount = await prisma.attendanceRecord.count({
        where: { orgId: exam.orgId, studentId: student.id, status: 'PRESENT' },
      });
      const attPct = attendanceCount > 0 ? Number(((presentCount / attendanceCount) * 100).toFixed(1)) : 100;

      // Synthesize AI remarks
      let aiRemarks = `${student.fullName} has completed ${exam.title} with an overall percentage of ${percentage}% (Grade ${overallGrade}).`;
      if (resultStatus === 'PASSED') {
        aiRemarks += ` Commendable academic consistency and subject engagement. Attendance stands at ${attPct}%.`;
      } else if (hasFailed) {
        const failedSubjs = subjectsJson.filter((s) => !s.isPassed).map((s) => s.subjectName).join(', ');
        aiRemarks += ` Remedial assistance and focused practice recommended in: ${failedSubjs}. Regular review sessions are advised.`;
      }

      const reportCard = await prisma.reportCard.upsert({
        where: {
          orgId_studentId_academicSession_term: {
            orgId: exam.orgId,
            studentId: student.id,
            academicSession: exam.academicSession,
            term: exam.term,
          },
        },
        create: {
          orgId: exam.orgId,
          departmentId: exam.departmentId,
          studentId: student.id,
          teamId: studentTeamId,
          examId: exam.id,
          academicSession: exam.academicSession,
          term: exam.term,
          subjectsJson,
          totalMarksObtained,
          totalMaxMarks,
          percentage,
          overallGrade,
          resultStatus,
          attendanceStats: {
            totalDays: attendanceCount,
            daysPresent: presentCount,
            percentage: attPct,
          },
          aiRemarks,
          teacherRemarks: `Academic review finalized by faculty on ${new Date().toLocaleDateString('en-GB')}.`,
          isPublished: true,
          publishedAt: new Date(),
        },
        update: {
          departmentId: exam.departmentId,
          teamId: studentTeamId,
          examId: exam.id,
          subjectsJson,
          totalMarksObtained,
          totalMaxMarks,
          percentage,
          overallGrade,
          resultStatus,
          attendanceStats: {
            totalDays: attendanceCount,
            daysPresent: presentCount,
            percentage: attPct,
          },
          aiRemarks,
          teacherRemarks: `Academic review finalized by faculty on ${new Date().toLocaleDateString('en-GB')}.`,
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      reportCardsCreated.push(reportCard);
    }

    res.json({ ok: true, count: reportCardsCreated.length, reportCards: reportCardsCreated });
  } catch (e) {
    logger.error('Error generating report cards:', e);
    next(e);
  }
});

// 10. Fetch student report cards for Student & Parent portals
router.get('/student/:studentId/report-cards', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const orgId = req.query.orgId as string;

    const whereClause: any = { studentId };
    if (orgId) whereClause.orgId = orgId;

    const reportCards = await prisma.reportCard.findMany({
      where: whereClause,
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            examType: true,
            term: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reportCards);
  } catch (e) {
    logger.error('Error fetching student report cards:', e);
    next(e);
  }
});

// 11. Update Signatures and Official Stamp on a Report Card
router.patch('/report-card/:id/signatures', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { classTeacherSignUrl, hodSignUrl, principalSignUrl, stampUrl, applyToAllForExam } = req.body;

    const existing = await prisma.reportCard.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Report card not found' });

    const updateData: any = {};
    if (classTeacherSignUrl !== undefined) updateData.classTeacherSignUrl = classTeacherSignUrl;
    if (hodSignUrl !== undefined) updateData.hodSignUrl = hodSignUrl;
    if (principalSignUrl !== undefined) updateData.principalSignUrl = principalSignUrl;
    if (stampUrl !== undefined) updateData.stampUrl = stampUrl;

    if (applyToAllForExam && existing.examId) {
      await prisma.reportCard.updateMany({
        where: { examId: existing.examId },
        data: updateData,
      });
    }

    const updated = await prisma.reportCard.update({
      where: { id },
      data: updateData,
    });

    res.json({ ok: true, reportCard: updated });
  } catch (e) {
    logger.error('Error updating signatures on report card:', e);
    next(e);
  }
});

export default router;

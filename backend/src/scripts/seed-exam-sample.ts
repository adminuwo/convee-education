import prisma from '../db/prisma';

async function seedExamSample() {
  console.log('🌱 Seeding Sample Department Exam & Grades...');

  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Demo International', mode: 'insensitive' } },
  }) || await prisma.organization.findFirst();

  if (!org) {
    console.error('No organization found!');
    return;
  }

  const orgId = org.id;

  const department = await prisma.department.findFirst({
    where: { orgId, deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          memberships: {
            where: { role: 'STUDENT', isActive: true },
            include: { user: true },
          },
        },
      },
    },
  });

  if (!department) {
    console.log('No department found');
    return;
  }

  const faculty = await prisma.membership.findFirst({
    where: { orgId, role: { in: ['HOD', 'DEAN', 'TEACHER', 'ADMIN'] }, isActive: true },
  });
  const creatorId = faculty?.userId || org.ownerId;

  // Check if exam already exists
  let exam = await prisma.exam.findFirst({
    where: { orgId, title: 'Mid-Term Examination 2026' },
  });

  const teamIds = department.teams.map((t) => t.id);

  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        orgId,
        departmentId: department.id,
        title: 'Mid-Term Examination 2026',
        term: 'Term 1',
        academicSession: '2026-2027',
        examType: 'MID_TERM',
        status: 'OPEN_FOR_GRADING',
        defaultGradingType: 'NUMERICAL',
        defaultMaxMarks: 100,
        defaultPassingMarks: 33,
        targetClassIds: teamIds,
        createdById: creatorId,
        subjects: {
          create: [
            { subjectName: 'Mathematics', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, orderIndex: 0 },
            { subjectName: 'Physics Theory', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, orderIndex: 1 },
            { subjectName: 'Physics Lab', isLabOrPractical: true, maxMarks: 50, passingMarks: 20, orderIndex: 2 },
            { subjectName: 'Computer Science', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, orderIndex: 3 },
          ],
        },
      },
    });
    console.log(`Created exam: ${exam.title} (${exam.id})`);
  }

  const subjects = await prisma.examSubject.findMany({
    where: { examId: exam.id },
  });

  // Seed student grades for each team
  let totalScoresSeeded = 0;
  for (const team of department.teams) {
    const students = team.memberships;
    for (let i = 0; i < students.length; i++) {
      const st = students[i];
      const studentId = st.userId;

      for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
        const sub = subjects[sIdx];

        // Intentionally create 1 absentee and 1 failing student to test the HOD Defaulters Tracker
        const isAbsent = i === 1 && sIdx === 1; // Student 2 absent in Physics Theory
        const isFailed = i === 2 && sIdx === 0; // Student 3 failed Math

        let marks = Math.floor(Math.random() * (sub.maxMarks - 40)) + 45;
        let isPassed = true;
        let grade = 'A';
        let remarks = 'Good concept grasp and problem-solving skills.';

        if (isAbsent) {
          marks = 0;
          isPassed = false;
          grade = 'ABS';
          remarks = 'Absent during exam. Medical certificate submitted.';
        } else if (isFailed) {
          marks = Math.floor(sub.passingMarks * 0.7); // Below cutoff
          isPassed = false;
          grade = 'F';
          remarks = 'Needs remedial coaching in calculus and equations.';
        }

        await prisma.examScore.upsert({
          where: {
            examId_subjectId_studentId: {
              examId: exam.id,
              subjectId: sub.id,
              studentId,
            },
          },
          create: {
            examId: exam.id,
            subjectId: sub.id,
            studentId,
            teamId: team.id,
            marksObtained: isAbsent ? null : marks,
            grade,
            isAbsent,
            isPassed,
            remarks,
            gradedById: creatorId,
            status: 'SUBMITTED',
          },
          update: {
            marksObtained: isAbsent ? null : marks,
            grade,
            isAbsent,
            isPassed,
            remarks,
            gradedById: creatorId,
            status: 'SUBMITTED',
          },
        });
        totalScoresSeeded++;
      }
    }
  }

  console.log(`Seeded ${totalScoresSeeded} exam score records across ${department.teams.length} class sections.`);

  // Generate Report Cards for this exam
  const allScores = await prisma.examScore.findMany({
    where: { examId: exam.id },
    include: { subject: true },
  });

  const studentIds = Array.from(new Set(allScores.map((s) => s.studentId)));

  for (const stId of studentIds) {
    const stScores = allScores.filter((s) => s.studentId === stId);
    if (stScores.length === 0) continue;

    const studentTeamId = stScores[0].teamId;
    let totalMarksObt = 0;
    let totalMax = 0;
    let hasFailed = false;
    let allAbsent = true;

    const subjectsJson = stScores.map((sc) => {
      const maxM = sc.subject?.maxMarks || 100;
      const marks = sc.marksObtained || 0;
      if (!sc.isAbsent) {
        allAbsent = false;
        totalMarksObt += marks;
        totalMax += maxM;
      }
      if (!sc.isPassed || sc.isAbsent) hasFailed = true;

      return {
        subjectName: sc.subject?.subjectName,
        isLabOrPractical: sc.subject?.isLabOrPractical,
        maxMarks: maxM,
        passingMarks: sc.subject?.passingMarks,
        marksObtained: sc.isAbsent ? null : marks,
        grade: sc.grade || 'A',
        isAbsent: sc.isAbsent,
        isPassed: sc.isPassed,
        remarks: sc.remarks || '',
      };
    });

    const pct = totalMax > 0 ? Number(((totalMarksObt / totalMax) * 100).toFixed(1)) : 0;
    const overallGrade = allAbsent ? 'ABS' : pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 33 ? 'D' : 'F';
    const resultStatus = allAbsent ? 'ABSENT' : hasFailed ? 'FAILED' : 'PASSED';

    const teacherSign = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><path d="M10,42 C25,18 35,15 45,30 C55,45 60,10 75,35 C85,48 95,20 110,38 C120,48 135,15 145,35" fill="none" stroke="%231e3a8a" stroke-width="2.5" stroke-linecap="round"/><text x="15" y="55" font-family="cursive, sans-serif" font-size="10" fill="%234b5563">K. Kapoor (Class Teacher)</text></svg>`;
    const hodSign = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><path d="M12,38 C28,12 40,40 55,20 C70,2 80,48 100,22 C115,5 125,40 148,25" fill="none" stroke="%230f766e" stroke-width="2.5" stroke-linecap="round"/><text x="15" y="55" font-family="cursive, sans-serif" font-size="10" fill="%234b5563">Dr. C. Oswald (HOD)</text></svg>`;
    const principalSign = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><path d="M15,40 C30,10 42,50 65,15 C85,38 105,8 125,32 C135,42 145,18 152,30" fill="none" stroke="%23701a75" stroke-width="2.5" stroke-linecap="round"/><text x="15" y="55" font-family="cursive, sans-serif" font-size="10" fill="%234b5563">Dr. A. Vance (Principal)</text></svg>`;
    const stampUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="%23dc2626" stroke-width="3" stroke-dasharray="4,2"/><circle cx="60" cy="60" r="46" fill="none" stroke="%23dc2626" stroke-width="1.5"/><path id="textPath" d="M 60,60 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/><text fill="%23dc2626" font-size="8.5" font-family="Arial, sans-serif" font-weight="bold" letter-spacing="1.5"><textPath href="%23textPath" startOffset="50%" text-anchor="middle">DEMO ACADEMY • OFFICIAL SEAL</textPath></text><polygon points="60,38 65,48 76,49 68,57 70,68 60,62 50,68 52,57 44,49 55,48" fill="%23dc2626" opacity="0.85"/><text x="60" y="82" fill="%23dc2626" font-size="7.5" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle">VERIFIED</text></svg>`;

    await prisma.reportCard.upsert({
      where: {
        orgId_studentId_academicSession_term: {
          orgId,
          studentId: stId,
          academicSession: exam.academicSession,
          term: exam.term,
        },
      },
      create: {
        orgId,
        departmentId: department.id,
        studentId: stId,
        teamId: studentTeamId,
        examId: exam.id,
        academicSession: exam.academicSession,
        term: exam.term,
        subjectsJson,
        totalMarksObtained: totalMarksObt,
        totalMaxMarks: totalMax,
        percentage: pct,
        overallGrade,
        resultStatus,
        attendanceStats: { totalDays: 90, daysPresent: 86, percentage: 95.5 },
        aiRemarks: `Candidate exhibited consistent performance in ${exam.title} with an aggregate score of ${pct}%.`,
        teacherRemarks: 'Academic performance verified and approved by Department Board.',
        classTeacherSignUrl: teacherSign,
        hodSignUrl: hodSign,
        principalSignUrl: principalSign,
        stampUrl,
        isPublished: true,
        publishedAt: new Date(),
      },
      update: {
        subjectsJson,
        totalMarksObtained: totalMarksObt,
        totalMaxMarks: totalMax,
        percentage: pct,
        overallGrade,
        resultStatus,
        classTeacherSignUrl: teacherSign,
        hodSignUrl: hodSign,
        principalSignUrl: principalSign,
        stampUrl,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  console.log(`✅ Exam and Report Cards seeded successfully!`);
}

seedExamSample()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error seeding exam:', e);
    process.exit(1);
  });

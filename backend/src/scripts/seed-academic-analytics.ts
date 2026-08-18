import prisma from '../db/prisma';

async function seedAcademicAnalytics() {
  console.log('🌱 Seeding Academic Analytics (Attendance & Homework Submissions)...');

  const org = await prisma.organization.findFirst({
    where: { name: { contains: 'Demo International', mode: 'insensitive' } },
  }) || await prisma.organization.findFirst();

  if (!org) {
    console.error('No organization found!');
    return;
  }

  const orgId = org.id;
  console.log(`Using organization: ${org.name} (${orgId})`);

  // 1. Fetch departments, teams (classes), and student memberships
  const departments = await prisma.department.findMany({
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

  const facultyMemberships = await prisma.membership.findMany({
    where: { orgId, role: { in: ['TEACHER', 'HOD', 'DEAN'] }, isActive: true },
  });
  const defaultTeacherId = facultyMemberships[0]?.userId || (await prisma.user.findFirst())?.id || '';

  console.log(`Found ${departments.length} departments across the organization.`);

  // 2. Generate 20 School Days of Attendance Records
  const now = new Date();
  const schoolDates: Date[] = [];
  for (let d = 25; d >= 1; d--) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - d);
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
      checkDate.setHours(0, 0, 0, 0);
      schoolDates.push(checkDate);
      if (schoolDates.length >= 18) break;
    }
  }

  let totalAttendanceSeeded = 0;
  for (const dept of departments) {
    for (const team of dept.teams) {
      const students = team.memberships;
      if (students.length === 0) continue;

      for (let sIdx = 0; sIdx < students.length; sIdx++) {
        const student = students[sIdx];
        // Flag 1 student per class with lower attendance (<70%)
        const isChronicallyAbsent = sIdx === 0 && students.length > 3;

        for (const sDate of schoolDates) {
          const rand = Math.random();
          let status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' = 'PRESENT';
          if (isChronicallyAbsent) {
            status = rand < 0.55 ? 'ABSENT' : rand < 0.70 ? 'LATE' : 'PRESENT';
          } else {
            status = rand < 0.88 ? 'PRESENT' : rand < 0.94 ? 'LATE' : rand < 0.98 ? 'EXCUSED' : 'ABSENT';
          }

          await prisma.attendanceRecord.upsert({
            where: {
              teamId_studentId_date: {
                teamId: team.id,
                studentId: student.userId,
                date: sDate,
              },
            },
            create: {
              orgId,
              teamId: team.id,
              studentId: student.userId,
              date: sDate,
              status,
              recordedById: defaultTeacherId,
            },
            update: {
              status,
            },
          });
          totalAttendanceSeeded++;
        }
      }
    }
  }
  console.log(`✅ Seeded ${totalAttendanceSeeded} attendance records across ${schoolDates.length} school days.`);

  // 3. Generate Homework Tasks and Submissions for Each Class
  const sampleSubjectsByDept: Record<string, string[]> = {
    'Playschool': ['Early Phonics & Alphabet', 'Rhymes & Motor Skills', 'Color Recognition', 'Storytelling'],
    'Kindergarten': ['Basic Math & Counting', 'Phonics & Reading', 'Environmental Studies', 'Creative Arts'],
    'Primary School': ['Mathematics', 'General Science', 'English Literature', 'Social Studies', 'Hindi'],
    'Middle School': ['Algebra & Geometry', 'Physics & Chemistry', 'English Grammar & Writing', 'History & Civics', 'Computer Science'],
    'High School': ['Mathematics (Grade 10)', 'Science & Technology', 'English Core', 'Social Sciences', 'Information Technology'],
    'Higher Secondary': ['Applied Mathematics', 'Physics & Optics', 'Organic Chemistry', 'Computer Science & Python', 'Accountancy & Business'],
  };

  const sampleHomeworkTitles: Record<string, string[]> = {
    'Mathematics': ['Linear Equations & Inequalities Problem Set 4', 'Coordinate Geometry & Trigonometric Identities', 'Quadratic Equations Practice Worksheet'],
    'Physics': ['Thermodynamics & Kinetic Theory Numerical Problems', 'Ray Optics: Lens Maker Formula & Refraction Analysis', 'Electromagnetic Induction Lab Calculations'],
    'Chemistry': ['Organic Reaction Mechanisms & Functional Groups', 'Chemical Bonding: Hybridization & Molecular Orbitals', 'Periodic Table Trends & Electrochemistry'],
    'Computer Science': ['Binary Search Trees & Graph Traversal Implementation', 'Database Normalization (1NF to BCNF) Case Study', 'Python OOP: Class Hierarchy & Inheritance Lab'],
    'English': ['Shakespearean Drama Analysis & Character Monologue Essay', 'Formal Letter Writing & Editorial Speech Draft', 'Poetry Interpretation & Rhetorical Devices'],
    'General Science': ['Photosynthesis & Cellular Respiration Comparative Diagram', 'Solar System Planetary Motion & Gravitational Forces', 'Ecosystem Energy Flow & Food Web Analysis'],
  };

  let totalHomeworksCreated = 0;
  let totalSubmissionsCreated = 0;

  for (const dept of departments) {
    const subjects = sampleSubjectsByDept[dept.name] || ['Mathematics', 'Science', 'English', 'Computer Science'];

    for (const team of dept.teams) {
      const students = team.memberships;
      if (students.length === 0) continue;

      for (let hIdx = 0; hIdx < subjects.length; hIdx++) {
        const subject = subjects[hIdx];
        const titleList = sampleHomeworkTitles[subject.split(' ')[0]] || [
          `${subject} Chapter 3 Review Assignment`,
          `${subject} Problem Set & Critical Thinking Worksheet`,
          `${subject} Practice Assessment & Case Analysis`,
        ];
        const title = titleList[hIdx % titleList.length];

        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + (hIdx * 2) - 4);

        // Find or create task
        const existingTask = await prisma.task.findFirst({
          where: {
            orgId,
            title,
          },
        });

        const task = existingTask || await prisma.task.create({
          data: {
            orgId,
            createdById: defaultTeacherId,
            title,
            description: `Complete the ${subject} assignment questions and submit your solved worksheets or typed solutions before the deadline.`,
            status: 'COMPLETED',
            dueDate,
            priority: 'MEDIUM',
            metadata: {
              isHomework: true,
              teamId: team.id,
              subject,
              totalMarks: 100,
              passingMarks: 40,
            },
          },
        });
        totalHomeworksCreated++;

        // Submissions for each student
        for (let sIdx = 0; sIdx < students.length; sIdx++) {
          const student = students[sIdx];
          // 85-95% submit homework
          const willSubmit = sIdx !== students.length - 1 || Math.random() > 0.3;
          if (!willSubmit) continue;

          const score = Math.floor(65 + Math.random() * 34); // 65 to 98
          const feedbackList = [
            'Excellent work! Clear step-by-step reasoning shown.',
            'Good effort. Pay closer attention to edge cases.',
            'Well articulated solutions with correct notation.',
            'Great demonstration of core concepts and principles.',
          ];
          const feedback = feedbackList[Math.floor(Math.random() * feedbackList.length)];

          await prisma.homeworkSubmission.upsert({
            where: {
              taskId_studentId: {
                taskId: task.id,
                studentId: student.userId,
              },
            },
            create: {
              taskId: task.id,
              studentId: student.userId,
              content: `Submitted solution for ${title} (${student.user?.fullName || 'Student'}).`,
              gradeScore: score,
              gradeMax: 100,
              feedbackNotes: feedback,
              submittedAt: new Date(dueDate.getTime() - 86400000),
              gradedAt: new Date(),
            },
            update: {
              gradeScore: score,
              gradeMax: 100,
              feedbackNotes: feedback,
            },
          });
          totalSubmissionsCreated++;
        }
      }
    }
  }

  console.log(`✅ Seeded ${totalHomeworksCreated} homework tasks and ${totalSubmissionsCreated} student submissions.`);

  // 4. Ensure Department Projects exist
  for (const dept of departments) {
    const teamIds = dept.teams.map((t) => t.id);
    const existingProjects = await prisma.project.findMany({
      where: { teamId: { in: teamIds } },
    });

    if (existingProjects.length === 0 && dept.teams.length > 0) {
      const primaryTeam = dept.teams[0];
      const p1 = await prisma.project.create({
        data: {
          teamId: primaryTeam.id,
          name: `${dept.name} Annual Science & Innovation Exhibition 2026`,
          description: `Inter-class academic showcase, model exhibitions, and research presentations for ${dept.name}.`,
          status: 'ACTIVE',
        },
      });

      // Add project tasks
      await prisma.task.createMany({
        data: [
          { orgId, projectId: p1.id, createdById: defaultTeacherId, title: 'Project Theme Selection & Proposal Approval', status: 'COMPLETED' },
          { orgId, projectId: p1.id, createdById: defaultTeacherId, title: 'Working Prototype Assembly & Lab Testing', status: 'IN_PROGRESS' },
          { orgId, projectId: p1.id, createdById: defaultTeacherId, title: 'Final Presentation Slides & Poster Design', status: 'TODO' },
        ],
      });

      const p2 = await prisma.project.create({
        data: {
          teamId: primaryTeam.id,
          name: `${dept.name} Mid-Term Practical Assessment Portfolio`,
          description: `Lab notebook submissions, experiment evaluations, and viva preparations.`,
          status: 'ACTIVE',
        },
      });

      await prisma.task.createMany({
        data: [
          { orgId, projectId: p2.id, createdById: defaultTeacherId, title: 'Practical Lab Experiment Logbook Signoff', status: 'COMPLETED' },
          { orgId, projectId: p2.id, createdById: defaultTeacherId, title: 'Internal Viva Voce Assessment & Scorecards', status: 'COMPLETED' },
        ],
      });

      console.log(`✅ Created projects for ${dept.name}`);
    }
  }

  console.log('🎉 Academic Analytics Seed Complete!');
}

seedAcademicAnalytics()
  .catch((err) => {
    console.error('Error seeding academic analytics:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

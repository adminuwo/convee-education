import 'dotenv/config';
import prisma from '../db/prisma';
import { hashPassword } from '../utils/password';

async function seedParentMockData() {
  console.log('🚀 Generating comprehensive mock data for Parent Portal...');

  // 1. Find or create Organization
  let org = await prisma.organization.findFirst({ where: { slug: 'demo-academy' } });
  if (!org) {
    org = await prisma.organization.findFirst();
  }
  if (!org) {
    console.error('❌ No organization found. Please run seed script first.');
    process.exit(1);
  }

  const demoPw = await hashPassword('Demo1234!');

  // 2. Ensure Class Teacher (Sarah Chen)
  let teacher = await prisma.user.findUnique({ where: { email: 'teacher.sarah@demo.edu' } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: {
        email: 'teacher.sarah@demo.edu',
        fullName: 'Sarah Chen (Teacher)',
        passwordHash: demoPw,
        isVerified: true,
      },
    });
  }

  // 3. Ensure Class Section (Grade 10 - Sec A)
  let dept = await prisma.department.findFirst({ where: { orgId: org.id, name: 'High School' } });
  if (!dept) {
    dept = await prisma.department.create({ data: { orgId: org.id, name: 'High School' } });
  }

  let team = await prisma.team.findFirst({ where: { departmentId: dept.id, name: 'Grade 10 - Sec A' } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        departmentId: dept.id,
        name: 'Grade 10 - Sec A',
        managerId: teacher.id,
      },
    });
  } else if (!team.managerId) {
    await prisma.team.update({
      where: { id: team.id },
      data: { managerId: teacher.id },
    });
  }

  // Ensure Teacher Membership
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: teacher.id, orgId: org.id } },
    create: { userId: teacher.id, orgId: org.id, role: 'TEACHER', title: 'Senior Class Teacher', teamId: team.id, departmentId: dept.id },
    update: { role: 'TEACHER', teamId: team.id, departmentId: dept.id },
  });

  // 4. Ensure Student Account (Alex Rivera)
  let student = await prisma.user.findUnique({ where: { email: 'student.alex@demo.edu' } });
  if (!student) {
    student = await prisma.user.create({
      data: {
        email: 'student.alex@demo.edu',
        fullName: 'Alex Rivera (Student)',
        passwordHash: demoPw,
        isVerified: true,
      },
    });
  }

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: student.id, orgId: org.id } },
    create: { userId: student.id, orgId: org.id, role: 'STUDENT', title: 'Student ID: STU-2026-ALEX', teamId: team.id, departmentId: dept.id },
    update: { role: 'STUDENT', title: 'Student ID: STU-2026-ALEX', teamId: team.id, departmentId: dept.id },
  });

  // 5. Ensure Parent Account (Carlos Rivera)
  let parent = await prisma.user.findUnique({ where: { email: 'parent.alex@demo.edu' } });
  if (!parent) {
    parent = await prisma.user.create({
      data: {
        email: 'parent.alex@demo.edu',
        fullName: 'Carlos Rivera (Parent)',
        passwordHash: demoPw,
        isVerified: true,
      },
    });
  }

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: parent.id, orgId: org.id } },
    create: { userId: parent.id, orgId: org.id, role: 'PARENT', title: 'Parent ID: PAR-2026-ALEX' },
    update: { role: 'PARENT', title: 'Parent ID: PAR-2026-ALEX' },
  });

  // 6. Link Parent & Student in ParentStudentLink table
  const link = await prisma.parentStudentLink.upsert({
    where: {
      orgId_parentUserId_studentUserId: {
        orgId: org.id,
        parentUserId: parent.id,
        studentUserId: student.id,
      },
    },
    create: {
      orgId: org.id,
      parentUserId: parent.id,
      studentUserId: student.id,
      relationship: 'Father',
    },
    update: {},
  });

  console.log(`✅ Linked Parent (${parent.email}) with Student (${student.email}) [Link ID: ${link.id}]`);

  // 7. Seed 25 realistic Attendance Records for the past 30 days
  console.log('📅 Seeding daily attendance records...');
  const now = new Date();
  for (let i = 25; i >= 1; i--) {
    const recordDate = new Date();
    recordDate.setDate(now.getDate() - i);
    recordDate.setHours(9, 0, 0, 0);

    if (recordDate.getDay() === 0 || recordDate.getDay() === 6) continue;

    const status = i === 12 ? 'LATE' : i === 5 ? 'EXCUSED' : 'PRESENT';

    await prisma.attendanceRecord.upsert({
      where: {
        teamId_studentId_date: {
          teamId: team.id,
          studentId: student.id,
          date: recordDate,
        },
      },
      create: {
        orgId: org.id,
        teamId: team.id,
        studentId: student.id,
        date: recordDate,
        status: status as any,
        recordedById: teacher.id,
        notes: status === 'LATE' ? 'Arrived 15 mins late due to bus delay' : status === 'EXCUSED' ? 'Medical leave note submitted' : undefined,
      },
      update: { status: status as any },
    }).catch(() => {});
  }

  // 8. Seed Realistic Homework Tasks & Submissions
  console.log('📚 Seeding homework assignments & graded submissions...');

  const mockHomeworks = [
    {
      title: 'Quadratic Equations & Algebra II Problem Set',
      description: 'Complete exercises 1 to 15 from Chapter 4 on solving quadratic roots.',
      dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      gradeScore: 94,
      gradeMax: 100,
      feedback: 'Outstanding work, Alex! Your step-by-step factorization of complex roots was flawless.',
    },
    {
      title: 'Physics Optics & Refraction Lab Worksheet',
      description: 'Draw ray diagrams for concave lenses and calculate focal lengths.',
      dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      gradeScore: 88,
      gradeMax: 100,
      feedback: 'Great accuracy on ray diagrams. Make sure to double-check sign conventions for focal distances.',
    },
    {
      title: 'Python Data Structures & Recursion Assignment',
      description: 'Implement stack, queue, and binary search functions in Python.',
      dueDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      gradeScore: 98,
      gradeMax: 100,
      feedback: 'Excellent code efficiency and clean function docstrings. Top score in class!',
    },
    {
      title: 'World History: Industrial Revolution Essay',
      description: 'Write a 750-word analytical essay on the social impact of 19th century steam power.',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      gradeScore: null,
      gradeMax: 100,
      feedback: null,
    },
  ];

  for (const hw of mockHomeworks) {
    let task = await prisma.task.findFirst({
      where: { orgId: org.id, title: hw.title },
    });

    if (!task) {
      task = await prisma.task.create({
        data: {
          orgId: org.id,
          createdById: teacher.id,
          title: hw.title,
          description: hw.description,
          status: hw.gradeScore !== null ? 'COMPLETED' : 'IN_PROGRESS',
          priority: 'HIGH',
          dueDate: hw.dueDate,
          metadata: { isHomework: true },
          assignees: {
            create: [{ userId: student.id }],
          },
        },
      });
    }

    if (hw.gradeScore !== null && task) {
      await prisma.homeworkSubmission.upsert({
        where: {
          taskId_studentId: {
            taskId: task.id,
            studentId: student.id,
          },
        },
        create: {
          taskId: task.id,
          studentId: student.id,
          content: 'Submitted homework assignment file attached for review.',
          submittedAt: new Date(hw.dueDate.getTime() - 4 * 60 * 60 * 1000),
          gradeScore: hw.gradeScore,
          gradeMax: hw.gradeMax,
          feedbackNotes: hw.feedback,
          gradedAt: new Date(hw.dueDate.getTime() + 12 * 60 * 60 * 1000),
        },
        update: {
          gradeScore: hw.gradeScore,
          gradeMax: hw.gradeMax,
          feedbackNotes: hw.feedback,
        },
      }).catch(() => {});
    }
  }

  console.log('\n======================================================');
  console.log('🎉 PARENT PORTAL MOCK DATA GENERATED SUCCESSFULLY!');
  console.log('------------------------------------------------------');
  console.log(`📌 Parent Email:      parent.alex@demo.edu`);
  console.log(`🔑 Password:          Demo1234!`);
  console.log(`👤 Parent Name:        Carlos Rivera`);
  console.log(`🎓 Linked Student:     Alex Rivera (student.alex@demo.edu)`);
  console.log(`🏫 Class & Section:    Grade 10 - Sec A`);
  console.log(`👩‍🏫 Class Teacher:     Sarah Chen (teacher.sarah@demo.edu)`);
  console.log('======================================================\n');
}

seedParentMockData()
  .catch((e) => {
    console.error('Error generating parent mock data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

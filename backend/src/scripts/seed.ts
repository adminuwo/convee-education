import prisma from '../db/prisma';
import { hashPassword } from '../utils/password';

async function seed() {
  console.log('Seeding database with updated Faculty & Staff roles (DIRECTOR, PRINCIPAL, DEAN, HOD, TEACHER)...');

  // 1. Super Admin
  const pw = await hashPassword('SuperAdmin123!');
  await prisma.user.upsert({
    where: { email: 'admin@platform.io' },
    update: { passwordHash: pw, systemRole: 'SUPER_ADMIN', isVerified: true },
    create: {
      email: 'admin@platform.io',
      passwordHash: pw,
      fullName: 'Platform Super Admin',
      systemRole: 'SUPER_ADMIN',
      isVerified: true,
    },
  });

  // 2. Director (Institution Owner & Director)
  const demoPw = await hashPassword('Demo1234!');
  const director = await prisma.user.upsert({
    where: { email: 'director@demo.edu' },
    update: { passwordHash: demoPw, isVerified: true },
    create: {
      email: 'director@demo.edu',
      passwordHash: demoPw,
      fullName: 'Dr. Arthur Vance (Director)',
      isVerified: true,
      bio: 'Director & Academic Board Member at Demo International Academy.',
    },
  });

  // 3. School / College Institution
  let org = await prisma.organization.findFirst({ where: { slug: 'demo-academy' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Demo International Academy',
        slug: 'demo-academy',
        description: 'Premier educational institution empowering students with science, tech & innovation.',
        ownerId: director.id,
      },
    });
  }

  // Ensure Director membership
  let directorMembership = await prisma.membership.findFirst({ where: { userId: director.id, orgId: org.id } });
  if (!directorMembership) {
    await prisma.membership.create({ data: { userId: director.id, orgId: org.id, role: 'DIRECTOR' as any, title: 'Institution Director' } });
  }

  // 4. School Departments (Wings)
  const schoolWings = [
    { name: 'Playschool', classes: ['Playgroup - Sec A', 'Nursery - Sec A'] },
    { name: 'Kindergarten', classes: ['LKG - Sec A', 'LKG - Sec B', 'UKG - Sec A', 'UKG - Sec B'] },
    { name: 'Primary School', classes: ['Grade 1 - Sec A', 'Grade 1 - Sec B', 'Grade 2 - Sec A', 'Grade 3 - Sec A', 'Grade 4 - Sec A', 'Grade 5 - Sec A'] },
    { name: 'Middle School', classes: ['Grade 6 - Sec A', 'Grade 6 - Sec B', 'Grade 7 - Sec A', 'Grade 8 - Sec A'] },
    { name: 'High School', classes: ['Grade 9 - Sec A', 'Grade 9 - Sec B', 'Grade 10 - Sec A', 'Grade 10 - Sec B'] },
    { name: 'Higher Secondary', classes: ['Grade 11 - Science A', 'Grade 11 - Commerce A', 'Grade 12 - Science A', 'Grade 12 - Commerce A'] },
  ];

  let firstClassTeam: any = null;

  for (const wing of schoolWings) {
    let dept = await prisma.department.findFirst({ where: { orgId: org.id, name: wing.name } });
    if (!dept) dept = await prisma.department.create({ data: { orgId: org.id, name: wing.name } });

    for (const className of wing.classes) {
      let team = await prisma.team.findFirst({ where: { departmentId: dept.id, name: className } });
      if (!team) team = await prisma.team.create({ data: { departmentId: dept.id, name: className } });
      if (!firstClassTeam) firstClassTeam = team;
    }
  }

  // 5. School Academic Projects & Events
  let stemFair: any = null;
  let boardExamPrep: any = null;

  if (firstClassTeam) {
    const grade10TeamForProj = await prisma.team.findFirst({ where: { name: 'Grade 10 - Sec A' } });
    const targetTeamId = grade10TeamForProj?.id || firstClassTeam.id;

    stemFair = await prisma.project.findFirst({ where: { name: 'Annual STEM Fair 2026' } });
    if (!stemFair) {
      stemFair = await prisma.project.create({
        data: { teamId: targetTeamId, name: 'Annual STEM Fair 2026', description: 'School-wide science challenge & innovation showcase' },
      });
    } else {
      await prisma.project.update({ where: { id: stemFair.id }, data: { teamId: targetTeamId } });
    }

    boardExamPrep = await prisma.project.findFirst({ where: { name: 'Class 10 Board Exam Prep' } });
    if (!boardExamPrep) {
      boardExamPrep = await prisma.project.create({
        data: { teamId: targetTeamId, name: 'Class 10 Board Exam Prep', description: 'Intensive revision & mock test series' },
      });
    } else {
      await prisma.project.update({ where: { id: boardExamPrep.id }, data: { teamId: targetTeamId } });
    }
  }

  // 7. Channels & Initial Announcements
  const channelsData = [
    { name: 'announcements', type: 'ANNOUNCEMENT' as const, description: 'Official campus notices & institutional announcements' },
    { name: 'general', type: 'PUBLIC' as const, description: 'Campus-wide staff & faculty general chat' },
    { name: 'faculty-lounge', type: 'PRIVATE' as const, description: 'Private lounge for teachers, HODs, Deans & Directors' },
    { name: 'science-department', type: 'PRIVATE' as const, description: 'Private discussion for Science faculty & department staff' },
    { name: 'commerce-department', type: 'PRIVATE' as const, description: 'Private discussion for Commerce faculty & department staff' },
  ];

  for (const cData of channelsData) {
    let ch = await prisma.channel.findFirst({ where: { orgId: org.id, name: cData.name } });
    if (!ch) {
      ch = await prisma.channel.create({
        data: { orgId: org.id, name: cData.name, type: cData.type, createdById: director.id, description: cData.description },
      });
      await prisma.channelMember.create({ data: { channelId: ch.id, userId: director.id, isAdmin: true } });
      await prisma.message.create({
        data: { channelId: ch.id, senderId: director.id, content: `Welcome to #${cData.name} at Demo International Academy! 🎓` },
      });
    }
  }

  // 8. Directors, Principals, Deans, HODs, Admins, Teachers & Students
  const educationalUsers: Array<{ email: string; fullName: string; role: any; title: string }> = [
    { email: 'admin@demo.edu', fullName: 'System Administrator (Admin)', role: 'ADMIN' as any, title: 'System Administrator' },
    { email: 'principal@demo.edu', fullName: 'Dr. Eleanor Vance (Principal)', role: 'PRINCIPAL' as any, title: 'School Principal' },
    { email: 'dean@demo.edu', fullName: 'Dr. Robert Vance (Dean)', role: 'DEAN' as any, title: 'Dean of Academic Affairs' },
    { email: 'hod.cs@demo.edu', fullName: 'Prof. Alan Turing (HOD)', role: 'HOD' as any, title: 'HOD - Computer Science' },
    { email: 'hod.physics@demo.edu', fullName: 'Dr. Marie Curie (HOD)', role: 'HOD' as any, title: 'HOD - Physical Sciences' },
    { email: 'teacher.sarah@demo.edu', fullName: 'Sarah Chen (Teacher)', role: 'TEACHER' as any, title: 'Senior CS Instructor' },
    { email: 'teacher.mike@demo.edu', fullName: 'Mike Johnson (Teacher)', role: 'TEACHER' as any, title: 'Physics & Math Instructor' },
    { email: 'teacher.emily@demo.edu', fullName: 'Dr. Emily Watson (Teacher)', role: 'TEACHER' as any, title: 'Chemistry Instructor' },
    { email: 'student.alex@demo.edu', fullName: 'Alex Rivera (Student)', role: 'STUDENT' as any, title: 'Student ID: STU-2026-ALEX' },
    { email: 'parent.alex@demo.edu', fullName: 'Carlos Rivera (Parent)', role: 'PARENT' as any, title: 'Parent ID: PAR-2026-ALEX' },
  ];

  const createdUsers: Record<string, string> = { [director.email]: director.id };

  for (const uData of educationalUsers) {
    const u = await prisma.user.upsert({
      where: { email: uData.email },
      update: {},
      create: { email: uData.email, fullName: uData.fullName, passwordHash: demoPw, isVerified: true },
    });
    createdUsers[uData.email] = u.id;

    const exists = await prisma.membership.findFirst({ where: { userId: u.id, orgId: org.id } });
    if (!exists) {
      await prisma.membership.create({ data: { userId: u.id, orgId: org.id, role: uData.role as any, title: uData.title } });
    }
  }

  // Assign demo Student, Teacher, and HOD to Grade 10 - Sec A class
  const grade10Team = await prisma.team.findFirst({ where: { name: 'Grade 10 - Sec A' } });
  if (grade10Team) {
    const studentUser = createdUsers['student.alex@demo.edu'];
    const teacherUser = createdUsers['teacher.sarah@demo.edu'];
    const hodUser = createdUsers['hod.cs@demo.edu'];

    for (const uid of [studentUser, teacherUser, hodUser]) {
      if (uid) {
        await prisma.membership.updateMany({
          where: { userId: uid, orgId: org.id },
          data: { teamId: grade10Team.id, departmentId: grade10Team.departmentId },
        });
      }
    }

    // Ensure class channel exists and members are added
    const chName = `team-${grade10Team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    let ch = await prisma.channel.findFirst({ where: { orgId: org.id, type: 'TEAM', name: chName } });
    if (!ch) {
      ch = await prisma.channel.create({
        data: { orgId: org.id, name: chName, type: 'TEAM', createdById: director.id, description: `Official channel for ${grade10Team.name}` },
      });
    }

    for (const uid of [studentUser, teacherUser, hodUser]) {
      if (uid && ch) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: ch.id, userId: uid } },
          create: { channelId: ch.id, userId: uid, isAdmin: uid === teacherUser },
          update: {},
        }).catch(() => {});
      }
    }
  }

  // Enroll staff members into demo standard channels (exclude students from private faculty channels)
  const allStaffIds = Object.entries(createdUsers)
    .filter(([email]) => email !== 'student.alex@demo.edu')
    .map(([, id]) => id);

  const demoChannels = await prisma.channel.findMany({
    where: { orgId: org.id, type: { in: ['PUBLIC', 'ANNOUNCEMENT', 'PRIVATE'] } },
  });

  for (const channel of demoChannels) {
    if (channel.type === 'PRIVATE') {
      // Remove any student membership from private staff channels
      const studentId = createdUsers['student.alex@demo.edu'];
      if (studentId) {
        await prisma.channelMember.deleteMany({
          where: { channelId: channel.id, userId: studentId },
        }).catch(() => {});
      }
    }

    for (const uid of allStaffIds) {
      if (uid) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: channel.id, userId: uid } },
          create: { channelId: channel.id, userId: uid, isAdmin: uid === director.id },
          update: {},
        }).catch(() => {});
      }
    }
  }

  // 9. Institutional Tasks & Faculty Projects
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const demoAssignments = [
    {
      title: 'Review Midterm Examination Schedules & Question Bank',
      description: 'Audit examination papers for upcoming semester finals.',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      dueDate: nextWeek,
      projectId: boardExamPrep?.id || null,
      assigneeIds: [createdUsers['teacher.sarah@demo.edu'], createdUsers['hod.cs@demo.edu']],
      checklist: ['Audit Theory question papers', 'Review exam rubrics', 'Get Dean approval'],
    },
    {
      title: 'Physics Optics Lab Infrastructure Upgrade',
      description: 'Procure spectrometer prisms and laser sensors for Science Lab.',
      status: 'COMPLETED' as const,
      priority: 'MEDIUM' as const,
      dueDate: tomorrow,
      projectId: boardExamPrep?.id || null,
      assigneeIds: [createdUsers['teacher.mike@demo.edu']],
      checklist: ['Vendor quote comparison', 'Submit purchase request', 'Verify equipment delivery'],
    },
    {
      title: 'Finalize Annual STEM Fair Faculty Committees',
      description: 'Assign faculty judges, allocate lab spaces, and approve student project guidelines.',
      status: 'IN_PROGRESS' as const,
      priority: 'URGENT' as const,
      dueDate: tomorrow,
      projectId: stemFair?.id || null,
      assigneeIds: [createdUsers['principal@demo.edu'], createdUsers['dean@demo.edu']],
      checklist: ['Select faculty judging panel', 'Publish guidelines', 'Release event schedule'],
    },
  ];

  for (const taskData of demoAssignments) {
    const existingTask = await prisma.task.findFirst({ where: { orgId: org.id, title: taskData.title } });
    if (!existingTask) {
      await prisma.task.create({
        data: {
          orgId: org.id,
          createdById: director.id,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          dueDate: taskData.dueDate,
          projectId: taskData.projectId,
          assignees: {
            create: taskData.assigneeIds.map(uid => ({ userId: uid })),
          },
          checklist: {
            create: taskData.checklist.map((content, idx) => ({ content, position: idx, isDone: idx === 0 })),
          },
        },
      });
    }
  }

  // 10. Live Academic Meetings
  const meetingStart1 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const meetingEnd1 = new Date(meetingStart1.getTime() + 60 * 60 * 1000);

  const academicSyncStart = new Date(now.getTime() + 26 * 60 * 60 * 1000); // tomorrow
  const academicSyncEnd = new Date(academicSyncStart.getTime() + 90 * 60 * 1000);

  const demoMeetings = [
    {
      title: 'CS Faculty Curriculum Sync & Lab Review',
      description: 'Departmental review of Python programming syllabus and practical lab assignments.',
      startTime: meetingStart1,
      endTime: meetingEnd1,
      location: 'Faculty Boardroom / Google Meet',
      meetingUrl: 'https://meet.google.com/demo-cs-faculty',
      agenda: '1. Fundamentals of Python Curriculum\n2. Lab Assignment Guidelines\n3. Q&A',
      attendeeIds: [createdUsers['hod.cs@demo.edu'], createdUsers['teacher.sarah@demo.edu']],
    },
    {
      title: 'Academic Council HOD, Dean & Director Sync',
      description: 'Curriculum review, exam schedule approval, and departmental budget allocation.',
      startTime: academicSyncStart,
      endTime: academicSyncEnd,
      location: 'Academic Senate Room / Virtual Live Stream',
      meetingUrl: 'https://meet.google.com/demo-academic-sync',
      agenda: '1. Semester Curriculum Review\n2. STEM Fair Budget Approval\n3. Departmental Feedback',
      attendeeIds: [director.id, createdUsers['principal@demo.edu'], createdUsers['dean@demo.edu'], createdUsers['hod.cs@demo.edu'], createdUsers['hod.physics@demo.edu']],
    },
  ];

  for (const mData of demoMeetings) {
    const existingMeeting = await prisma.meeting.findFirst({ where: { orgId: org.id, title: mData.title } });
    if (!existingMeeting) {
      await prisma.meeting.create({
        data: {
          orgId: org.id,
          createdById: director.id,
          title: mData.title,
          description: mData.description,
          startTime: mData.startTime,
          endTime: mData.endTime,
          location: mData.location,
          meetingUrl: mData.meetingUrl,
          agenda: mData.agenda,
          attendees: {
            create: mData.attendeeIds.map(uid => ({ userId: uid })),
          },
        },
      });
    }
  }

  console.log('\n====================================================');
  console.log('✅ Educational Database Seeding Completed!');
  console.log('====================================================');
  console.log('Institution: Demo International Academy (slug: demo-academy)');
  console.log('Super Admin: admin@platform.io / SuperAdmin123!');
  console.log('Director:    director@demo.edu / Demo1234!');
  console.log('Principal:   principal@demo.edu / Demo1234!');
  console.log('Dean:        dean@demo.edu / Demo1234!');
  console.log('HODs:        hod.cs@demo.edu, hod.physics@demo.edu (Password: Demo1234!)');
  console.log('Teachers:    teacher.sarah@demo.edu, teacher.mike@demo.edu, teacher.emily@demo.edu (Password: Demo1234!)');
  console.log('====================================================\n');
}

seed().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));

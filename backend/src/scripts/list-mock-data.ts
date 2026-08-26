import prisma from '../db/prisma';

async function listMockData() {
  const org = await prisma.organization.findFirst({
    include: {
      departments: {
        include: {
          teams: true,
        },
      },
      channels: true,
    },
  });

  console.log('================================================================================');
  console.log(`🏫 ORGANIZATION: ${org?.name} (Slug: ${org?.slug})`);
  console.log('================================================================================\n');

  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: {
          organization: true,
          department: true,
          team: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  const parentLinks = await prisma.parentStudentLink.findMany();

  const parentMap: Record<string, string[]> = {};
  const studentMap: Record<string, string[]> = {};
  for (const l of parentLinks) {
    const parentName = userMap.get(l.parentUserId) || l.parentUserId;
    const studentName = userMap.get(l.studentUserId) || l.studentUserId;

    if (!parentMap[l.parentUserId]) parentMap[l.parentUserId] = [];
    parentMap[l.parentUserId].push(studentName);

    if (!studentMap[l.studentUserId]) studentMap[l.studentUserId] = [];
    studentMap[l.studentUserId].push(parentName);
  }

  const rolesMap: Record<string, any[]> = {};

  for (const u of users) {
    for (const m of u.memberships) {
      if (!rolesMap[m.role]) rolesMap[m.role] = [];
      rolesMap[m.role].push({
        email: u.email,
        name: u.fullName,
        title: m.title,
        department: m.department?.name || 'Institution-wide',
        team: m.team?.name || 'All Classes',
        children: parentMap[u.id] || [],
        parents: studentMap[u.id] || [],
      });
    }
  }

  for (const [role, list] of Object.entries(rolesMap)) {
    console.log(`\n📌 ROLE: ${role} (${list.length} accounts)`);
    for (const item of list) {
      console.log(`  • ${item.name} | Email: ${item.email}`);
      console.log(`    Title: ${item.title}`);
      console.log(`    Department: ${item.department} | Class/Team: ${item.team}`);
      if (item.children.length) console.log(`    Linked Children: ${item.children.join(', ')}`);
      if (item.parents.length) console.log(`    Linked Parents: ${item.parents.join(', ')}`);
    }
  }

  // Also check sample counts
  const tasksCount = await prisma.task.count({ where: { orgId: org?.id } });
  const feeCount = await (prisma as any).studentFeeLedger.count({ where: { orgId: org?.id } }).catch(() => 0);
  const examCount = await prisma.exam.count({ where: { orgId: org?.id } }).catch(() => 0);
  const channelCount = await prisma.channel.count({ where: { orgId: org?.id } });
  const meetingCount = await prisma.meeting.count({ where: { orgId: org?.id } });

  console.log('\n================================================================================');
  console.log('📊 MOCK ACADEMIC DATA COUNTS:');
  console.log(`  • Tasks / Homework: ${tasksCount}`);
  console.log(`  • Student Fee Ledgers: ${feeCount}`);
  console.log(`  • Exams & Grading Matrices: ${examCount}`);
  console.log(`  • Channels: ${channelCount}`);
  console.log(`  • Live Meetings: ${meetingCount}`);
  console.log(`  • Academic Wings / Departments: ${org?.departments.length}`);
  console.log('================================================================================');
}

listMockData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

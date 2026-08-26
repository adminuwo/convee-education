import prisma from '../db/prisma';

async function generateMockDataSummary() {
  const roles = ['DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'ALUMNI'] as const;

  console.log('### Summary of Primary Demo Accounts:\n');
  for (const r of roles) {
    const mems = await prisma.membership.findMany({
      where: { role: r as any, isActive: true },
      include: { user: true, department: true, team: true },
      take: 2,
    });

    for (const m of mems) {
      console.log(`Role: ${r}`);
      console.log(`  Name: ${m.user.fullName}`);
      console.log(`  Email: ${m.user.email}`);
      console.log(`  Title: ${m.title}`);
      console.log(`  Department: ${m.department?.name || 'All Departments'}`);
      console.log(`  Class/Team: ${m.team?.name || 'All Classes'}`);
      console.log('---');
    }
  }

  const superAdmin = await prisma.user.findFirst({ where: { systemRole: 'SUPER_ADMIN' } });
  if (superAdmin) {
    console.log(`Role: SUPER_ADMIN`);
    console.log(`  Name: ${superAdmin.fullName}`);
    console.log(`  Email: ${superAdmin.email}`);
    console.log(`  Scope: Cross-Institution Platform Governance`);
  }
}

generateMockDataSummary()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

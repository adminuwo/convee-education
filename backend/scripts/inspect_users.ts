import prisma from '../src/db/prisma';

async function inspect() {
  const users = await prisma.user.findMany({
    take: 10,
    select: { id: true, email: true, fullName: true, systemRole: true, memberships: { select: { role: true, title: true, orgId: true } } }
  });
  console.log('Sample Users:');
  users.forEach(u => console.log(JSON.stringify(u, null, 2)));
}

inspect().then(() => prisma.$disconnect());

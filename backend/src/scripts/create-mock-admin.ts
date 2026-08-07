import prisma from '../db/prisma';
import { hashPassword } from '../utils/password';

async function createMockAdmin() {
  console.log('🚀 Creating Mock Admin user in Database...');

  const email = 'admin@demo.edu';
  const plainPassword = 'Admin1234!';
  const fullName = 'System Administrator (Admin)';

  const passwordHash = await hashPassword(plainPassword);

  // 1. Create or Update User
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      fullName,
      isVerified: true,
      systemRole: 'USER',
    },
    create: {
      email,
      fullName,
      passwordHash,
      isVerified: true,
      systemRole: 'USER',
    },
  });

  console.log(`✅ User account verified: ${user.email} (${user.id})`);

  // 2. Find or Create Organization
  let org = await prisma.organization.findFirst({ where: { slug: 'demo-academy' } });
  if (!org) {
    org = await prisma.organization.findFirst();
  }
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Demo International Academy',
        slug: 'demo-academy',
        description: 'Premier educational institution empowering students with science & innovation.',
        ownerId: user.id,
      },
    });
  }

  // 3. Create or Update Membership as ADMIN
  const membership = await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: { role: 'ADMIN', isActive: true, title: 'System Administrator' },
    create: {
      userId: user.id,
      orgId: org.id,
      role: 'ADMIN',
      title: 'System Administrator',
      isActive: true,
    },
  });

  console.log(`✅ Assigned ADMIN role in organization "${org.name}" (Membership ID: ${membership.id})`);

  // 4. Enroll in org channels
  const channels = await prisma.channel.findMany({
    where: { orgId: org.id, deletedAt: null },
  });

  for (const c of channels) {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: c.id, userId: user.id } },
      create: { channelId: c.id, userId: user.id, isAdmin: true },
      update: { isAdmin: true },
    }).catch(() => {});
  }

  console.log('\n======================================================');
  console.log('🎉 MOCK ADMIN ACCOUNT CREATED SUCCESSFULLY!');
  console.log('------------------------------------------------------');
  console.log(`📌 Login Email:    admin@demo.edu`);
  console.log(`🔑 Password:       Admin1234!`);
  console.log(`🛡️ Organization:   ${org.name}`);
  console.log(`👑 Assigned Role:  ADMIN`);
  console.log('======================================================\n');
}

createMockAdmin()
  .catch((e) => {
    console.error('Error creating mock admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

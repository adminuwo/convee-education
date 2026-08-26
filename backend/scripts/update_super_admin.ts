import prisma from '../src/db/prisma';
import bcrypt from 'bcryptjs';

export async function updateSuperAdmin() {
  const email = 'superadmin@convee.io';
  const password = 'Convee#SuperAdmin$2026!SecOps';
  const hashedPassword = await bcrypt.hash(password, 12); // High security bcrypt factor 12

  console.log('🔒 Provisioning High-Security Platform Super Admin credentials...');

  // 1. Ensure superadmin@convee.io exists and has SUPER_ADMIN systemRole
  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      systemRole: 'SUPER_ADMIN',
      fullName: 'Chief Platform Super Administrator',
      isVerified: true,
      status: 'online',
      bio: 'Global Multi-Tenant Platform Master Administrator (Root Authority)',
    },
    create: {
      email,
      passwordHash: hashedPassword,
      fullName: 'Chief Platform Super Administrator',
      systemRole: 'SUPER_ADMIN',
      isVerified: true,
      status: 'online',
      bio: 'Global Multi-Tenant Platform Master Administrator (Root Authority)',
    },
  });

  // Also sync admin@platform.io to have the same secure password & SUPER_ADMIN role for compatibility
  await prisma.user.upsert({
    where: { email: 'admin@platform.io' },
    update: {
      passwordHash: hashedPassword,
      systemRole: 'SUPER_ADMIN',
      isVerified: true,
    },
    create: {
      email: 'admin@platform.io',
      passwordHash: hashedPassword,
      fullName: 'Platform Super Admin',
      systemRole: 'SUPER_ADMIN',
      isVerified: true,
      status: 'online',
    },
  });

  console.log('========================================================================================');
  console.log('✅ SUPER ADMIN CREDENTIALS SUCCESSFULLY UPDATED & COMMITTED TO DATABASE');
  console.log('========================================================================================');
  console.log(`👤 User ID / Email : ${superAdmin.email}`);
  console.log(`🔑 Password        : ${password}`);
  console.log(`🛡️  System Role     : ${superAdmin.systemRole}`);
  console.log(`🆔 Database UUID   : ${superAdmin.id}`);
  console.log('========================================================================================');

  return { email, password, id: superAdmin.id };
}

if (require.main === module) {
  updateSuperAdmin()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('❌ Failed to update Super Admin:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}

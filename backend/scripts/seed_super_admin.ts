import prisma from '../src/db/prisma';
import bcrypt from 'bcryptjs';

export async function seedSuperAdmin() {
  const email = 'superadmin@convee.io';
  const password = 'Convee#SuperAdmin$2026!SecOps';
  const hashedPassword = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hashedPassword,
        systemRole: 'SUPER_ADMIN',
        isVerified: true,
      },
    });
    console.log(`✅ Super Admin user (${email}) updated successfully.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName: 'Global Platform Super Admin',
        systemRole: 'SUPER_ADMIN',
        isVerified: true,
        status: 'online',
        bio: 'Chief SaaS Platform Administrator & Operations Head',
      },
    });
    console.log(`✅ Super Admin user (${email}) created successfully.`);
  }

  // Also sync superadmin@convee.com and admin@platform.io for convenience
  for (const altEmail of ['superadmin@convee.com', 'admin@platform.io']) {
    await prisma.user.upsert({
      where: { email: altEmail },
      update: { passwordHash: hashedPassword, systemRole: 'SUPER_ADMIN', isVerified: true },
      create: {
        email: altEmail,
        passwordHash: hashedPassword,
        fullName: 'Global Platform Super Admin',
        systemRole: 'SUPER_ADMIN',
        isVerified: true,
        status: 'online',
      },
    });
  }
}

if (require.main === module) {
  seedSuperAdmin()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}

import prisma from '../src/db/prisma';
import bcrypt from 'bcryptjs';

export async function seedSuperAdmin() {
  const email = 'superadmin@convee.com';
  const password = 'SuperAdmin123!';
  const hashedPassword = await bcrypt.hash(password, 10);

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

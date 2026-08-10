import 'dotenv/config';
import prisma from '../db/prisma';
import { hashPassword } from '../utils/password';

async function main() {
  const hash = await hashPassword('Demo1234!');
  const parent = await prisma.user.upsert({
    where: { email: 'parent.alex@demo.edu' },
    update: { passwordHash: hash, isVerified: true },
    create: { email: 'parent.alex@demo.edu', fullName: 'Carlos Rivera (Parent)', passwordHash: hash, isVerified: true },
  });
  const org = await prisma.organization.findFirst({ where: { slug: 'demo-academy' } });
  if (org) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: parent.id, orgId: org.id } },
      update: { role: 'PARENT' },
      create: { userId: parent.id, orgId: org.id, role: 'PARENT', title: 'Parent of Alex Rivera' },
    });
    const student = await prisma.user.findUnique({ where: { email: 'student.alex@demo.edu' } });
    if (student) {
      try {
        await prisma.$executeRawUnsafe(
          'CREATE TABLE IF NOT EXISTS "ParentStudent" ("parentId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "orgId" TEXT NOT NULL, PRIMARY KEY ("parentId", "studentId"))'
        );
        await prisma.$executeRawUnsafe(
          'INSERT INTO "ParentStudent" ("parentId", "studentId", "orgId") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          parent.id, student.id, org.id
        );
      } catch (e) {}
    }
  }
  console.log('✅ Demo parent account created!');
}

main().finally(() => prisma.$disconnect());

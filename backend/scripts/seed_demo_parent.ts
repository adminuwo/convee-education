import prisma from '../src/db/prisma';
import bcrypt from 'bcryptjs';

async function seedParent() {
  const org = await prisma.organization.findFirst({ where: { name: 'Demo International Academy' } });
  if (!org) throw new Error('Demo Org not found');

  const student = await prisma.user.findFirst({
    where: { email: 'stu.aarav.deshmukh.93@demo.edu' },
    include: { memberships: true },
  });
  if (!student) throw new Error('Student Aarav Deshmukh not found');

  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  const parentUser = await prisma.user.upsert({
    where: { email: 'parent.aarav@demo.edu' },
    create: {
      email: 'parent.aarav@demo.edu',
      fullName: 'Vikram Deshmukh (Parent)',
      passwordHash,
      systemRole: 'USER',
      isVerified: true,
      bio: 'Guardian of Aarav Deshmukh (Grade 11 - Unified)',
    },
    update: {
      passwordHash,
      isVerified: true,
    },
  });

  const parentMem = await prisma.membership.upsert({
    where: {
      userId_orgId: {
        userId: parentUser.id,
        orgId: org.id,
      },
    },
    create: {
      userId: parentUser.id,
      orgId: org.id,
      role: 'PARENT',
      title: 'Parent ID: PAR-2026-0093 | Child: Aarav Deshmukh',
      isActive: true,
    },
    update: {
      role: 'PARENT',
      title: 'Parent ID: PAR-2026-0093 | Child: Aarav Deshmukh',
      isActive: true,
    },
  });

  await prisma.parentStudentLink.upsert({
    where: {
      orgId_parentUserId_studentUserId: {
        orgId: org.id,
        parentUserId: parentUser.id,
        studentUserId: student.id,
      },
    },
    create: {
      orgId: org.id,
      parentUserId: parentUser.id,
      studentUserId: student.id,
      relationship: 'FATHER',
    },
    update: {},
  });

  console.log(`✅ Demo Parent seeded successfully: ${parentUser.email} (Password: Demo1234!) linked to Student ${student.fullName}`);
}

seedParent().then(() => prisma.$disconnect()).catch(console.error);

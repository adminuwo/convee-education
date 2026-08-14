import { PrismaClient, OrgRole, SystemRole } from './generated/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ensuring core system data without deleting any user classes or departments...');

  const hashedPassword = await bcrypt.hash('Demo1234!', 10);

  // 1. Organization
  let org = await prisma.organization.findFirst({
    where: { slug: 'demo-academy' },
  });

  if (!org) {
    let ownerUser = await prisma.user.findUnique({ where: { email: 'director@demo.edu' } });
    if (!ownerUser) {
      ownerUser = await prisma.user.create({
        data: {
          email: 'director@demo.edu',
          passwordHash: hashedPassword,
          fullName: 'Dr. Arthur Vance (Director)',
          systemRole: SystemRole.USER,
          isVerified: true,
          status: 'online',
          bio: 'Director of Academic Operations & Institutional Strategy',
        },
      });
    }

    org = await prisma.organization.create({
      data: {
        name: 'Demo International Academy',
        slug: 'demo-academy',
        description: 'Premier K-12 and Higher Secondary Educational Institute',
        ownerId: ownerUser.id,
      },
    });
  }

  const orgId = org.id;

  // Restore all soft-deleted departments and teams
  await prisma.department.updateMany({ where: { orgId }, data: { deletedAt: null } });
  await prisma.team.updateMany({ data: { deletedAt: null } });

  // Core User accounts
  const userDataList = [
    { email: 'director@demo.edu', fullName: 'Dr. Arthur Vance (Director)', role: OrgRole.DIRECTOR, title: 'Director' },
    { email: 'principal@demo.edu', fullName: 'Dr. Eleanor Vance (Principal)', role: OrgRole.PRINCIPAL, title: 'Principal' },
    { email: 'dean@demo.edu', fullName: 'Dr. Robert Vance (Dean)', role: OrgRole.DEAN, title: 'Dean of Academics' },
    { email: 'hod.cs@demo.edu', fullName: 'Prof. Alan Turing (HOD)', role: OrgRole.HOD, title: 'HOD - Computer Science' },
    { email: 'hod.physics@demo.edu', fullName: 'Dr. Marie Curie (HOD)', role: OrgRole.HOD, title: 'HOD - Physics' },
    { email: 'admin@demo.edu', fullName: 'System Administrator (Admin)', role: OrgRole.ADMIN, title: 'System Administrator' },
    { email: 'accountant@demo.edu', fullName: 'Marcus Vance (Accountant)', role: OrgRole.ACCOUNTANT, title: 'Chief Financial Officer' },
    { email: 'emily.watson@demo.edu', fullName: 'Dr. Emily Watson (Teacher)', role: OrgRole.TEACHER, title: 'Senior Science Teacher' },
    { email: 'sarah.chen@demo.edu', fullName: 'Sarah Chen (Teacher)', role: OrgRole.TEACHER, title: 'Mathematics Teacher' },
    { email: 'mike.johnson@demo.edu', fullName: 'Mike Johnson (Teacher)', role: OrgRole.TEACHER, title: 'English Faculty' },
    { email: 'student@demo.edu', fullName: 'Alex Rivera (Student)', role: OrgRole.STUDENT, title: 'Student - Grade 10-A' },
    { email: 'parent@demo.edu', fullName: 'Carlos Rivera (Parent)', role: OrgRole.PARENT, title: 'Parent' },
  ];

  for (const u of userDataList) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash: hashedPassword,
          fullName: u.fullName,
          systemRole: u.role === OrgRole.ACCOUNTANT ? SystemRole.ACCOUNTANT : SystemRole.USER,
          isVerified: true,
          status: 'online',
          bio: u.title,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { fullName: u.fullName, passwordHash: hashedPassword, isVerified: true },
      });
    }

    await prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId } },
      update: { role: u.role, title: u.title, isActive: true },
      create: {
        userId: user.id,
        orgId,
        role: u.role,
        title: u.title,
        isActive: true,
      },
    });
  }

  // Ensure Heads of Departments are set cleanly to HODs and Deans (NO regular teachers as HODs)
  const hodCs = await prisma.user.findUnique({ where: { email: 'hod.cs@demo.edu' } });
  const hodPhysics = await prisma.user.findUnique({ where: { email: 'hod.physics@demo.edu' } });
  const dean = await prisma.user.findUnique({ where: { email: 'dean@demo.edu' } });
  const principal = await prisma.user.findUnique({ where: { email: 'principal@demo.edu' } });
  const director = await prisma.user.findUnique({ where: { email: 'director@demo.edu' } });

  const highSchool = await prisma.department.findFirst({ where: { orgId, name: { contains: 'High School' } } });
  const higherSec = await prisma.department.findFirst({ where: { orgId, name: { contains: 'Higher Secondary' } } });
  const middleSchool = await prisma.department.findFirst({ where: { orgId, name: { contains: 'Middle School' } } });
  const primarySchool = await prisma.department.findFirst({ where: { orgId, name: { contains: 'Primary' } } });
  const playschool = await prisma.department.findFirst({ where: { orgId, name: { contains: 'Playschool' } } });

  if (highSchool && hodCs) await prisma.department.update({ where: { id: highSchool.id }, data: { headId: hodCs.id } });
  if (higherSec && hodPhysics) await prisma.department.update({ where: { id: higherSec.id }, data: { headId: hodPhysics.id } });
  if (middleSchool && dean) await prisma.department.update({ where: { id: middleSchool.id }, data: { headId: dean.id } });
  if (primarySchool && principal) await prisma.department.update({ where: { id: primarySchool.id }, data: { headId: principal.id } });
  if (playschool && director) await prisma.department.update({ where: { id: playschool.id }, data: { headId: director.id } });

  // Ensure all faculty & staff members are enrolled in faculty-lounge channel
  const facultyLounge = await prisma.channel.findFirst({ where: { orgId, name: 'faculty-lounge' } });
  if (facultyLounge) {
    const staffMemberships = await prisma.membership.findMany({
      where: { orgId, role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true },
    });
    for (const m of staffMemberships) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: facultyLounge.id, userId: m.userId } },
        create: { channelId: facultyLounge.id, userId: m.userId },
        update: {},
      }).catch(() => {});
    }
  }

  console.log('✅ ALL ORIGINAL CLASSES AND DEPARTMENTS ARE SAFE & RESTORED!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

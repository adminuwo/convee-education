import prisma from '../src/db/prisma';
import bcrypt from 'bcryptjs';

export async function resetAndSeedFull() {
  console.log('🔄 ==========================================');
  console.log('🔄 STARTING FULL DATABASE RESET & SEEDING');
  console.log('🔄 ==========================================');

  const hashedPassword = await bcrypt.hash('Demo1234!', 10);

  // 1. Clean All Transactional & Academic Data
  console.log('🧹 Purging old academic and financial records...');
  await (prisma as any).channelMember?.deleteMany().catch(() => {});
  await (prisma as any).message?.deleteMany().catch(() => {});
  await (prisma as any).channel?.deleteMany().catch(() => {});
  await (prisma as any).parentStudentLink?.deleteMany().catch(() => {});
  await (prisma as any).academicBatchArchive?.deleteMany().catch(() => {});
  await (prisma as any).academicPromotionConfig?.deleteMany().catch(() => {});
  await (prisma as any).studentFeeLedger?.deleteMany().catch(() => {});
  await (prisma as any).payrollRecord?.deleteMany().catch(() => {});
  await (prisma as any).expenseRecord?.deleteMany().catch(() => {});
  await (prisma as any).cashTransaction?.deleteMany().catch(() => {});
  await (prisma as any).cashRegister?.deleteMany().catch(() => {});
  await (prisma as any).bankAccount?.deleteMany().catch(() => {});
  await (prisma as any).fixedAsset?.deleteMany().catch(() => {});
  await (prisma as any).societyFund?.deleteMany().catch(() => {});
  await (prisma as any).taskAssignee?.deleteMany().catch(() => {});
  await (prisma as any).taskChecklist?.deleteMany().catch(() => {});
  await (prisma as any).taskChecklistItem?.deleteMany().catch(() => {});
  await (prisma as any).task?.deleteMany().catch(() => {});
  await (prisma as any).meetingAttendee?.deleteMany().catch(() => {});
  await (prisma as any).meeting?.deleteMany().catch(() => {});
  await (prisma as any).timetableSlot?.deleteMany().catch(() => {});
  await (prisma as any).project?.deleteMany().catch(() => {});
  await (prisma as any).membership?.deleteMany().catch(() => {});
  await (prisma as any).team?.deleteMany().catch(() => {});
  await (prisma as any).department?.deleteMany().catch(() => {});
  await (prisma as any).organization?.deleteMany().catch(() => {});
  await (prisma as any).user?.deleteMany().catch(() => {});

  console.log('✅ Purge complete.');

  // 2. Create Core Institutional Roles & Users
  console.log('👥 Creating core faculty, staff and admin users...');
  const director = await prisma.user.create({
    data: {
      email: 'director@demo.edu',
      passwordHash: hashedPassword,
      fullName: 'Dr. Arthur Vance (Director)',
      systemRole: 'USER',
      isVerified: true,
      status: 'online',
      bio: 'Director & Academic Board Member at Demo International Academy.',
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'Demo International Academy',
      slug: 'demo-academy',
      description: 'Premier K-12 and Higher Secondary Educational Institute',
      ownerId: director.id,
    },
  });
  const orgId = org.id;

  const coreStaff = [
    { email: 'director@demo.edu', fullName: 'Dr. Arthur Vance (Director)', role: 'DIRECTOR', title: 'Institution Director', user: director },
    { email: 'principal@demo.edu', fullName: 'Dr. Eleanor Vance (Principal)', role: 'PRINCIPAL', title: 'School Principal' },
    { email: 'dean@demo.edu', fullName: 'Dr. Robert Vance (Dean)', role: 'DEAN', title: 'Dean of Academics' },
    { email: 'hod.cs@demo.edu', fullName: 'Prof. Alan Turing (HOD)', role: 'HOD', title: 'HOD - Computer Science' },
    { email: 'hod.physics@demo.edu', fullName: 'Dr. Marie Curie (HOD)', role: 'HOD', title: 'HOD - Physical Sciences' },
    { email: 'admin@demo.edu', fullName: 'System Administrator (Admin)', role: 'ADMIN', title: 'System Administrator' },
    { email: 'accountant@demo.edu', fullName: 'Marcus Vance (Accountant)', role: 'ACCOUNTANT', title: 'Chief Financial Officer' },
    { email: 'teacher.sarah@demo.edu', fullName: 'Sarah Chen (Teacher)', role: 'TEACHER', title: 'Senior CS Instructor' },
    { email: 'teacher.mike@demo.edu', fullName: 'Mike Johnson (Teacher)', role: 'TEACHER', title: 'Physics & Math Instructor' },
    { email: 'teacher.emily@demo.edu', fullName: 'Dr. Emily Watson (Teacher)', role: 'TEACHER', title: 'Chemistry Instructor' },
    { email: 'student.alex@demo.edu', fullName: 'Alex Rivera (Student)', role: 'STUDENT', title: 'Student - Grade 10 - Sec A' },
    { email: 'parent.alex@demo.edu', fullName: 'Carlos Rivera (Parent)', role: 'PARENT', title: 'Parent ID: PAR-2026-ALEX' },
  ];

  const userMap: Record<string, any> = {};
  for (const s of coreStaff) {
    let u = s.user;
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: s.email,
          passwordHash: hashedPassword,
          fullName: s.fullName,
          systemRole: s.role === 'ACCOUNTANT' ? 'ACCOUNTANT' : 'USER',
          isVerified: true,
          status: 'online',
          bio: s.title,
        },
      });
    }
    userMap[s.email] = u;

    await prisma.membership.create({
      data: {
        userId: u.id,
        orgId,
        role: s.role as any,
        title: s.title,
        isActive: true,
      },
    });
  }

  // 3. Create Departments (Wings) and 24 Classroom Teams
  console.log('🏫 Creating academic wings, departments and 24 class sections...');
  const schoolWings = [
    { name: 'Playschool', classes: ['Playgroup - Sec A', 'Nursery - Sec A'] },
    { name: 'Kindergarten', classes: ['LKG - Sec A', 'LKG - Sec B', 'UKG - Sec A', 'UKG - Sec B'] },
    { name: 'Primary School', classes: ['Grade 1 - Sec A', 'Grade 1 - Sec B', 'Grade 2 - Sec A', 'Grade 3 - Sec A', 'Grade 4 - Sec A', 'Grade 5 - Sec A'] },
    { name: 'Middle School', classes: ['Grade 6 - Sec A', 'Grade 6 - Sec B', 'Grade 7 - Sec A', 'Grade 8 - Sec A'] },
    { name: 'High School', classes: ['Grade 9 - Sec A', 'Grade 9 - Sec B', 'Grade 10 - Sec A', 'Grade 10 - Sec B'] },
    { name: 'Higher Secondary', classes: ['Grade 11 - Science A', 'Grade 11 - Commerce A', 'Grade 12 - Science A', 'Grade 12 - Commerce A'] },
  ];

  const teamMap: Record<string, any> = {};
  for (const wing of schoolWings) {
    const dept = await prisma.department.create({ data: { orgId, name: wing.name } });
    for (const cName of wing.classes) {
      const team = await prisma.team.create({
        data: { departmentId: dept.id, name: cName },
      });
      teamMap[cName] = { team, dept };
    }
  }

  // 4. Seed 124 Active Students across all 24 Class Sections
  console.log('🎓 Generating and enrolling 124 students across all 24 classes...');
  const indianNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharv', 'Kabir', 'Rudra', 'Dhruv', 'Rohan', 'Navya', 'Diya', 'Saanvi', 'Ananya',
    'Aadhya', 'Pari', 'Anika', 'Meera', 'Myra', 'Sara', 'Prisha', 'Riya', 'Aarohi', 'Ira',
  ];
  const lastNames = [
    'Sharma', 'Verma', 'Patel', 'Singh', 'Gupta', 'Kumar', 'Iyer', 'Menon', 'Rao', 'Reddy',
    'Nair', 'Pillai', 'Dubey', 'Trivedi', 'Bose', 'Chopra', 'Malhotra', 'Bhatia', 'Deshmukh', 'Kaur',
  ];

  let studentIdx = 1;
  const createdStudents: any[] = [];

  for (const [className, info] of Object.entries(teamMap)) {
    const count = className.includes('Grade 4') || className.includes('Grade 5') || className.includes('Grade 7') || className.includes('LKG - Sec A') ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const first = indianNames[(studentIdx * 7 + i * 3) % indianNames.length];
      const last = lastNames[(studentIdx * 5 + i * 11) % lastNames.length];
      const fullName = `${first} ${last}`;
      const rollNo = `STU-2026-${String(studentIdx).padStart(4, '0')}`;
      const email = `stu.${first.toLowerCase()}.${last.toLowerCase()}.${studentIdx}@demo.edu`;

      const stuUser = await prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash: hashedPassword,
          systemRole: 'USER',
          isVerified: true,
          status: 'offline',
          bio: `Student of ${className} at Demo International Academy`,
        },
      });

      const mem = await prisma.membership.create({
        data: {
          userId: stuUser.id,
          orgId,
          role: 'STUDENT',
          title: `Student - ${className} (Roll: ${rollNo})`,
          departmentId: info.dept.id,
          teamId: info.team.id,
          isActive: true,
        },
      });

      createdStudents.push({ user: stuUser, membership: mem, className, rollNo });
      studentIdx++;
    }
  }

  console.log(`✅ Successfully enrolled ${createdStudents.length} students across 24 classrooms.`);

  // 5. Default Promotion Pipeline
  console.log('⚙️ Configuring Academic Promotion Pipeline...');
  const defaultSequence = [
    { from: 'Playgroup - Sec A', to: 'Nursery - Sec A', entry: true },
    { from: 'Nursery - Sec A', to: 'LKG - Sec A' },
    { from: 'LKG - Sec A', to: 'UKG - Sec A' },
    { from: 'LKG - Sec B', to: 'UKG - Sec B' },
    { from: 'UKG - Sec A', to: 'Grade 1 - Sec A' },
    { from: 'UKG - Sec B', to: 'Grade 1 - Sec B' },
    { from: 'Grade 1 - Sec A', to: 'Grade 2 - Sec A' },
    { from: 'Grade 1 - Sec B', to: 'Grade 2 - Sec A' },
    { from: 'Grade 2 - Sec A', to: 'Grade 3 - Sec A' },
    { from: 'Grade 3 - Sec A', to: 'Grade 4 - Sec A' },
    { from: 'Grade 4 - Sec A', to: 'Grade 5 - Sec A' },
    { from: 'Grade 5 - Sec A', to: 'Grade 6 - Sec A' },
    { from: 'Grade 6 - Sec A', to: 'Grade 7 - Sec A' },
    { from: 'Grade 6 - Sec B', to: 'Grade 7 - Sec A' },
    { from: 'Grade 7 - Sec A', to: 'Grade 8 - Sec A' },
    { from: 'Grade 8 - Sec A', to: 'Grade 9 - Sec A' },
    { from: 'Grade 9 - Sec A', to: 'Grade 10 - Sec A' },
    { from: 'Grade 9 - Sec B', to: 'Grade 10 - Sec B' },
    { from: 'Grade 10 - Sec A', to: 'Class 11 - Unified', unified: true },
    { from: 'Grade 10 - Sec B', to: 'Class 11 - Unified', unified: true },
    { from: 'Grade 11 - Science A', to: 'Grade 12 - Science A' },
    { from: 'Grade 11 - Commerce A', to: 'Grade 12 - Commerce A' },
    { from: 'Grade 12 - Science A', to: 'Alumni Network', alumni: true },
    { from: 'Grade 12 - Commerce A', to: 'Alumni Network', alumni: true },
  ];

  for (let i = 0; i < defaultSequence.length; i++) {
    const item = defaultSequence[i];
    await (prisma as any).academicPromotionConfig.create({
      data: {
        orgId,
        orderIndex: i + 1,
        fromClassName: item.from,
        toClassName: item.to,
        isEntryLevel: item.entry || false,
        isUnifiedPool: item.unified || false,
        isAlumniTarget: item.alumni || false,
      },
    });
  }

  // 6. Create Base Financial Records for Marcus Vance & Accounts
  console.log('💳 Seeding baseline finance records...');
  await prisma.bankAccount.create({
    data: {
      orgId,
      accountName: 'HDFC Bank Main Account',
      bankName: 'HDFC Bank',
      accountNumber: '50100492810394',
      ifscCode: 'HDFC0001824',
      branchName: 'Connaught Place Branch, New Delhi',
      accountType: 'CURRENT',
      openingBalance: 2500000,
      currentBalance: 3250000,
      isPrimary: true,
      isActive: true,
    },
  });

  const cashReg = await prisma.cashRegister.create({
    data: {
      orgId,
      registerName: 'Main Admissions Counter Cash Box',
      custodianName: 'Senior Admissions Cashier',
      openingBalance: 75000,
      currentBalance: 118500,
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.cashTransaction.create({
    data: {
      orgId,
      registerId: cashReg.id,
      transactionType: 'BANK_WITHDRAWAL',
      amount: 25000,
      transactionDate: new Date('2026-08-01'),
      recipientOrPayer: 'Main Admissions Counter Cash Box',
      category: 'BANK_FLOAT_TRANSFER',
      voucherNumber: 'CSH-CON-001',
      notes: 'Cash float drawn from HDFC Bank Main Account',
    },
  });

  // Seed sample fee ledgers for students
  for (let i = 0; i < Math.min(createdStudents.length, 75); i++) {
    const st = createdStudents[i];
    await prisma.studentFeeLedger.create({
      data: {
        orgId,
        studentRollNo: st.rollNo,
        studentName: st.user.fullName,
        feeHeader: 'Annual Tuition & Development Fee',
        academicYear: '2026-27',
        totalAmount: 75000,
        paidAmount: 75000,
        pendingBalance: 0,
        status: 'PAID',
        receiptNo: `REC-2026-${String(i + 1).padStart(4, '0')}`,
        tallyVoucherId: `REC-${String(i + 1).padStart(4, '0')}`,
        paymentMethod: 'Net Banking / UPI',
        notes: `Annual fee paid for ${st.className}`,
        tallySyncStatus: 'TALLY_VOUCHER_SYNCED',
        syncedAt: new Date(),
      },
    });
  }

  // Seed faculty payroll records
  const facultyStaff = coreStaff.filter(s => ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'DIRECTOR', 'ACCOUNTANT', 'ADMIN'].includes(s.role));
  for (let i = 0; i < facultyStaff.length; i++) {
    const fs = facultyStaff[i];
    const u = userMap[fs.email];
    await prisma.payrollRecord.create({
      data: {
        orgId,
        userId: u?.id,
        employeeId: `EMP-FAC-${String(i + 1).padStart(3, '0')}`,
        employeeName: fs.fullName,
        designation: fs.title,
        month: 'April',
        year: 2026,
        basicPay: 67200,
        allowances: 0,
        deductions: 0,
        netSalary: 67200,
        status: 'DISBURSED',
        tallyVoucherId: `PAY-FAC-${String(i + 1).padStart(3, '0')}`,
        disbursedAt: new Date(),
        syncedAt: new Date(),
      },
    });
  }

  console.log('🎉 ==========================================');
  console.log('🎉 DATABASE FULL RESET & SEED COMPLETED!');
  console.log(`🎉 Total Active Students: ${createdStudents.length}`);
  console.log('🎉 ==========================================');
}

if (require.main === module) {
  resetAndSeedFull().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

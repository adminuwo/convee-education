import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import prisma from '../db/prisma';

async function seedAllFinanceData() {
  console.log('🌱 Starting comprehensive financial mock data update...');

  const orgs = await prisma.organization.findMany();
  if (orgs.length === 0) {
    console.error('❌ No organizations found in database.');
    return;
  }

  console.log(`Found ${orgs.length} organization(s) in the database.`);

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n========================================`);
    console.log(`🏢 Updating Mock Data for Org: "${org.name}" (${org.slug || org.id})`);
    console.log(`========================================`);

    // Clean old financial entries for this org
    await prisma.cashTransaction.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.cashRegister.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.bankAccount.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.fixedAsset.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.societyFund.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.expenseRecord.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.studentFeeLedger.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.payrollRecord.deleteMany({ where: { orgId } }).catch(() => {});

    // 1. Bank Accounts (Healthy positive opening and current balances)
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

    await prisma.bankAccount.create({
      data: {
        orgId,
        accountName: 'State Bank of India Operations',
        bankName: 'State Bank of India',
        accountNumber: '381920491823',
        ifscCode: 'SBIN0004812',
        branchName: 'University Campus Branch',
        accountType: 'SAVINGS',
        openingBalance: 850000,
        currentBalance: 1120000,
        isPrimary: false,
        isActive: true,
      },
    });

    await prisma.bankAccount.create({
      data: {
        orgId,
        accountName: 'ICICI Fee Collection Account',
        bankName: 'ICICI Bank',
        accountNumber: '001105928144',
        ifscCode: 'ICIC0000011',
        branchName: 'Cyber City Branch',
        accountType: 'CURRENT',
        openingBalance: 600000,
        currentBalance: 890000,
        isPrimary: false,
        isActive: true,
      },
    });

    console.log('✅ Created 3 Bank Accounts.');

    // 2. Cash Registers (Cash in Hand)
    const cashReg1 = await prisma.cashRegister.create({
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

    const cashReg2 = await prisma.cashRegister.create({
      data: {
        orgId,
        registerName: 'Administrative Office Petty Cash Float',
        custodianName: 'Head Administrative Executive',
        openingBalance: 35000,
        currentBalance: 28400,
        isDefault: false,
        isActive: true,
      },
    });

    console.log('✅ Created 2 Cash Registers (Cash-in-Hand).');

    // 3. Society & Corpus Capital Funds (Capital Account)
    await prisma.societyFund.create({
      data: {
        orgId,
        fundName: 'General Education Trust Corpus Fund',
        fundType: 'CORPUS',
        contributingBody: 'Higher Education Management Society',
        amount: 3000000,
        fundDate: new Date('2025-04-01'),
        isRestricted: false,
        purpose: 'Permanent educational endowment and operational reserve',
        receiptNo: 'SOC/2026-27/001',
        status: 'ACTIVE',
      },
    });

    await prisma.societyFund.create({
      data: {
        orgId,
        fundName: 'Campus Infrastructure Development Fund',
        fundType: 'INFRASTRUCTURE',
        contributingBody: 'State Higher Education Innovation Grant',
        amount: 1000000,
        fundDate: new Date('2025-06-15'),
        isRestricted: true,
        purpose: 'Modernization of smart classrooms and auditorium audio-visual systems',
        receiptNo: 'SOC/2026-27/002',
        status: 'ACTIVE',
      },
    });

    console.log('✅ Created 2 Society Capital Funds (Total ₹40,00,000).');

    // 4. Fixed Assets (with Gross Purchase Value and Depreciation)
    await prisma.fixedAsset.create({
      data: {
        orgId,
        assetName: 'Main Academic Campus Land & Building',
        category: 'LAND_BUILDING',
        assetCode: 'AST-BLD-001',
        purchaseDate: new Date('2022-01-10'),
        purchasePrice: 15000000,
        vendorName: 'Apex Infrastructure & Constructions Ltd',
        invoiceNo: 'INV/2022/BLD-99',
        location: 'Main Academic Campus - Block A',
        depreciationRate: 2.5,
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDepreciation: 750000,
        currentBookValue: 14250000,
        status: 'ACTIVE',
        notes: '4-story academic building with 32 smart classrooms and auditorium',
      },
    });

    await prisma.fixedAsset.create({
      data: {
        orgId,
        assetName: 'Dell OptiPlex Core i7 Computer Lab (40 Workstations)',
        category: 'IT_HARDWARE',
        assetCode: 'AST-IT-104',
        purchaseDate: new Date('2024-06-15'),
        purchasePrice: 2800000,
        vendorName: 'Dell Technologies Institutional Sales',
        invoiceNo: 'INV/2024/DELL-882',
        location: 'Science Block - Computer Lab 1',
        depreciationRate: 15.0,
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDepreciation: 840000,
        currentBookValue: 1960000,
        status: 'ACTIVE',
        notes: '40 Dell Core i7 Systems with 32GB RAM & 24-inch dual monitor displays',
      },
    });

    await prisma.fixedAsset.create({
      data: {
        orgId,
        assetName: 'Advanced Physics & Chemistry Spectrometer Unit',
        category: 'LAB_EQUIPMENT',
        assetCode: 'AST-LAB-022',
        purchaseDate: new Date('2023-09-20'),
        purchasePrice: 1250000,
        vendorName: 'Shimadzu Analytical Instruments India',
        invoiceNo: 'INV/2023/SHI-441',
        location: 'Science Block - Advanced Spectroscopy Lab',
        depreciationRate: 10.0,
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDepreciation: 312500,
        currentBookValue: 937500,
        status: 'ACTIVE',
        notes: 'Precision UV-Vis double beam spectrophotometer',
      },
    });

    await prisma.fixedAsset.create({
      data: {
        orgId,
        assetName: 'Tata Starbus 40-Seater Campus Transit Fleet',
        category: 'VEHICLES',
        assetCode: 'AST-VEH-008',
        purchaseDate: new Date('2023-04-05'),
        purchasePrice: 3200000,
        vendorName: 'Tata Motors Commercial Vehicles Ltd',
        invoiceNo: 'INV/2023/TATA-319',
        location: 'Transport Depot - Gate 3',
        depreciationRate: 12.5,
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDepreciation: 252500,
        currentBookValue: 2947500,
        status: 'ACTIVE',
        notes: 'BS6 40-seater air-conditioned student shuttle bus',
      },
    });

    console.log('✅ Created 4 Fixed Assets.');

    // 5. Student Fee Ledgers - STRICTLY FOR REAL REGISTERED STUDENTS IN THE DATABASE
    const realStudents = await prisma.membership.findMany({
      where: { orgId, role: 'STUDENT', isActive: true },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    const extractRollNo = (m: any, idx: number): string => {
      if (m.title) {
        const match = m.title.match(/STU-\d{4}-[\w\d]+/i) || m.title.match(/STU-[\w\d]+/i) || m.title.match(/Adm:\s*([\w\d]+)/i);
        if (match) {
          return match[0].startsWith('STU-') ? match[0].toUpperCase() : `STU-2026-${match[1]}`;
        }
      }
      if (m.user?.email && m.user.email.toUpperCase().startsWith('STU-')) {
        return m.user.email.toUpperCase();
      }
      return `STU-2026-${String(idx + 1).padStart(3, '0')}`;
    };

    for (let idx = 0; idx < realStudents.length; idx++) {
      const studentMem = realStudents[idx];
      const studentName = studentMem.user.fullName;
      const studentRollNo = extractRollNo(studentMem, idx);
      const studentId = studentMem.userId;

      const totalAmount = 45000 + (idx % 3) * 15000;
      const paidAmount = idx % 3 === 2 ? Math.round(totalAmount / 2) : totalAmount;
      const pendingBalance = totalAmount - paidAmount;
      const feeStatus = pendingBalance === 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING');

      await prisma.studentFeeLedger.create({
        data: {
          orgId,
          studentId,
          studentRollNo,
          studentName,
          feeHeader: idx % 2 === 0 ? 'Annual Tuition & Development Fee' : 'Tuition & Laboratory Practical Fee',
          academicYear: '2026-27',
          totalAmount,
          paidAmount,
          pendingBalance,
          dueDate: new Date('2026-08-30'),
          status: feeStatus,
          receiptNo: `REC/2026-27/${String(1001 + idx)}`,
          tallyVoucherId: `TAL-VOUCH-${String(1001 + idx)}`,
          paymentMethod: idx % 2 === 0 ? 'UPI / Online' : 'Bank Transfer',
          notes: `Student Fee ledger for ${studentName}`,
          tallySyncStatus: 'STAGED_FOR_TALLY',
        },
      });
    }

    console.log(`✅ Created ${realStudents.length} Student Fee Ledgers for real registered students.`);

    // 6. Faculty Payroll Records - STRICTLY FOR REAL FACULTY & STAFF IN THE DATABASE
    const realFaculty = await prisma.membership.findMany({
      where: {
        orgId,
        role: { in: ['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER', 'ACCOUNTANT'] },
        isActive: true,
      },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    for (let idx = 0; idx < realFaculty.length; idx++) {
      const fac = realFaculty[idx];
      const employeeName = fac.user.fullName;
      const designation = fac.title || fac.role || 'Faculty Member';
      const employeeId = `EMP-FAC-${String(idx + 1).padStart(3, '0')}`;

      const basicPay = 60000 + (Math.max(0, 5 - idx)) * 12000;
      const allowances = Math.round(basicPay * 0.2);
      const deductions = Math.round(basicPay * 0.08);
      const netSalary = basicPay + allowances - deductions;

      await prisma.payrollRecord.create({
        data: {
          orgId,
          employeeId,
          employeeName,
          designation,
          month: 'August',
          year: 2026,
          basicPay,
          allowances,
          deductions,
          netSalary,
          status: 'DISBURSED',
          tallyVoucherId: `PAY-TAL-${String(2001 + idx)}`,
        },
      });
    }

    console.log(`✅ Created ${realFaculty.length} Faculty Payroll Vouchers for real database staff.`);

    // 7. Expense & Donation Records
    const sampleExpenses = [
      {
        orgId,
        title: 'Campus Electrical & HVAC Central Servicing',
        category: 'MAINTENANCE',
        amount: 45000,
        expenseDate: new Date('2026-08-05'),
        paymentMethod: 'BANK_TRANSFER',
        bankAccountName: 'HDFC Bank Main Account',
        vendorName: 'Cooling & Power Engineers Pvt Ltd',
        receiptNo: 'EXP/2026-27/001',
        tallyVoucherId: 'EXP-TAL-901',
        status: 'PAID',
        academicYear: '2026-27',
        notes: 'Routine monthly HVAC servicing and generator fuel check',
      },
      {
        orgId,
        title: 'Alumni Association STEM Lab Endowment Grant',
        category: 'DONATION',
        amount: 350000,
        expenseDate: new Date('2026-08-01'),
        paymentMethod: 'BANK_TRANSFER',
        bankAccountName: 'HDFC Bank Main Account',
        vendorName: 'Global Alumni Foundation Trust',
        receiptNo: 'DON/2026-27/108',
        tallyVoucherId: 'DON-TAL-402',
        status: 'PAID',
        academicYear: '2026-27',
        notes: 'Donation received for STEM Innovation Center',
      },
      {
        orgId,
        title: 'Science Lab Chemicals & Glassware Supplies',
        category: 'LAB_INFRA',
        amount: 38500,
        expenseDate: new Date('2026-08-10'),
        paymentMethod: 'UPI',
        bankAccountName: 'State Bank of India Operations',
        vendorName: 'Borosil Scientific Supplies Ltd',
        receiptNo: 'EXP/2026-27/002',
        tallyVoucherId: 'EXP-TAL-902',
        status: 'PAID',
        academicYear: '2026-27',
        notes: 'High grade reagents & glass apparatus for Term 1 practicals',
      },
      {
        orgId,
        title: 'Stationery & Office Printing Supplies',
        category: 'MAINTENANCE',
        amount: 8500,
        expenseDate: new Date('2026-08-12'),
        paymentMethod: 'CASH',
        bankAccountName: 'Main Admissions Counter Cash Box',
        vendorName: 'Universal Office Supplies',
        receiptNo: 'EXP/2026-27/003',
        tallyVoucherId: 'EXP-TAL-903',
        status: 'PAID',
        academicYear: '2026-27',
        notes: 'Printing paper reams and printer toner cartridges',
      },
    ];

    for (const e of sampleExpenses) {
      await prisma.expenseRecord.create({ data: e });
    }

    console.log(`✅ Created ${sampleExpenses.length} Expense & Donation Records.`);

    // 8. Cash Transactions & Contra Transfers
    await prisma.cashTransaction.create({
      data: {
        orgId,
        registerId: cashReg1.id,
        transactionType: 'BANK_WITHDRAWAL',
        amount: 25000,
        transactionDate: new Date('2026-08-01'),
        recipientOrPayer: 'Main Admissions Counter Cash Float',
        category: 'BANK_FLOAT_TRANSFER',
        voucherNumber: 'CSH-CON-001',
        notes: 'Cash float drawn from HDFC Bank Main Account',
      },
    });

    await prisma.cashTransaction.create({
      data: {
        orgId,
        registerId: cashReg1.id,
        transactionType: 'CASH_IN',
        amount: 15000,
        transactionDate: new Date('2026-08-04'),
        recipientOrPayer: 'Admissions Prospectus & Form Sales',
        category: 'FEE_PAYMENT',
        voucherNumber: 'CSH-REC-002',
        notes: 'Cash collected from sale of 30 application kits',
      },
    });

    await prisma.cashTransaction.create({
      data: {
        orgId,
        registerId: cashReg2.id,
        transactionType: 'EXPENSE_PAYMENT',
        amount: 6600,
        transactionDate: new Date('2026-08-08'),
        recipientOrPayer: 'Administrative Refreshments & Couriers',
        category: 'PETTY_EXPENSE',
        voucherNumber: 'CSH-PAY-003',
        notes: 'Staff meeting tea/coffee snacks & urgent document speed-posts',
      },
    });

    console.log('✅ Created 3 Cash Transactions (Contra Transfer, Cash Inflow, Petty Expense).');
  }

  console.log('\n🎉 ALL ORGANIZATIONS SEEDED WITH COMPLETE FINANCIAL MOCK DATA SUCCESSFULLY!');
}

seedAllFinanceData()
  .catch((err) => {
    console.error('❌ Error seeding finance data:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

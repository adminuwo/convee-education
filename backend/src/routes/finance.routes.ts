import { Router, Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';

// Refresh IDE diagnostics

const router = Router();
const db = prisma as any;

// Apply auth middleware to all finance routes
router.use(authenticate);

async function getOrgId(req: Request): Promise<string | null> {
  let orgId = (req.headers['x-org-id'] as string) || (req.headers['org-id'] as string);
  if (!orgId || orgId === 'undefined' || orgId === 'null') {
    const userId = req.user?.id;
    if (userId) {
      const membership = await prisma.membership.findFirst({ where: { userId } });
      if (membership) orgId = membership.orgId;
    }
  }
  if (!orgId || orgId === 'undefined' || orgId === 'null') {
    const firstOrg = await prisma.organization.findFirst();
    if (firstOrg) orgId = firstOrg.id;
  }
  return orgId || null;
}

function postToTallyHttp(xmlData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port: 9000,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=utf-8',
          'Content-Length': Buffer.byteLength(xmlData, 'utf-8'),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk.toString()));
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', (err) => reject(err));
    req.write(xmlData, 'utf-8');
    req.end();
  });
}

async function ensureSampleFinanceData(orgId: string) {
  try {
    // Migrate legacy roll numbers in PostgreSQL database to exact STU-2026-XXXXXX format
    await db.studentFeeLedger.updateMany({
      where: { studentRollNo: 'STU-1001' },
      data: { studentRollNo: 'STU-2026-100001', studentName: 'Alex Rivera (Student)' },
    }).catch(() => {});

    await db.studentFeeLedger.updateMany({
      where: { studentRollNo: 'STU-1002' },
      data: { studentRollNo: 'STU-2026-654654', studentName: 'sanskar sahu' },
    }).catch(() => {});

    await db.studentFeeLedger.updateMany({
      where: { studentRollNo: 'STU-1003' },
      data: { studentRollNo: 'STU-2026-789321', studentName: 'sudhanshu matta' },
    }).catch(() => {});

    const count = await db.studentFeeLedger.count({ where: { orgId } }).catch(() => 0);
    if (count === 0) {
      const sampleFees = [
        {
          orgId,
          studentRollNo: 'STU-2026-100001',
          studentName: 'Alex Rivera (Student)',
          feeHeader: 'Tuition Fee - Term 1',
          academicYear: '2026-27',
          totalAmount: 45000,
          paidAmount: 45000,
          pendingBalance: 0,
          dueDate: new Date('2026-07-15'),
          status: 'PAID',
          receiptNo: 'REC/2026-27/901823',
          tallyVoucherId: 'TAL-VOUCH-701',
          paymentMethod: 'UPI / Online',
          notes: 'Paid in full via Tally ERP receipt voucher #701',
        },
        {
          orgId,
          studentRollNo: 'STU-2026-654654',
          studentName: 'sanskar sahu',
          feeHeader: 'Tuition & Transport Fee - Term 1',
          academicYear: '2026-27',
          totalAmount: 58000,
          paidAmount: 30000,
          pendingBalance: 28000,
          dueDate: new Date('2026-08-30'),
          status: 'PARTIAL',
          receiptNo: 'REC/2026-27/901824',
          tallyVoucherId: 'TAL-VOUCH-702',
          paymentMethod: 'Bank Transfer',
          notes: 'Partial payment received; remaining due by end of month',
        },
        {
          orgId,
          studentRollNo: 'STU-2026-789321',
          studentName: 'sudhanshu matta',
          feeHeader: 'Tuition Fee - Term 1',
          academicYear: '2026-27',
          totalAmount: 45000,
          paidAmount: 0,
          pendingBalance: 45000,
          dueDate: new Date('2026-08-01'),
          status: 'OVERDUE',
          receiptNo: 'REC/2026-27/901825',
          tallyVoucherId: 'TAL-VOUCH-703',
          paymentMethod: 'Cheque',
          notes: 'Payment overdue notice sent to parent',
        },
        {
          orgId,
          studentRollNo: 'STU-1004',
          studentName: 'Diya Patel',
          feeHeader: 'Lab & Library Fee',
          academicYear: '2026-27',
          totalAmount: 12500,
          paidAmount: 12500,
          pendingBalance: 0,
          dueDate: new Date('2026-07-20'),
          status: 'PAID',
          receiptNo: 'REC/2026-27/901826',
          tallyVoucherId: 'BUSY-VOUCH-109',
          paymentMethod: 'Credit Card',
          notes: 'Synced from Busy Accounting Software',
        },
      ];

      for (const f of sampleFees) {
        await db.studentFeeLedger.create({ data: f }).catch(() => {});
      }

      const samplePayrolls = [
        {
          orgId,
          employeeId: 'EMP-201',
          employeeName: 'Dr. Ramesh Kumar',
          designation: 'Senior HOD - Computer Science',
          month: 'August',
          year: 2026,
          basicPay: 85000,
          allowances: 18000,
          deductions: 6500,
          netSalary: 96500,
          status: 'DISBURSED',
          tallyVoucherId: 'PAY-TAL-8801',
        },
        {
          orgId,
          employeeId: 'EMP-202',
          employeeName: 'Prof. Sunita Mehta',
          designation: 'Associate Professor - Mathematics',
          month: 'August',
          year: 2026,
          basicPay: 72000,
          allowances: 14000,
          deductions: 5200,
          netSalary: 80800,
          status: 'DISBURSED',
          tallyVoucherId: 'PAY-TAL-8802',
        },
        {
          orgId,
          employeeId: 'EMP-203',
          employeeName: 'Mr. Vikram Sen',
          designation: 'Assistant Teacher - Physics',
          month: 'August',
          year: 2026,
          basicPay: 55000,
          allowances: 10000,
          deductions: 3800,
          netSalary: 61200,
          status: 'DISBURSED',
          tallyVoucherId: 'PAY-BUSY-4401',
        },
      ];

      for (const p of samplePayrolls) {
        await prisma.payrollRecord.create({ data: p }).catch(() => {});
      }
    }

    // Ensure sample Bank Accounts
    const bankCount = await db.bankAccount.count({ where: { orgId } }).catch(() => 0);
    if (bankCount === 0) {
      const sampleBanks = [
        {
          orgId,
          accountName: 'HDFC Bank Main Account',
          bankName: 'HDFC Bank',
          accountNumber: '50100492810394',
          ifscCode: 'HDFC0001824',
          branchName: 'Connaught Place Branch, New Delhi',
          accountType: 'CURRENT',
          openingBalance: 1250000,
          currentBalance: 1850000,
          isPrimary: true,
          isActive: true,
        },
        {
          orgId,
          accountName: 'State Bank of India Operations',
          bankName: 'State Bank of India',
          accountNumber: '381920491823',
          ifscCode: 'SBIN0004812',
          branchName: 'University Campus Branch',
          accountType: 'SAVINGS',
          openingBalance: 450000,
          currentBalance: 620000,
          isPrimary: false,
          isActive: true,
        },
        {
          orgId,
          accountName: 'ICICI Fee Collection Account',
          bankName: 'ICICI Bank',
          accountNumber: '001105928144',
          ifscCode: 'ICIC0000011',
          branchName: 'Cyber City Branch',
          accountType: 'CURRENT',
          openingBalance: 300000,
          currentBalance: 510000,
          isPrimary: false,
          isActive: true,
        },
      ];
      for (const b of sampleBanks) {
        await db.bankAccount.create({ data: b }).catch(() => {});
      }
    }

    // Ensure sample Expense & Donation records
    const expCount = await db.expenseRecord.count({ where: { orgId } }).catch(() => 0);
    if (expCount === 0) {
      const sampleExpenses = [
        {
          orgId,
          title: 'Campus Electrical & AC Maintenance',
          category: 'MAINTENANCE',
          amount: 35000,
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
          title: 'Alumni Association Education Grant & Donation',
          category: 'DONATION',
          amount: 250000,
          expenseDate: new Date('2026-08-01'),
          paymentMethod: 'BANK_TRANSFER',
          bankAccountName: 'HDFC Bank Main Account',
          vendorName: 'Global Alumni Foundation Trust',
          receiptNo: 'DON/2026-27/108',
          tallyVoucherId: 'DON-TAL-402',
          status: 'PAID',
          academicYear: '2026-27',
          notes: 'Donation received for new STEM Laboratory Endowment Fund',
        },
        {
          orgId,
          title: 'Physics & Chemistry Lab Chemicals Supply',
          category: 'LAB_INFRA',
          amount: 48500,
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
          title: 'Annual Sports Day & Cultural Fest Equipment',
          category: 'EVENTS',
          amount: 22000,
          expenseDate: new Date('2026-08-12'),
          paymentMethod: 'CHEQUE',
          bankAccountName: 'ICICI Fee Collection Account',
          vendorName: 'Decathlon Institutional Sales',
          receiptNo: 'EXP/2026-27/003',
          tallyVoucherId: 'EXP-TAL-903',
          status: 'PAID',
          academicYear: '2026-27',
          notes: 'Basketballs, sound system rental advance & trophies',
        },
      ];
      for (const e of sampleExpenses) {
        const existing = await db.expenseRecord.findFirst({
          where: { orgId, receiptNo: e.receiptNo },
        }).catch(() => null);
        if (!existing) {
          await db.expenseRecord.create({ data: e }).catch(() => {});
        }
      }
    }

    // Auto-clean any duplicate expense records created by parallel API calls
    const allExpenses = await db.expenseRecord.findMany({ where: { orgId } }).catch(() => []);
    const seenExpenseKeys = new Set<string>();
    for (const exp of allExpenses) {
      const key = `${exp.receiptNo || ''}_${exp.title}`;
      if (seenExpenseKeys.has(key)) {
        await db.expenseRecord.delete({ where: { id: exp.id } }).catch(() => {});
      } else {
        seenExpenseKeys.add(key);
      }
    }

    // Auto-clean any duplicate bank account records created by parallel API calls
    const allBanks = await db.bankAccount.findMany({ where: { orgId } }).catch(() => []);
    const seenBankKeys = new Set<string>();
    for (const bank of allBanks) {
      if (seenBankKeys.has(bank.accountNumber)) {
        await db.bankAccount.delete({ where: { id: bank.id } }).catch(() => {});
      } else {
        seenBankKeys.add(bank.accountNumber);
      }
    }

    // Auto-clean duplicate Society Funds
    const allFunds = await db.societyFund.findMany({ where: { orgId } }).catch(() => []);
    const seenFundKeys = new Set<string>();
    for (const fund of allFunds) {
      const key = fund.fundName || fund.receiptNo;
      if (seenFundKeys.has(key)) {
        await db.societyFund.delete({ where: { id: fund.id } }).catch(() => {});
      } else {
        seenFundKeys.add(key);
      }
    }

    // Auto-clean duplicate Cash Registers
    const allRegisters = await db.cashRegister.findMany({ where: { orgId } }).catch(() => []);
    const seenRegKeys = new Set<string>();
    for (const reg of allRegisters) {
      if (seenRegKeys.has(reg.registerName)) {
        await db.cashRegister.delete({ where: { id: reg.id } }).catch(() => {});
      } else {
        seenRegKeys.add(reg.registerName);
      }
    }

    // Auto-clean duplicate Fixed Assets
    const allAssets = await db.fixedAsset.findMany({ where: { orgId } }).catch(() => []);
    const seenAssetKeys = new Set<string>();
    for (const asset of allAssets) {
      const key = asset.assetCode || asset.assetName;
      if (seenAssetKeys.has(key)) {
        await db.fixedAsset.delete({ where: { id: asset.id } }).catch(() => {});
      } else {
        seenAssetKeys.add(key);
      }
    }

    // Ensure sample Society / Corpus Funds
    const fundCount = await db.societyFund.count({ where: { orgId } }).catch(() => 0);
    if (fundCount === 0) {
      const sampleFunds = [
        {
          orgId,
          fundName: 'General Institutional Corpus Fund',
          fundType: 'CORPUS',
          contributingBody: 'Convee Educational Trust Society',
          amount: 2500000,
          fundDate: new Date('2026-04-01'),
          isRestricted: false,
          purpose: 'Permanent corpus capital reserve for institutional advancement',
          receiptNo: 'SOC/2026-27/001',
          status: 'ACTIVE',
          notes: 'Initial corpus capital contributed by Founding Trust Body',
        },
        {
          orgId,
          fundName: 'Campus STEM & Robotics Infrastructure Grant',
          fundType: 'INFRASTRUCTURE',
          contributingBody: 'National Science & Technology Development Board',
          amount: 1000000,
          fundDate: new Date('2026-06-15'),
          isRestricted: true,
          purpose: 'Dedicated grant for construction of advanced robotics lab',
          receiptNo: 'SOC/2026-27/002',
          status: 'ACTIVE',
          notes: 'Restricted grant: funds to be deployed exclusively on Phase 2 STEM Wing',
        },
        {
          orgId,
          fundName: 'Merit & EWS Student Scholarship Endowment',
          fundType: 'SCHOLARSHIP',
          contributingBody: 'Alumni Welfare & Philanthropic Foundation',
          amount: 500000,
          fundDate: new Date('2026-07-01'),
          isRestricted: true,
          purpose: 'Endowment yield reserved for annual student tuition waivers',
          receiptNo: 'SOC/2026-27/003',
          status: 'ACTIVE',
          notes: 'Annual interest disbursed towards economically weaker section merit scholarships',
        },
      ];
      for (const fund of sampleFunds) {
        await db.societyFund.create({ data: fund }).catch(() => {});
      }
    }

    // Ensure sample Cash Registers (Cash in Hand)
    const registerCount = await db.cashRegister.count({ where: { orgId } }).catch(() => 0);
    if (registerCount === 0) {
      const sampleRegisters = [
        {
          orgId,
          registerName: 'Main Admissions Counter Cash Box',
          custodianName: 'Senior Admissions Cashier',
          openingBalance: 50000,
          currentBalance: 68500,
          isDefault: true,
          isActive: true,
        },
        {
          orgId,
          registerName: 'Administrative Office Petty Cash Float',
          custodianName: 'Head Administrative Executive',
          openingBalance: 20000,
          currentBalance: 14200,
          isDefault: false,
          isActive: true,
        },
      ];
      for (const reg of sampleRegisters) {
        await db.cashRegister.create({ data: reg }).catch(() => {});
      }
    }

    // Ensure sample Fixed Assets
    const assetCount = await db.fixedAsset.count({ where: { orgId } }).catch(() => 0);
    if (assetCount === 0) {
      const sampleAssets = [
        {
          orgId,
          assetName: 'Main Academic Block & Campus Land',
          category: 'LAND_BUILDING',
          assetCode: 'AST-BLD-001',
          purchaseDate: new Date('2022-01-10'),
          purchasePrice: 7500000,
          vendorName: 'Apex Infrastructure & Constructions Ltd',
          invoiceNo: 'INV/2022/BLD-99',
          location: 'Main Academic Campus - Block A',
          depreciationRate: 2.5,
          depreciationMethod: 'STRAIGHT_LINE',
          accumulatedDepreciation: 375000,
          currentBookValue: 7125000,
          status: 'ACTIVE',
          notes: '4-story academic building with 32 smart classrooms and auditorium',
        },
        {
          orgId,
          assetName: 'Dell OptiPlex Core i7 Computer Lab (40 Workstations)',
          category: 'IT_HARDWARE',
          assetCode: 'AST-IT-104',
          purchaseDate: new Date('2024-06-20'),
          purchasePrice: 1800000,
          vendorName: 'Dell Technologies Commercial Direct',
          invoiceNo: 'INV/2024/DEL-4820',
          location: 'IT Centre - Lab 1 (First Floor)',
          depreciationRate: 20.0,
          depreciationMethod: 'STRAIGHT_LINE',
          accumulatedDepreciation: 720000,
          currentBookValue: 1080000,
          status: 'ACTIVE',
          notes: '40x Intel Core i7 16GB RAM lab systems with 24-inch monitors',
        },
        {
          orgId,
          assetName: 'Institutional Transport Bus (Tata Starbus 42-Seater)',
          category: 'VEHICLES',
          assetCode: 'AST-VEH-201',
          purchaseDate: new Date('2024-04-15'),
          purchasePrice: 2400000,
          vendorName: 'Tata Motors Commercial Dealership',
          invoiceNo: 'INV/2024/TAT-908',
          location: 'Campus Transport Bay',
          depreciationRate: 15.0,
          depreciationMethod: 'STRAIGHT_LINE',
          accumulatedDepreciation: 720000,
          currentBookValue: 1680000,
          status: 'ACTIVE',
          notes: 'Fully air-conditioned 42-seater bus with GPS & CCTV installed',
        },
        {
          orgId,
          assetName: 'Physics & Chemistry Advanced Lab Equipment',
          category: 'LAB_EQUIPMENT',
          assetCode: 'AST-LAB-305',
          purchaseDate: new Date('2024-08-01'),
          purchasePrice: 650000,
          vendorName: 'Borosil Scientific Apparatus Ltd',
          invoiceNo: 'INV/2024/SCI-1044',
          location: 'Science Block - Lab 2',
          depreciationRate: 10.0,
          depreciationMethod: 'STRAIGHT_LINE',
          accumulatedDepreciation: 130000,
          currentBookValue: 520000,
          status: 'ACTIVE',
          notes: 'High precision digital spectrometers, optical microscopes, and fume hoods',
        },
        {
          orgId,
          assetName: 'Interactive 75-inch 4K Smart Displays (6 Classrooms)',
          category: 'SMART_CLASSROOM',
          assetCode: 'AST-CLS-410',
          purchaseDate: new Date('2025-01-15'),
          purchasePrice: 840000,
          vendorName: 'ViewSonic Smart Systems',
          invoiceNo: 'INV/2025/VS-789',
          location: 'High School Wing - Classrooms 9A-11B',
          depreciationRate: 15.0,
          depreciationMethod: 'STRAIGHT_LINE',
          accumulatedDepreciation: 210000,
          currentBookValue: 630000,
          status: 'ACTIVE',
          notes: '6 units of 75-inch 4K touchscreen digital interactive panels',
        },
      ];
      for (const asset of sampleAssets) {
        await db.fixedAsset.create({ data: asset }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Error ensuring sample finance data:', e);
  }
}

/**
 * GET /api/v1/finance/overview
 * Financial Overview metrics for Accountant & Admin
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    await ensureSampleFinanceData(orgId);

    const feeLedgers = await db.studentFeeLedger.findMany({ where: { orgId } });
    const payrollRecords = await prisma.payrollRecord.findMany({ where: { orgId } });
    const expenseRecords = await db.expenseRecord.findMany({ where: { orgId } }).catch(() => []);
    const bankAccounts = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const societyFunds = await db.societyFund.findMany({ where: { orgId, status: 'ACTIVE' } }).catch(() => []);
    const cashRegisters = await db.cashRegister.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const fixedAssets = await db.fixedAsset.findMany({ where: { orgId, status: 'ACTIVE' } }).catch(() => []);

    const totalFeesCollected = feeLedgers.reduce((sum: number, f: any) => sum + (f.paidAmount || 0), 0);
    const totalPendingDues = feeLedgers.reduce((sum: number, f: any) => sum + (f.pendingBalance || 0), 0);
    const totalPayrollDisbursed = payrollRecords.reduce((sum: number, p: any) => sum + (p.netSalary || 0), 0);

    const operationalExpenses = expenseRecords.filter((e: any) => e.category !== 'DONATION');
    const donations = expenseRecords.filter((e: any) => e.category === 'DONATION');

    const totalOperationalExpenses = operationalExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const totalDonationsReceived = donations.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const totalExpenses = expenseRecords.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    const pendingCount = feeLedgers.filter((f: any) => f.status === 'PENDING' || f.status === 'OVERDUE').length;
    const paidCount = feeLedgers.filter((f: any) => f.status === 'PAID').length;

    // Asset & Capital Aggregations
    const totalBankBalances = bankAccounts.reduce((sum: number, b: any) => sum + (b.currentBalance || 0), 0);
    const totalCashInHand = cashRegisters.reduce((sum: number, c: any) => sum + (c.currentBalance || 0), 0);
    const totalLiquidFunds = totalBankBalances + totalCashInHand;
    const totalSocietyFunds = societyFunds.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const totalFixedAssetsPurchase = fixedAssets.reduce((sum: number, a: any) => sum + (a.purchasePrice || 0), 0);
    const totalFixedAssetsBookValue = fixedAssets.reduce((sum: number, a: any) => sum + (a.currentBookValue || 0), 0);
    const totalAccumulatedDepreciation = fixedAssets.reduce((sum: number, a: any) => sum + (a.accumulatedDepreciation || 0), 0);
    const institutionalNetWorth = totalLiquidFunds + totalFixedAssetsBookValue;

    res.json({
      summary: {
        totalFeesCollected,
        totalPendingDues,
        totalPayrollDisbursed,
        totalOperationalExpenses,
        totalDonationsReceived,
        totalExpenses,
        totalStudentsBilled: feeLedgers.length,
        totalBankAccounts: bankAccounts.length,
        totalBankBalances,
        totalCashInHand,
        totalLiquidFunds,
        totalSocietyFunds,
        totalFixedAssetsPurchase,
        totalFixedAssetsBookValue,
        totalAccumulatedDepreciation,
        institutionalNetWorth,
        totalFixedAssetsCount: fixedAssets.length,
        totalCashRegistersCount: cashRegisters.length,
        totalSocietyFundsCount: societyFunds.length,
        pendingCount,
        paidCount,
        lastSyncedAt: feeLedgers.length > 0 ? feeLedgers[0].syncedAt : new Date(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching financial overview:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch financial overview' });
  }
});

/**
 * GET /api/v1/finance/fees
 * Fetch all student fee ledgers (Accountant & Admin view)
 */
router.get('/fees', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    await ensureSampleFinanceData(orgId);

    const { status, search } = req.query;

    const whereClause: any = { orgId };
    if (status && status !== 'ALL') {
      whereClause.status = status as string;
    }
    if (search) {
      whereClause.OR = [
        { studentName: { contains: search as string, mode: 'insensitive' } },
        { studentRollNo: { contains: search as string, mode: 'insensitive' } },
        { feeHeader: { contains: search as string, mode: 'insensitive' } },
        { receiptNo: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const fees = await db.studentFeeLedger.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ fees });
  } catch (error: any) {
    console.error('Error fetching fee ledgers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch fee ledgers' });
  }
});

/**
 * POST /api/v1/finance/fees
 * Create or update a student fee ledger record
 */
router.post('/fees', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const {
      studentId,
      studentRollNo,
      studentName,
      feeHeader,
      academicYear,
      totalAmount,
      paidAmount = 0,
      dueDate,
      status,
      receiptNo,
      tallyVoucherId,
      paymentMethod,
      notes,
    } = req.body;

    if (!studentName || !feeHeader || totalAmount === undefined) {
      return res.status(400).json({ error: 'studentName, feeHeader, and totalAmount are required' });
    }

    const total = parseFloat(totalAmount);
    const paid = parseFloat(paidAmount);
    const pending = Math.max(0, total - paid);
    const computedStatus = status || (pending === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING');

    const uniqueSeq = Math.floor(100000 + Math.random() * 900000);
    const assignedReceiptNo = receiptNo || `REC/2026-27/${uniqueSeq}`;
    const assignedVoucherId = tallyVoucherId || `VOUCH-2026-${uniqueSeq}`;

    const ledger = await db.studentFeeLedger.create({
      data: {
        orgId,
        studentId: studentId || null,
        studentRollNo: studentRollNo || null,
        studentName,
        feeHeader,
        academicYear: academicYear || '2026-27',
        totalAmount: total,
        paidAmount: paid,
        pendingBalance: pending,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: computedStatus,
        receiptNo: assignedReceiptNo,
        tallyVoucherId: assignedVoucherId,
        paymentMethod: paymentMethod || 'UPI / Online',
        tallySyncStatus: 'STAGED_FOR_TALLY',
        notes: notes || 'Queued for Tally Prime Sync',
      } as any,
    });

    res.status(201).json({ fee: ledger });
  } catch (error: any) {
    console.error('Error creating/updating fee ledger:', error);
    res.status(500).json({ error: error.message || 'Failed to process fee ledger' });
  }
});

/**
 * PUT /api/v1/finance/fees/:id
 * Update an existing student fee ledger (e.g. record payment)
 */
router.put('/fees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { totalAmount, paidAmount, paymentMethod, notes, status } = req.body;

    const existing = await db.studentFeeLedger.findUnique({ where: { id: String(id) } });
    if (!existing) {
      return res.status(404).json({ error: 'Fee record not found' });
    }

    const total = totalAmount !== undefined ? parseFloat(totalAmount) : existing.totalAmount;
    const paid = paidAmount !== undefined ? parseFloat(paidAmount) : existing.paidAmount;
    const pending = Math.max(0, total - paid);
    const computedStatus = status || (pending === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING');

    const updated = await db.studentFeeLedger.update({
      where: { id: String(id) },
      data: {
        totalAmount: total,
        paidAmount: paid,
        pendingBalance: pending,
        status: computedStatus,
        paymentMethod: paymentMethod || existing.paymentMethod,
        tallySyncStatus: 'STAGED_FOR_TALLY',
        notes: notes || 'Payment updated & queued for Tally Sync',
        updatedAt: new Date(),
      } as any,
    });

    res.json({ fee: updated });
  } catch (error: any) {
    console.error('Error updating fee ledger:', error);
    res.status(500).json({ error: error.message || 'Failed to update fee ledger' });
  }
});

/**
 * GET /api/v1/finance/fees/parent
 * Fetch fee statement for logged-in Parent
 */
router.get('/fees/parent', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    await ensureSampleFinanceData(orgId);

    const userId = req.user?.id;
    let fees: any[] = [];

    if (userId) {
      const links = await prisma.parentStudentLink.findMany({
        where: { orgId, parentUserId: userId },
      });
      const studentIds = links.map((l) => l.studentUserId);

      // Find students' details
      const studentUsers = studentIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: studentIds } } })
        : [];

      const OR_conditions: any[] = [];
      if (studentIds.length > 0) {
        OR_conditions.push({ studentId: { in: studentIds } });
      }
      studentUsers.forEach((u) => {
        if (u.fullName) {
          OR_conditions.push({
            studentName: { contains: u.fullName.split(' ')[0], mode: 'insensitive' as const },
          });
        }
      });

      if (OR_conditions.length > 0) {
        fees = await db.studentFeeLedger.findMany({
          where: {
            orgId,
            OR: OR_conditions,
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalPending = fees.reduce((sum, f) => sum + f.pendingBalance, 0);

    res.json({
      fees,
      summary: {
        totalPaid,
        totalPending,
        totalRecords: fees.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching parent fees:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch parent fee statement' });
  }
});

/**
 * GET /api/v1/finance/payroll
 * Fetch all payroll records (Accountant & Admin view)
 */
router.get('/payroll', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    await ensureSampleFinanceData(orgId);

    const payrolls = await prisma.payrollRecord.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ payrolls });
  } catch (error: any) {
    console.error('Error fetching payroll records:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payroll records' });
  }
});

/**
 * POST /api/v1/finance/payroll
 * Create or update payroll record
 */
router.post('/payroll', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const {
      userId,
      employeeId,
      employeeName,
      designation,
      month,
      year = 2026,
      basicPay,
      allowances = 0,
      deductions = 0,
      status = 'DISBURSED',
      tallyVoucherId,
    } = req.body;

    if (!employeeName || basicPay === undefined || !month) {
      return res.status(400).json({ error: 'employeeName, month, and basicPay are required' });
    }

    const basic = parseFloat(basicPay);
    const allow = parseFloat(allowances);
    const deduct = parseFloat(deductions);
    const net = basic + allow - deduct;

    const payroll = await prisma.payrollRecord.create({
      data: {
        orgId,
        userId: userId || null,
        employeeId: employeeId || null,
        employeeName,
        designation: designation || 'Faculty',
        month,
        year: parseInt(year, 10),
        basicPay: basic,
        allowances: allow,
        deductions: deduct,
        netSalary: net,
        status,
        tallyVoucherId: tallyVoucherId || null,
        disbursedAt: status === 'DISBURSED' ? new Date() : null,
      },
    });

    res.status(201).json({ payroll });
  } catch (error: any) {
    console.error('Error creating payroll record:', error);
    res.status(500).json({ error: error.message || 'Failed to create payroll record' });
  }
});

/**
 * GET /api/v1/finance/salary/faculty
 * Fetch teacher/faculty salary slips
 */
router.get('/salary/faculty', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    await ensureSampleFinanceData(orgId);

    const payrolls = await prisma.payrollRecord.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ payrolls });
  } catch (error: any) {
    console.error('Error fetching faculty salary history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch faculty salary history' });
  }
});

/**
 * GET /api/v1/finance/my-payslips
 * Fetch payslips strictly for the logged-in faculty member
 */
router.get('/my-payslips', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureSampleFinanceData(orgId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const membership = await prisma.membership.findFirst({ where: { userId, orgId } });
    const userRole = membership?.role || user.systemRole || 'FACULTY';
    const userName = user.fullName || '';
    const userEmail = user.email || '';

    // Query payslips belonging STRICTLY to the logged-in user by userId or exact full name match
    let payrolls = await prisma.payrollRecord.findMany({
      where: {
        orgId,
        OR: [
          { userId },
          ...(userName ? [{ employeeName: { equals: userName, mode: 'insensitive' as const } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no specific payslips exist for this user account in Tally, generate personalized payslip FOR THIS USER ONLY
    if (payrolls.length === 0) {
      const cleanEmpId = `EMP-${userId.slice(-4).toUpperCase()}`;
      const basePay = userRole === 'DIRECTOR' ? 115000 : userRole === 'PRINCIPAL' ? 100000 : userRole === 'DEAN' || userRole === 'HOD' ? 85000 : 65000;
      const allowances = userRole === 'DIRECTOR' ? 25000 : userRole === 'PRINCIPAL' ? 22000 : 14000;
      const deductions = 5000;
      const netSalary = basePay + allowances - deductions;

      await prisma.payrollRecord.create({
        data: {
          orgId,
          userId,
          employeeId: cleanEmpId,
          employeeName: userName,
          designation: userRole,
          month: 'August',
          year: 2026,
          basicPay: basePay,
          allowances,
          deductions,
          netSalary,
          status: 'DISBURSED',
          tallyVoucherId: `PAY-TAL-${Math.floor(1000 + Math.random() * 9000)}`,
          disbursedAt: new Date(),
        },
      }).catch(() => {});

      payrolls = await prisma.payrollRecord.findMany({
        where: { orgId, userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({ payrolls });
  } catch (error: any) {
    console.error('Error fetching my payslips:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payslips' });
  }
});

// ============ BANK ACCOUNTS MANAGEMENT ROUTES ============

/**
 * GET /api/v1/finance/bank-accounts
 */
router.get('/bank-accounts', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    await ensureSampleFinanceData(orgId);
    const bankAccounts = await db.bankAccount.findMany({
      where: { orgId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ bankAccounts });
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch bank accounts' });
  }
});

/**
 * POST /api/v1/finance/bank-accounts
 */
router.post('/bank-accounts', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      accountType = 'SAVINGS',
      openingBalance = 0,
      currentBalance = 0,
      isPrimary = false,
    } = req.body;

    if (!accountName || !bankName || !accountNumber) {
      return res.status(400).json({ error: 'accountName, bankName, and accountNumber are required' });
    }

    if (isPrimary) {
      await db.bankAccount.updateMany({
        where: { orgId },
        data: { isPrimary: false },
      });
    }

    const openBal = parseFloat(openingBalance) || 0;
    const curBal = currentBalance !== undefined ? parseFloat(currentBalance) : openBal;

    const bankAccount = await db.bankAccount.create({
      data: {
        orgId,
        accountName,
        bankName,
        accountNumber,
        ifscCode: ifscCode || 'HDFC0001824',
        branchName: branchName || null,
        accountType,
        openingBalance: openBal,
        currentBalance: curBal,
        isPrimary: Boolean(isPrimary),
        isActive: true,
      },
    });

    res.status(201).json({ bankAccount });
  } catch (error: any) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: error.message || 'Failed to create bank account' });
  }
});

/**
 * PUT /api/v1/finance/bank-accounts/:id
 */
router.put('/bank-accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = await getOrgId(req);

    const {
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      accountType,
      openingBalance,
      currentBalance,
      isPrimary,
    } = req.body;

    if (isPrimary && orgId) {
      await db.bankAccount.updateMany({
        where: { orgId },
        data: { isPrimary: false },
      });
    }

    const updated = await db.bankAccount.update({
      where: { id: String(id) },
      data: {
        ...(accountName && { accountName }),
        ...(bankName && { bankName }),
        ...(accountNumber && { accountNumber }),
        ...(ifscCode && { ifscCode }),
        ...(branchName !== undefined && { branchName }),
        ...(accountType && { accountType }),
        ...(openingBalance !== undefined && { openingBalance: parseFloat(openingBalance) }),
        ...(currentBalance !== undefined && { currentBalance: parseFloat(currentBalance) }),
        ...(isPrimary !== undefined && { isPrimary: Boolean(isPrimary) }),
      },
    });

    res.json({ bankAccount: updated });
  } catch (error: any) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: error.message || 'Failed to update bank account' });
  }
});

/**
 * DELETE /api/v1/finance/bank-accounts/:id
 */
router.delete('/bank-accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.bankAccount.update({
      where: { id: String(id) },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Bank account deactivated' });
  } catch (error: any) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ error: error.message || 'Failed to delete bank account' });
  }
});

// ============ OTHER EXPENSES & DONATIONS MANAGEMENT ROUTES ============

/**
 * GET /api/v1/finance/expenses
 */
router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    await ensureSampleFinanceData(orgId);

    const { category, search, status } = req.query;
    const whereClause: any = { orgId };

    if (category && category !== 'ALL') {
      whereClause.category = category as string;
    }
    if (status && status !== 'ALL') {
      whereClause.status = status as string;
    }
    if (search) {
      whereClause.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { vendorName: { contains: search as string, mode: 'insensitive' } },
        { receiptNo: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const expenses = await db.expenseRecord.findMany({
      where: whereClause,
      orderBy: { expenseDate: 'desc' },
    });

    res.json({ expenses });
  } catch (error: any) {
    console.error('Error fetching expense records:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expense records' });
  }
});

/**
 * POST /api/v1/finance/expenses
 */
router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      title,
      category = 'MAINTENANCE',
      amount,
      expenseDate,
      paymentMethod = 'BANK_TRANSFER',
      bankAccountId,
      bankAccountName,
      vendorName,
      receiptNo,
      status = 'PAID',
      academicYear = '2026-27',
      notes,
    } = req.body;

    if (!title || amount === undefined) {
      return res.status(400).json({ error: 'title and amount are required' });
    }

    const parsedAmount = parseFloat(amount);
    const uniqueSeq = Math.floor(100000 + Math.random() * 900000);
    const isDonation = category === 'DONATION';
    const assignedReceiptNo = receiptNo || (isDonation ? `DON/2026-27/${uniqueSeq}` : `EXP/2026-27/${uniqueSeq}`);
    const assignedVoucherId = isDonation ? `DON-TAL-${uniqueSeq}` : `EXP-TAL-${uniqueSeq}`;

    let resolvedBankName = bankAccountName;
    if (!resolvedBankName && bankAccountId) {
      const bAccount = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
      if (bAccount) resolvedBankName = bAccount.accountName;
    }
    if (!resolvedBankName) {
      const primaryBank = await db.bankAccount.findFirst({ where: { orgId, isPrimary: true } });
      resolvedBankName = primaryBank?.accountName || 'HDFC Bank Main Account';
    }

    const expense = await db.expenseRecord.create({
      data: {
        orgId,
        title,
        category,
        amount: parsedAmount,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        paymentMethod,
        bankAccountId: bankAccountId || null,
        bankAccountName: resolvedBankName,
        vendorName: vendorName || (isDonation ? 'Endowment Donor' : 'Vendor Service'),
        receiptNo: assignedReceiptNo,
        tallyVoucherId: assignedVoucherId,
        status,
        academicYear,
        notes: notes || 'Expense recorded & queued for Tally Sync',
        tallySyncStatus: 'STAGED_FOR_TALLY',
      },
    });

    res.status(201).json({ expense });
  } catch (error: any) {
    console.error('Error creating expense record:', error);
    res.status(500).json({ error: error.message || 'Failed to create expense record' });
  }
});

/**
 * PUT /api/v1/finance/expenses/:id
 */
router.put('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      amount,
      expenseDate,
      paymentMethod,
      bankAccountName,
      vendorName,
      status,
      notes,
    } = req.body;

    const updated = await db.expenseRecord.update({
      where: { id: String(id) },
      data: {
        ...(title && { title }),
        ...(category && { category }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(expenseDate && { expenseDate: new Date(expenseDate) }),
        ...(paymentMethod && { paymentMethod }),
        ...(bankAccountName && { bankAccountName }),
        ...(vendorName && { vendorName }),
        ...(status && { status }),
        ...(notes && { notes }),
        tallySyncStatus: 'STAGED_FOR_TALLY',
        updatedAt: new Date(),
      },
    });

    res.json({ expense: updated });
  } catch (error: any) {
    console.error('Error updating expense record:', error);
    res.status(500).json({ error: error.message || 'Failed to update expense record' });
  }
});

/**
 * DELETE /api/v1/finance/expenses/:id
 */
router.delete('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.expenseRecord.delete({ where: { id: String(id) } });
    res.json({ success: true, message: 'Expense record deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting expense record:', error);
    res.status(500).json({ error: error.message || 'Failed to delete expense record' });
  }
});

// ============ SOCIETY & CORPUS FUNDS ROUTES ============

/**
 * GET /api/v1/finance/society-funds
 */
router.get('/society-funds', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    await ensureSampleFinanceData(orgId);
    const societyFunds = await db.societyFund.findMany({
      where: { orgId },
      orderBy: { fundDate: 'desc' },
    });
    res.json({ societyFunds });
  } catch (error: any) {
    console.error('Error fetching society funds:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch society funds' });
  }
});

/**
 * POST /api/v1/finance/society-funds
 */
router.post('/society-funds', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      fundName,
      fundType = 'CORPUS',
      contributingBody,
      amount,
      fundDate,
      isRestricted = false,
      purpose,
      bankAccountId,
      receiptNo,
      notes,
    } = req.body;

    if (!fundName || amount === undefined || !contributingBody) {
      return res.status(400).json({ error: 'fundName, contributingBody, and amount are required' });
    }

    const uniqueSeq = Math.floor(1000 + Math.random() * 9000);
    const assignedReceiptNo = receiptNo || `SOC/2026-27/${uniqueSeq}`;

    const societyFund = await db.societyFund.create({
      data: {
        orgId,
        fundName,
        fundType,
        contributingBody,
        amount: parseFloat(amount) || 0,
        fundDate: fundDate ? new Date(fundDate) : new Date(),
        isRestricted: Boolean(isRestricted),
        purpose: purpose || null,
        bankAccountId: bankAccountId || null,
        receiptNo: assignedReceiptNo,
        notes: notes || null,
        status: 'ACTIVE',
      },
    });

    res.status(201).json({ societyFund });
  } catch (error: any) {
    console.error('Error creating society fund:', error);
    res.status(500).json({ error: error.message || 'Failed to create society fund' });
  }
});

/**
 * PUT /api/v1/finance/society-funds/:id
 */
router.put('/society-funds/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fundName,
      fundType,
      contributingBody,
      amount,
      fundDate,
      isRestricted,
      purpose,
      bankAccountId,
      status,
      notes,
    } = req.body;

    const updated = await db.societyFund.update({
      where: { id: String(id) },
      data: {
        ...(fundName && { fundName }),
        ...(fundType && { fundType }),
        ...(contributingBody && { contributingBody }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(fundDate && { fundDate: new Date(fundDate) }),
        ...(isRestricted !== undefined && { isRestricted: Boolean(isRestricted) }),
        ...(purpose !== undefined && { purpose }),
        ...(bankAccountId !== undefined && { bankAccountId }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      },
    });

    res.json({ societyFund: updated });
  } catch (error: any) {
    console.error('Error updating society fund:', error);
    res.status(500).json({ error: error.message || 'Failed to update society fund' });
  }
});

/**
 * DELETE /api/v1/finance/society-funds/:id
 */
router.delete('/society-funds/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.societyFund.delete({ where: { id: String(id) } });
    res.json({ success: true, message: 'Society fund deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting society fund:', error);
    res.status(500).json({ error: error.message || 'Failed to delete society fund' });
  }
});

// ============ CASH IN HAND & PETTY CASH ROUTES ============

/**
 * GET /api/v1/finance/cash-registers
 */
router.get('/cash-registers', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    await ensureSampleFinanceData(orgId);
    const cashRegisters = await db.cashRegister.findMany({
      where: { orgId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ cashRegisters });
  } catch (error: any) {
    console.error('Error fetching cash registers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch cash registers' });
  }
});

/**
 * POST /api/v1/finance/cash-registers
 */
router.post('/cash-registers', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      registerName,
      custodianName,
      openingBalance = 0,
      currentBalance,
      isDefault = false,
    } = req.body;

    if (!registerName) {
      return res.status(400).json({ error: 'registerName is required' });
    }

    if (isDefault) {
      await db.cashRegister.updateMany({
        where: { orgId },
        data: { isDefault: false },
      });
    }

    const openBal = parseFloat(openingBalance) || 0;
    const curBal = currentBalance !== undefined ? parseFloat(currentBalance) : openBal;

    const cashRegister = await db.cashRegister.create({
      data: {
        orgId,
        registerName,
        custodianName: custodianName || 'Cashier',
        openingBalance: openBal,
        currentBalance: curBal,
        isDefault: Boolean(isDefault),
        isActive: true,
      },
    });

    res.status(201).json({ cashRegister });
  } catch (error: any) {
    console.error('Error creating cash register:', error);
    res.status(500).json({ error: error.message || 'Failed to create cash register' });
  }
});

/**
 * PUT /api/v1/finance/cash-registers/:id
 */
router.put('/cash-registers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { registerName, custodianName, currentBalance, isDefault } = req.body;

    const updated = await db.cashRegister.update({
      where: { id: String(id) },
      data: {
        ...(registerName && { registerName }),
        ...(custodianName !== undefined && { custodianName }),
        ...(currentBalance !== undefined && { currentBalance: parseFloat(currentBalance) }),
        ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
        updatedAt: new Date(),
      },
    });

    res.json({ cashRegister: updated });
  } catch (error: any) {
    console.error('Error updating cash register:', error);
    res.status(500).json({ error: error.message || 'Failed to update cash register' });
  }
});

/**
 * GET /api/v1/finance/cash-transactions
 */
router.get('/cash-transactions', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    const { registerId } = req.query;

    const where: any = { orgId };
    if (registerId) where.registerId = String(registerId);

    const cashTransactions = await db.cashTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      take: 100,
    });
    res.json({ cashTransactions });
  } catch (error: any) {
    console.error('Error fetching cash transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch cash transactions' });
  }
});

/**
 * POST /api/v1/finance/cash-transactions
 */
router.post('/cash-transactions', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      registerId,
      transactionType = 'CASH_IN', // CASH_IN, CASH_OUT, BANK_WITHDRAWAL, BANK_DEPOSIT
      amount,
      transactionDate,
      recipientOrPayer,
      category = 'PETTY_EXPENSE',
      voucherNumber,
      notes,
      bankAccountId, // For bank withdrawal/deposit contra transfer
    } = req.body;

    if (!registerId || amount === undefined) {
      return res.status(400).json({ error: 'registerId and amount are required' });
    }

    const parsedAmount = parseFloat(amount) || 0;
    const isOutflow = ['CASH_OUT', 'BANK_DEPOSIT', 'EXPENSE_PAYMENT'].includes(transactionType);
    const delta = isOutflow ? -parsedAmount : parsedAmount;

    // Update Cash Register Balance
    const register = await db.cashRegister.findUnique({ where: { id: registerId } });
    if (!register) return res.status(404).json({ error: 'Cash register not found' });

    const newCashBalance = Math.max(0, (register.currentBalance || 0) + delta);
    await db.cashRegister.update({
      where: { id: registerId },
      data: { currentBalance: newCashBalance },
    });

    // If Bank Transfer (Contra), update Bank Balance accordingly
    if (bankAccountId) {
      const bank = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
      if (bank) {
        const bankDelta = transactionType === 'BANK_WITHDRAWAL' ? -parsedAmount : parsedAmount;
        await db.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: (bank.currentBalance || 0) + bankDelta },
        });
      }
    }

    const uniqueVoucher = voucherNumber || `CSH-${Date.now().toString().slice(-6)}`;

    const cashTransaction = await db.cashTransaction.create({
      data: {
        orgId,
        registerId,
        transactionType,
        amount: parsedAmount,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        recipientOrPayer: recipientOrPayer || (isOutflow ? 'Cash Disbursement' : 'Cash Inflow'),
        category,
        voucherNumber: uniqueVoucher,
        notes: notes || null,
      },
    });

    res.status(201).json({ cashTransaction, newCashBalance });
  } catch (error: any) {
    console.error('Error recording cash transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to record cash transaction' });
  }
});

// ============ FIXED ASSET REGISTER & DEPRECIATION ROUTES ============

/**
 * GET /api/v1/finance/fixed-assets
 */
router.get('/fixed-assets', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });
    await ensureSampleFinanceData(orgId);

    const { category, status, search } = req.query;
    const where: any = { orgId };

    if (category && category !== 'ALL') where.category = String(category);
    if (status && status !== 'ALL') where.status = String(status);
    if (search) {
      where.OR = [
        { assetName: { contains: String(search), mode: 'insensitive' } },
        { assetCode: { contains: String(search), mode: 'insensitive' } },
        { location: { contains: String(search), mode: 'insensitive' } },
        { vendorName: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const fixedAssets = await db.fixedAsset.findMany({
      where,
      orderBy: { purchaseDate: 'desc' },
    });

    res.json({ fixedAssets });
  } catch (error: any) {
    console.error('Error fetching fixed assets:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch fixed assets' });
  }
});

/**
 * POST /api/v1/finance/fixed-assets
 */
router.post('/fixed-assets', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const {
      assetName,
      category = 'IT_HARDWARE',
      assetCode,
      purchaseDate,
      purchasePrice,
      vendorName,
      invoiceNo,
      location,
      depreciationRate = 10.0,
      depreciationMethod = 'STRAIGHT_LINE',
      notes,
    } = req.body;

    if (!assetName || purchasePrice === undefined) {
      return res.status(400).json({ error: 'assetName and purchasePrice are required' });
    }

    const price = parseFloat(purchasePrice) || 0;
    const rate = parseFloat(depreciationRate) || 0;
    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();

    const yearsElapsed = Math.max(0, (Date.now() - pDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const accumulatedDepreciation = Math.min(price, Math.round(price * (rate / 100) * yearsElapsed));
    const currentBookValue = Math.max(0, price - accumulatedDepreciation);

    const uniqueCode = assetCode || `AST-${Date.now().toString().slice(-6)}`;

    const fixedAsset = await db.fixedAsset.create({
      data: {
        orgId,
        assetName,
        category,
        assetCode: uniqueCode,
        purchaseDate: pDate,
        purchasePrice: price,
        vendorName: vendorName || 'Direct Vendor Purchase',
        invoiceNo: invoiceNo || `INV-${Date.now().toString().slice(-6)}`,
        location: location || 'Main Campus',
        depreciationRate: rate,
        depreciationMethod,
        accumulatedDepreciation,
        currentBookValue,
        status: 'ACTIVE',
        notes: notes || null,
      },
    });

    res.status(201).json({ fixedAsset });
  } catch (error: any) {
    console.error('Error creating fixed asset:', error);
    res.status(500).json({ error: error.message || 'Failed to create fixed asset' });
  }
});

/**
 * PUT /api/v1/finance/fixed-assets/:id
 */
router.put('/fixed-assets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      assetName,
      category,
      assetCode,
      purchasePrice,
      vendorName,
      invoiceNo,
      location,
      depreciationRate,
      status,
      notes,
    } = req.body;

    const current = await db.fixedAsset.findUnique({ where: { id: String(id) } });
    if (!current) return res.status(404).json({ error: 'Fixed asset not found' });

    const price = purchasePrice !== undefined ? parseFloat(purchasePrice) : current.purchasePrice;
    const rate = depreciationRate !== undefined ? parseFloat(depreciationRate) : current.depreciationRate;

    const pDate = new Date(current.purchaseDate);
    const yearsElapsed = Math.max(0, (Date.now() - pDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const accumulatedDepreciation = Math.min(price, Math.round(price * (rate / 100) * yearsElapsed));
    const currentBookValue = Math.max(0, price - accumulatedDepreciation);

    const updated = await db.fixedAsset.update({
      where: { id: String(id) },
      data: {
        ...(assetName && { assetName }),
        ...(category && { category }),
        ...(assetCode && { assetCode }),
        purchasePrice: price,
        ...(vendorName && { vendorName }),
        ...(invoiceNo && { invoiceNo }),
        ...(location && { location }),
        depreciationRate: rate,
        accumulatedDepreciation,
        currentBookValue,
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      },
    });

    res.json({ fixedAsset: updated });
  } catch (error: any) {
    console.error('Error updating fixed asset:', error);
    res.status(500).json({ error: error.message || 'Failed to update fixed asset' });
  }
});

/**
 * POST /api/v1/finance/fixed-assets/:id/depreciate
 */
router.post('/fixed-assets/:id/depreciate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await db.fixedAsset.findUnique({ where: { id: String(id) } });
    if (!asset) return res.status(404).json({ error: 'Fixed asset not found' });

    const pDate = new Date(asset.purchaseDate);
    const yearsElapsed = Math.max(1, Math.round((Date.now() - pDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
    const annualDepreciation = Math.round(asset.purchasePrice * (asset.depreciationRate / 100));
    const newAccumulated = Math.min(asset.purchasePrice, annualDepreciation * yearsElapsed);
    const newBookValue = Math.max(0, asset.purchasePrice - newAccumulated);

    const updated = await db.fixedAsset.update({
      where: { id: String(id) },
      data: {
        accumulatedDepreciation: newAccumulated,
        currentBookValue: newBookValue,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      fixedAsset: updated,
      annualDepreciation,
      message: `Annual depreciation of ₹${annualDepreciation.toLocaleString()} applied successfully.`,
    });
  } catch (error: any) {
    console.error('Error applying depreciation:', error);
    res.status(500).json({ error: error.message || 'Failed to apply depreciation' });
  }
});

/**
 * DELETE /api/v1/finance/fixed-assets/:id
 */
router.delete('/fixed-assets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.fixedAsset.delete({ where: { id: String(id) } });
    res.json({ success: true, message: 'Fixed asset deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting fixed asset:', error);
    res.status(500).json({ error: error.message || 'Failed to delete fixed asset' });
  }
});

/**
 * GET /api/v1/finance/tally/companies
 * Returns strictly real open Tally companies from Tally Prime XML server
 */
router.get('/tally/companies', async (req: Request, res: Response) => {
  try {
    let tallyCompanies: string[] = [];
    let isConnected = false;
    try {
      const xmlReq = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>Company Collection</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="Company Collection">
      <TYPE>Company</TYPE>
      <FETCH>Name</FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;
      const rawRes = await postToTallyHttp(xmlReq);
      isConnected = true;
      const matches1 = rawRes.match(/<(?:REMOTECMPNAME|NAME|SVCURRENTCOMPANY)>(.*?)<\/(?:REMOTECMPNAME|NAME|SVCURRENTCOMPANY)>/gi) || [];
      const matches2 = rawRes.match(/<COMPANY\s+NAME=["'](.*?)["']/gi) || [];
      const extracted1 = matches1.map((m) => m.replace(/<\/?(?:REMOTECMPNAME|NAME|SVCURRENTCOMPANY)>/gi, '').trim());
      const extracted2 = matches2.map((m) => m.replace(/<COMPANY\s+NAME=["']/i, '').replace(/["']$/, '').trim());
      const extracted = [...extracted1, ...extracted2].filter(Boolean);
      const systemKeywords = ['list of companies', 'xml', 'data', 'import', 'export data', 'vouchers', 'all masters', '$$sysname:xml', 'string', 'company collection'];
      tallyCompanies = Array.from(new Set(extracted)).filter((c) => !systemKeywords.includes(c.toLowerCase()));
    } catch (e) {
      isConnected = false;
    }

    res.json({
      success: true,
      tallyConnected: isConnected,
      companies: tallyCompanies,
      openTallyCompanies: tallyCompanies,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, tallyConnected: false, error: err.message });
  }
});

/**
 * POST /api/v1/finance/sync/tally
 * Connector endpoint to receive JSON/XML parsed ledgers from Tally or Busy sync agent
 */
router.post('/sync/tally', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const { force = false, source = 'Tally Prime', fees = [], payrolls = [], tallyCompanyName, companyName: reqCompanyName } = req.body;

    let updatedFeesCount = 0;
    let createdFeesCount = 0;
    let updatedPayrollsCount = 0;
    let createdPayrollsCount = 0;

    // 1. Ingest/Upsert incoming data from Tally/Busy into PostgreSQL database
    for (const f of fees) {
      const total = parseFloat(f.totalAmount || 0);
      const paid = parseFloat(f.paidAmount || 0);
      const pending = Math.max(0, total - paid);
      const studentRollNo = f.studentRollNo || `STU-${Math.floor(1000 + Math.random() * 9000)}`;
      const studentName = f.studentName || 'Student';
      const feeHeader = f.feeHeader || 'Tuition Fee';
      const tallyVoucherId = f.tallyVoucherId || null;

      let existingFee: any = null;
      if (tallyVoucherId) {
        existingFee = await db.studentFeeLedger.findFirst({
          where: { orgId, tallyVoucherId },
        });
      }
      if (!existingFee && studentRollNo) {
        existingFee = await db.studentFeeLedger.findFirst({
          where: { orgId, studentRollNo, feeHeader },
        });
      }
      if (!existingFee && studentName) {
        existingFee = await db.studentFeeLedger.findFirst({
          where: { orgId, studentName, feeHeader },
        });
      }

      if (existingFee) {
        // UPDATE existing record in PSQL
        await db.studentFeeLedger.update({
          where: { id: existingFee.id },
          data: {
            totalAmount: total || existingFee.totalAmount,
            paidAmount: paid,
            pendingBalance: pending,
            status: pending === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
            tallyVoucherId: tallyVoucherId || existingFee.tallyVoucherId,
            syncedAt: new Date(),
            notes: `Synced & updated via ${source} Connector`,
          },
        });
        updatedFeesCount++;
      } else {
        // CREATE missing record in PSQL (Data from Tally -> PSQL)
        await db.studentFeeLedger.create({
          data: {
            orgId,
            studentRollNo,
            studentName,
            feeHeader,
            academicYear: f.academicYear || '2026-27',
            totalAmount: total,
            paidAmount: paid,
            pendingBalance: pending,
            dueDate: f.dueDate ? new Date(f.dueDate) : new Date(Date.now() + 15 * 86400000),
            status: pending === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
            receiptNo: f.receiptNo || `REC/2026-27/${Math.floor(100000 + Math.random() * 900000)}`,
            tallyVoucherId: tallyVoucherId || `TAL-VOUCH-${Date.now()}`,
            tallySyncStatus: 'TALLY_MASTER_SYNCED',
            syncedAt: new Date(),
            notes: `Imported missing ledger from ${source}`,
          },
        });
        createdFeesCount++;
      }
    }

    for (const p of payrolls) {
      const basic = parseFloat(p.basicPay || 0);
      const allow = parseFloat(p.allowances || 0);
      const deduct = parseFloat(p.deductions || 0);
      const net = basic + allow - deduct;
      const employeeId = p.employeeId || null;
      const employeeName = p.employeeName || 'Faculty Member';
      const month = p.month || 'August';
      const year = parseInt(p.year || 2026);
      const tallyVoucherId = p.tallyVoucherId || null;

      let existingPayroll: any = null;
      if (tallyVoucherId) {
        existingPayroll = await prisma.payrollRecord.findFirst({
          where: { orgId, tallyVoucherId },
        });
      }
      if (!existingPayroll && employeeId) {
        existingPayroll = await prisma.payrollRecord.findFirst({
          where: { orgId, employeeId, month, year },
        });
      }
      if (!existingPayroll && employeeName) {
        existingPayroll = await prisma.payrollRecord.findFirst({
          where: { orgId, employeeName, month, year },
        });
      }

      if (existingPayroll) {
        // UPDATE existing record in PSQL
        await prisma.payrollRecord.update({
          where: { id: existingPayroll.id },
          data: {
            basicPay: basic || existingPayroll.basicPay,
            allowances: allow,
            deductions: deduct,
            netSalary: net,
            status: 'DISBURSED',
            tallyVoucherId: tallyVoucherId || existingPayroll.tallyVoucherId,
            syncedAt: new Date(),
          },
        });
        updatedPayrollsCount++;
      } else {
        // CREATE missing record in PSQL (Data from Tally -> PSQL)
        await prisma.payrollRecord.create({
          data: {
            orgId,
            employeeId: employeeId || `EMP-${Math.floor(100 + Math.random() * 900)}`,
            employeeName,
            designation: p.designation || 'Teacher',
            month,
            year,
            basicPay: basic,
            allowances: allow,
            deductions: deduct,
            netSalary: net,
            status: 'DISBURSED',
            tallyVoucherId: tallyVoucherId || `PAY-TAL-${Date.now()}`,
            syncedAt: new Date(),
          },
        });
        createdPayrollsCount++;
      }
    }

    // Determine target records to push to Tally live over HTTP:
    // If force === true: push ALL PSQL records (for changing company / full setup)
    // If force === false: push ONLY unsynced/queued PSQL records to Tally
    let targetFees: any[] = [];
    let targetPayrolls: any[] = [];

    if (force) {
      targetFees = await db.studentFeeLedger.findMany({ where: { orgId } });
      targetPayrolls = await prisma.payrollRecord.findMany({ where: { orgId } });
    } else {
      targetFees = await db.studentFeeLedger.findMany({
        where: {
          orgId,
          tallySyncStatus: { not: 'TALLY_MASTER_SYNCED' },
        },
      });
      if (targetFees.length === 0) {
        targetFees = await db.studentFeeLedger.findMany({ where: { orgId } });
      }

      targetPayrolls = await prisma.payrollRecord.findMany({
        where: {
          orgId,
          status: { not: 'DISBURSED' },
        },
      });
      if (targetPayrolls.length === 0) {
        targetPayrolls = await prisma.payrollRecord.findMany({ where: { orgId } });
      }
    }

    // Push target records to Tally live over HTTP Port 9000
    let tallyLiveStatus = 'Database synced';
    try {
      const allFees = targetFees;
      const allPayrolls = targetPayrolls;
      let companyName = tallyCompanyName || reqCompanyName || '';
      if (!companyName) {
        const currentOrg = orgId ? await prisma.organization.findUnique({ where: { id: orgId } }).catch(() => null) : null;
        companyName = currentOrg?.name || 'Convee Education';
      }
      const escapeXml = (str: string) =>
        (str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

      const formatYearTag = (yrStr?: string | number) => {
        if (!yrStr) return '2026-27';
        const str = String(yrStr).trim();
        if (str.length === 4) return `${str}-${(parseInt(str) + 1).toString().slice(2)}`;
        if (str.includes('-')) {
          const parts = str.split('-');
          if (parts[1] && parts[1].length === 4) return `${parts[0]}-${parts[1].slice(2)}`;
          return str;
        }
        return str;
      };

      const distinctYears = new Set<string>();
      allFees.forEach((f) => distinctYears.add(formatYearTag(f.academicYear)));
      allPayrolls.forEach((p) => distinctYears.add(formatYearTag(p.year)));
      if (distinctYears.size === 0) distinctYears.add('2026-27');      // Fetch active Bank Accounts, Cash Registers, Society Funds & Fixed Assets for dynamic Tally XML Export
      const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
      const activeRegisters = await db.cashRegister.findMany({ where: { orgId, isActive: true } }).catch(() => []);
      const allSocietyFunds = await db.societyFund.findMany({ where: { orgId } }).catch(() => []);
      const allFixedAssets = await db.fixedAsset.findMany({ where: { orgId } }).catch(() => []);

      const primaryBankObj = activeBanks.find((b: any) => b.isPrimary) || activeBanks[0];
      const defaultBankName = primaryBankObj?.accountName || 'HDFC Bank Main Account';

      const targetExpenses = force
        ? await db.expenseRecord.findMany({ where: { orgId } }).catch(() => [])
        : await db.expenseRecord.findMany({ where: { orgId, tallySyncStatus: { not: 'TALLY_MASTER_SYNCED' } } }).catch(() => []);
      const allExpenses = targetExpenses.length > 0 ? targetExpenses : await db.expenseRecord.findMany({ where: { orgId } }).catch(() => []);

      let mastersXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>All Masters</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>\n`;

      // Export Bank Account Ledgers dynamically to Tally
      const banksToExport = activeBanks.length > 0 ? activeBanks : [{ accountName: 'HDFC Bank Main Account' }];
      banksToExport.forEach((b: any) => {
        const bName = escapeXml(b.accountName);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${bName}" ACTION="Create">
     <NAME.LIST><NAME>${bName}</NAME></NAME.LIST>
     <PARENT>Bank Accounts</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      });

      // Export Cash-in-Hand Ledgers dynamically to Tally
      const registersToExport = activeRegisters.length > 0 ? activeRegisters : [{ registerName: 'Main Admissions Counter Cash Box' }];
      registersToExport.forEach((r: any) => {
        const rName = escapeXml(r.registerName);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${rName}" ACTION="Create">
     <NAME.LIST><NAME>${rName}</NAME></NAME.LIST>
     <PARENT>Cash-in-Hand</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      });

      // Export Society / Corpus Fund Ledgers dynamically to Tally under Capital Account
      allSocietyFunds.forEach((sf: any) => {
        const sfName = escapeXml(sf.fundName);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${sfName}" ACTION="Create">
     <NAME.LIST><NAME>${sfName}</NAME></NAME.LIST>
     <PARENT>Capital Account</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      });

      // Export Fixed Asset Ledgers dynamically to Tally under Fixed Assets
      allFixedAssets.forEach((fa: any) => {
        const faName = escapeXml(fa.assetName);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${faName}" ACTION="Create">
     <NAME.LIST><NAME>${faName}</NAME></NAME.LIST>
     <PARENT>Fixed Assets</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      });

      // 1. Create Year-Suffixed Groups and Master Ledgers for each Academic Year
      distinctYears.forEach((yr) => {
        const eYr = escapeXml(yr);
        // Tally Groups
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <GROUP NAME="Student Fee Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Student Fee Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Direct Incomes</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <GROUP NAME="Donations &amp; Grants Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Donations &amp; Grants Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Direct Incomes</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <GROUP NAME="Faculty Salary Expense [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Faculty Salary Expense [${eYr}]</NAME></NAME.LIST>
     <PARENT>Direct Expenses</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <GROUP NAME="Campus Operations &amp; Maintenance [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Campus Operations &amp; Maintenance [${eYr}]</NAME></NAME.LIST>
     <PARENT>Indirect Expenses</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <GROUP NAME="Institutional Depreciation Expense [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Institutional Depreciation Expense [${eYr}]</NAME></NAME.LIST>
     <PARENT>Indirect Expenses</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   
   <!-- Master Ledgers under Year Groups -->
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="Student Tuition &amp; Fees Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Student Tuition &amp; Fees Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Student Fee Income [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="Donation &amp; Grant Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Donation &amp; Grant Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Donations &amp; Grants Income [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="Campus Maintenance &amp; Operations Expense [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Campus Maintenance &amp; Operations Expense [${eYr}]</NAME></NAME.LIST>
     <PARENT>Campus Operations &amp; Maintenance [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="Faculty Salary Expense [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Faculty Salary Expense [${eYr}]</NAME></NAME.LIST>
     <PARENT>Faculty Salary Expense [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="Annual Asset Depreciation [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Annual Asset Depreciation [${eYr}]</NAME></NAME.LIST>
     <PARENT>Institutional Depreciation Expense [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      });

      // Helper to generate Tally Student Ledger Name per Academic Year & Student ID
      const getStudentLedgerName = (f: any) => {
        const yr = formatYearTag(f.academicYear);
        const idStr = f.studentRollNo ? ` (${f.studentRollNo})` : '';
        return escapeXml(`${f.studentName}${idStr} [${yr}]`);
      };

      // Helper to generate Tally Faculty Ledger Name per Academic Year & Employee ID
      const getFacultyLedgerName = (p: any) => {
        const yr = formatYearTag(p.year);
        const idStr = p.employeeId ? ` (${p.employeeId})` : '';
        return escapeXml(`${p.employeeName}${idStr} [${yr}]`);
      };

      for (const f of allFees) {
        const ledgerName = getStudentLedgerName(f);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${ledgerName}" ACTION="Create">
     <NAME.LIST><NAME>${ledgerName}</NAME></NAME.LIST>
     <PARENT>Sundry Debtors</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      }
      for (const p of allPayrolls) {
        const facLedgerName = getFacultyLedgerName(p);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${facLedgerName}" ACTION="Create">
     <NAME.LIST><NAME>${facLedgerName}</NAME></NAME.LIST>
     <PARENT>Sundry Creditors</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      }
      for (const e of allExpenses) {
        if (e.vendorName) {
          const vName = escapeXml(`${e.vendorName}`);
          mastersXml += `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${vName}" ACTION="Create">
     <NAME.LIST><NAME>${vName}</NAME></NAME.LIST>
     <PARENT>${e.category === 'DONATION' ? 'Sundry Debtors' : 'Sundry Creditors'}</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
        }
      }
      mastersXml += `  </DATA>
 </BODY>
</ENVELOPE>`;

      await postToTallyHttp(mastersXml);

      let createdVouchersCount = 0;

      // 1. Send Journal Vouchers (Fee Invoices -> Dynamic Income/Donation Ledger)
      for (let i = 0; i < allFees.length; i++) {
        const f = allFees[i];
        const yr = formatYearTag(f.academicYear);
        const partyLedger = getStudentLedgerName(f);
        const header = escapeXml(f.feeHeader || 'Tuition Fee');
        const isDonation = (f.feeHeader || '').toLowerCase().includes('donation') || (f.feeHeader || '').toLowerCase().includes('grant');
        const incomeLedgerName = isDonation ? `Donation &amp; Grant Income [${escapeXml(yr)}]` : `Student Tuition &amp; Fees Income [${escapeXml(yr)}]`;

        const rawInv = f.receiptNo ? f.receiptNo.replace('REC/', 'INV/') : (f.tallyVoucherId || `INV-${f.studentRollNo || f.id.slice(0, 8)}`);
        const invNum = rawInv.replace(/[^a-zA-Z0-9-]/g, '-');
        const totalStr = (f.totalAmount || f.paidAmount).toFixed(2);
        const invXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="CONVEE-INV-${invNum}" VTYPE="Journal" ACTION="Alter">
     <GUID>CONVEE-INV-${invNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Student Fee Demand Invoice - ${escapeXml(f.studentName)} (${header}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${invNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${partyLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${totalStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${incomeLedgerName}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>${totalStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
        await postToTallyHttp(invXml);
        createdVouchersCount++;
      }

      // 2. Send Receipt Vouchers (Fee Payments -> Dynamic Bank Account)
      for (let i = 0; i < allFees.length; i++) {
        const f = allFees[i];
        if (f.paidAmount > 0) {
          const partyLedger = getStudentLedgerName(f);
          const header = escapeXml(f.feeHeader || 'Tuition Fee');
          const rawRec = f.receiptNo || f.tallyVoucherId || `REC-${f.studentRollNo || f.id.slice(0, 8)}`;
          const recNum = rawRec.replace(/[^a-zA-Z0-9-]/g, '-');
          const paidStr = f.paidAmount.toFixed(2);
          const bankLedger = escapeXml(f.bankAccountName || defaultBankName);
          const recXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="CONVEE-REC-${recNum}" VTYPE="Receipt" ACTION="Alter">
     <GUID>CONVEE-REC-${recNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Student Fee Receipt Payment - ${escapeXml(f.studentName)} (${header}) [${f.academicYear || '2026-27'}]</NARRATION>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${recNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${bankLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>-${paidStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${partyLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>${paidStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
          await postToTallyHttp(recXml);
          createdVouchersCount++;
        }
      }

      // 3. Send Journal & Payment Vouchers for Faculty Payroll (Teacher Journal + Bank Payment)
      for (let i = 0; i < allPayrolls.length; i++) {
        const p = allPayrolls[i];
        if (p.netSalary > 0) {
          const yr = formatYearTag(p.year);
          const salaryExpenseLedger = `Faculty Salary Expense [${escapeXml(yr)}]`;
          const teacherLedger = getFacultyLedgerName(p);
          const payNum = (p.tallyVoucherId || `PAY-${p.employeeId}`).replace(/[^a-zA-Z0-9-]/g, '-');
          const jrnNum = `JRN-${payNum}`;
          const netStr = p.netSalary.toFixed(2);
          const bankLedger = escapeXml(p.bankAccountName || defaultBankName);

          // 3a. Teacher Journal Voucher (Salary Due / Provision)
          const facJrnXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="CONVEE-FAC-JRN-${jrnNum}" VTYPE="Journal" ACTION="Alter">
     <GUID>CONVEE-FAC-JRN-${jrnNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Faculty Salary Due Voucher - ${escapeXml(p.employeeName)} (${escapeXml(p.designation || 'Faculty')}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${jrnNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${teacherLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${salaryExpenseLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>-${netStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${teacherLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>${netStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
          await postToTallyHttp(facJrnXml);
          createdVouchersCount++;

          // 3b. Teacher Payment Voucher (Salary Disbursement to Bank)
          const payXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="CONVEE-PAY-${payNum}" VTYPE="Payment" ACTION="Alter">
     <GUID>CONVEE-PAY-${payNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Faculty Salary Disbursement - ${escapeXml(p.employeeName)} (${escapeXml(p.designation || 'Faculty')}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${payNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${teacherLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${teacherLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${netStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${bankLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>${netStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
          await postToTallyHttp(payXml);
          createdVouchersCount++;
        }
      }

      // 4. Send Payment / Receipt Vouchers for Other Expenses & Donations live to Tally
      for (let i = 0; i < allExpenses.length; i++) {
        const e = allExpenses[i];
        if (e.amount > 0) {
          const yr = formatYearTag(e.academicYear);
          const isDonation = e.category === 'DONATION';
          const expLedger = isDonation
            ? `Donation &amp; Grant Income [${escapeXml(yr)}]`
            : `Campus Maintenance &amp; Operations Expense [${escapeXml(yr)}]`;
          const bankLedger = escapeXml(e.bankAccountName || defaultBankName);
          const expNum = (e.receiptNo || e.tallyVoucherId || `EXP-${e.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
          const amtStr = e.amount.toFixed(2);
          const vType = isDonation ? 'Receipt' : 'Payment';

          const expXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="CONVEE-EXP-${expNum}" VTYPE="${vType}" ACTION="Alter">
     <GUID>CONVEE-EXP-${expNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>${isDonation ? 'Donation / Grant Income Received' : 'Other Expense Paid'} - ${escapeXml(e.title)} (${escapeXml(e.vendorName || 'Vendor')}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${expNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${expLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${isDonation ? bankLedger : expLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${isDonation ? expLedger : bankLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
          await postToTallyHttp(expXml);
          createdVouchersCount++;
        }
      }

      // 5. Send Society Fund Capital Inflow Receipt Vouchers to Tally
      for (let i = 0; i < allSocietyFunds.length; i++) {
        const sf = allSocietyFunds[i];
        if (sf.amount > 0) {
          const sfName = escapeXml(sf.fundName);
          const sfNum = (sf.receiptNo || `SOC-${sf.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
          const amtStr = sf.amount.toFixed(2);
          const bankLedger = escapeXml(defaultBankName);

          const sfXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <VOUCHER REMOTEID="CONVEE-SOC-${sfNum}" VTYPE="Receipt" ACTION="Alter">
     <GUID>CONVEE-SOC-${sfNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Society / Corpus Capital Fund Inflow - ${sfName} (${escapeXml(sf.contributingBody)})</NARRATION>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${sfNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${sfName}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${bankLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>-${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${sfName}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
          await postToTallyHttp(sfXml);
          createdVouchersCount++;
        }
      }

      // 6. Send Fixed Asset Annual Depreciation Journal Vouchers to Tally
      for (let i = 0; i < allFixedAssets.length; i++) {
        const fa = allFixedAssets[i];
        if (fa.accumulatedDepreciation > 0) {
          const faName = escapeXml(fa.assetName);
          const depNum = `DEP-${(fa.assetCode || fa.id.slice(0, 6)).replace(/[^a-zA-Z0-9-]/g, '-')}`;
          const amtStr = fa.accumulatedDepreciation.toFixed(2);
          const depExpenseLedger = `Annual Asset Depreciation [2026-27]`;

          const depXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <VOUCHER REMOTEID="CONVEE-DEP-${depNum}" VTYPE="Journal" ACTION="Alter">
     <GUID>CONVEE-DEP-${depNum}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Annual Fixed Asset Depreciation - ${faName} (${escapeXml(fa.category)})</NARRATION>
     <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${depNum}</VOUCHERNUMBER>
     <PARTYLEDGERNAME>${depExpenseLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${depExpenseLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>-${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${faName}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
          await postToTallyHttp(depXml);
          createdVouchersCount++;
        }
      }

      tallyLiveStatus = `Pushed ${createdVouchersCount} vouchers live to Tally Prime (Port 9000)`;
    } catch (err: any) {
      console.log('Tally HTTP Port 9000 connection error:', err.message);
      return res.status(503).json({
        success: false,
        tallyConnected: false,
        error: 'Unable to Sync: Tally Prime is not live on http://localhost:9000. Please start Tally software and verify HTTP XML server is enabled.',
      });
    }

    // Mark staged fee ledgers as TALLY_MASTER_SYNCED in DB
    if (targetFees.length > 0) {
      const feeIds = targetFees.map((f) => f.id);
      await db.studentFeeLedger.updateMany({
        where: { id: { in: feeIds } },
        data: {
          tallySyncStatus: 'TALLY_MASTER_SYNCED',
          syncedAt: new Date(),
          notes: 'Synced with Tally Prime',
        },
      });
    }

    res.json({
      success: true,
      tallyConnected: true,
      message: `Tally Sync complete (${tallyLiveStatus}): ${updatedFeesCount + createdFeesCount} fee ledgers matched (${updatedFeesCount} updated, ${createdFeesCount} added) & ${updatedPayrollsCount + createdPayrollsCount} payroll vouchers matched.`,
      syncedAt: new Date(),
    });
  } catch (error: any) {
    console.error('Error running Tally/Busy sync:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to sync with Tally/Busy' });
  }
});

export default router;
// Tally Master Sync Engine initialized

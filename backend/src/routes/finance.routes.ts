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

    const count = await db.studentFeeLedger.count({ where: { orgId } });
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

    const totalFeesCollected = feeLedgers.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
    const totalPendingDues = feeLedgers.reduce((sum, f) => sum + (f.pendingBalance || 0), 0);
    const totalPayrollDisbursed = payrollRecords.reduce((sum, p) => sum + (p.netSalary || 0), 0);

    const pendingCount = feeLedgers.filter((f) => f.status === 'PENDING' || f.status === 'OVERDUE').length;
    const paidCount = feeLedgers.filter((f) => f.status === 'PAID').length;

    res.json({
      summary: {
        totalFeesCollected,
        totalPendingDues,
        totalPayrollDisbursed,
        totalStudentsBilled: feeLedgers.length,
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
      if (distinctYears.size === 0) distinctYears.add('2026-27');

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
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="HDFC Bank Main Account" ACTION="Create">
     <NAME.LIST><NAME>HDFC Bank Main Account</NAME></NAME.LIST>
     <PARENT>Bank Accounts</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;

      // 1. Create Year-Suffixed Groups and Master Ledgers for each Academic Year
      distinctYears.forEach((yr) => {
        const eYr = escapeXml(yr);
        // Tally Groups
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <GROUP NAME="Student Fee Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Student Fee Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Direct Incomes</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <GROUP NAME="Donations &amp; Grants Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Donations &amp; Grants Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Direct Incomes</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <GROUP NAME="Faculty Salary Expense [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Faculty Salary Expense [${eYr}]</NAME></NAME.LIST>
     <PARENT>Direct Expenses</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <GROUP NAME="Campus Operations &amp; Maintenance [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Campus Operations &amp; Maintenance [${eYr}]</NAME></NAME.LIST>
     <PARENT>Indirect Expenses</PARENT>
    </GROUP>
   </TALLYMESSAGE>
   
   <!-- Master Ledgers under Year Groups -->
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="Student Tuition &amp; Fees Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Student Tuition &amp; Fees Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Student Fee Income [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="Donation &amp; Grant Income [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Donation &amp; Grant Income [${eYr}]</NAME></NAME.LIST>
     <PARENT>Donations &amp; Grants Income [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="Faculty Salary Expense [${eYr}]" ACTION="Create">
     <NAME.LIST><NAME>Faculty Salary Expense [${eYr}]</NAME></NAME.LIST>
     <PARENT>Faculty Salary Expense [${eYr}]</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      });

      // Helper to generate Tally Student Ledger Name per Academic Year & Student ID
      const getStudentLedgerName = (f: any) => {
        const yr = formatYearTag(f.academicYear);
        const idStr = f.studentRollNo ? ` (${f.studentRollNo})` : '';
        return escapeXml(`${f.studentName}${idStr} [${yr}]`);
      };

      for (const f of allFees) {
        const ledgerName = getStudentLedgerName(f);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${ledgerName}" ACTION="Create">
     <NAME.LIST><NAME>${ledgerName}</NAME></NAME.LIST>
     <PARENT>Sundry Debtors</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
      }
      for (const p of allPayrolls) {
        const yr = formatYearTag(p.year);
        const eName = escapeXml(`${p.employeeName} [${yr}]`);
        mastersXml += `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${eName}" ACTION="Create">
     <NAME.LIST><NAME>${eName}</NAME></NAME.LIST>
     <PARENT>Sundry Creditors</PARENT>
    </LEDGER>
   </TALLYMESSAGE>\n`;
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

      // 2. Send Receipt Vouchers (Fee Payments -> Identical structure to Teacher Payroll Vouchers)
      for (let i = 0; i < allFees.length; i++) {
        const f = allFees[i];
        if (f.paidAmount > 0) {
          const partyLedger = getStudentLedgerName(f);
          const header = escapeXml(f.feeHeader || 'Tuition Fee');
          const rawRec = f.receiptNo || f.tallyVoucherId || `REC-${f.studentRollNo || f.id.slice(0, 8)}`;
          const recNum = rawRec.replace(/[^a-zA-Z0-9-]/g, '-');
          const paidStr = f.paidAmount.toFixed(2);
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
      <LEDGERNAME>HDFC Bank Main Account</LEDGERNAME>
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

      // Send Payment Vouchers (Faculty Payroll - Smart Upsert)
      for (let i = 0; i < allPayrolls.length; i++) {
        const p = allPayrolls[i];
        if (p.netSalary > 0) {
          const yr = formatYearTag(p.year);
          const salaryExpenseLedger = `Faculty Salary Expense [${escapeXml(yr)}]`;
          const empLedgerName = escapeXml(`${p.employeeName} [${yr}]`);
          const payNum = (p.tallyVoucherId || `PAY-${p.employeeId}`).replace(/[^a-zA-Z0-9-]/g, '-');
          const netStr = p.netSalary.toFixed(2);
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
     <PARTYLEDGERNAME>${salaryExpenseLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${salaryExpenseLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${netStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>HDFC Bank Main Account</LEDGERNAME>
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

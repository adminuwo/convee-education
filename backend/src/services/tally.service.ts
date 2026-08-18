import http from 'http';
import prisma from '../db/prisma';

const db = prisma as any;

export interface TallySyncResult {
  success: boolean;
  tallyConnected: boolean;
  createdCount?: number;
  deletedCount?: number;
  error?: string;
  response?: string;
}

export function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatYearTag(yrStr?: string | number): string {
  if (!yrStr) return '2026-27';
  const str = String(yrStr).trim();
  if (str.length === 4) return `${str}-${(parseInt(str) + 1).toString().slice(2)}`;
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts[1] && parts[1].length === 4) return `${parts[0]}-${parts[1].slice(2)}`;
    return str;
  }
  return str;
}

export function getStudentLedgerName(f: any): string {
  const yr = formatYearTag(f.academicYear);
  const cleanName = escapeXml(f.studentName || 'Student');
  const cleanRoll = escapeXml(f.studentRollNo || f.id?.slice(0, 8) || 'STU');
  return `${cleanName} [${cleanRoll}] [${yr}]`;
}

export function getFacultyLedgerName(p: any): string {
  const yr = formatYearTag(p.year);
  const cleanName = escapeXml(p.employeeName || 'Faculty');
  const cleanId = escapeXml(p.employeeId || p.id?.slice(0, 8) || 'FAC');
  return `${cleanName} [${cleanId}] [${yr}]`;
}

let cachedTallyCompanyName: string | null = null;
let lastCompanyFetchTime = 0;

export async function getActiveTallyCompanyFromLive(timeoutMs = 1500): Promise<string | null> {
  const now = Date.now();
  if (cachedTallyCompanyName && (now - lastCompanyFetchTime) < 30000) {
    return cachedTallyCompanyName;
  }
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>List of Companies</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="List of Companies">
      <TYPE>Company</TYPE>
      <FETCH>NAME</FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;
    const res = await postToTallyHttp(xml, timeoutMs);
    const match = res.match(/<NAME[^>]*>([^<]+)<\/NAME>/i) || res.match(/<COMPANY[^>]*>([^<]+)<\/COMPANY>/i);
    if (match && match[1].trim()) {
      cachedTallyCompanyName = match[1].trim();
      lastCompanyFetchTime = now;
      return cachedTallyCompanyName;
    }
  } catch {}
  return null;
}

export async function getCompanyName(orgId?: string | null, overrideName?: string): Promise<string> {
  if (overrideName && overrideName.trim()) return overrideName.trim();
  
  // 1. Try to get the active company loaded in Tally Prime
  const activeTallyCompany = await getActiveTallyCompanyFromLive();
  if (activeTallyCompany) return activeTallyCompany;

  if (!orgId) return 'Convee';
  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    return org?.name || 'Convee';
  } catch {
    return 'Convee';
  }
}

/**
 * Low-level HTTP POST to Tally Prime XML HTTP Server (127.0.0.1:9000 / localhost:9000)
 */
export function postToTallyHttp(xmlData: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 9000,
        method: 'POST',
        timeout: timeoutMs,
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

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tally Prime connection timed out (port 9000)'));
    });

    req.on('error', (err) => reject(err));
    req.write(xmlData, 'utf-8');
    req.end();
  });
}

/**
 * Fast health check probe to verify if Tally Prime is active on port 9000
 */
export async function isTallyOnline(timeoutMs = 2000): Promise<boolean> {
  const pingXml = `<?xml version="1.0" encoding="UTF-8"?>
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
  try {
    const res = await postToTallyHttp(pingXml, timeoutMs);
    return Boolean(res && (res.includes('<ENVELOPE') || res.includes('<BODY') || res.includes('COMPANY') || res.includes('TallyPrime')));
  } catch {
    return false;
  }
}

// =========================================================================
// TOMBSTONE & ANTI-RESURRECTION REGISTRY
// =========================================================================

export async function recordTombstone(
  orgId: string,
  entityType: 'FEE' | 'EXPENSE' | 'PAYROLL' | 'SOCIETY_FUND' | 'FIXED_ASSET' | 'CASH_TRANSACTION' | 'BANK_ACCOUNT',
  entityId: string,
  voucherNumber?: string | null,
  remoteIds: string[] = []
): Promise<void> {
  try {
    for (const rId of remoteIds) {
      if (!rId) continue;
      const tombstoneId = `tmb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "TallyTombstone" ("id", "orgId", "entityType", "entityId", "voucherNumber", "remoteId", "tallySyncStatus", "deletedAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        tombstoneId,
        orgId,
        entityType,
        entityId,
        voucherNumber || null,
        rId,
        'PENDING_TALLY_DELETE'
      ).catch(async () => {
        // In case table or query needs fallback
        if (db.tallyTombstone) {
          await db.tallyTombstone.create({
            data: {
              orgId,
              entityType,
              entityId,
              voucherNumber: voucherNumber || null,
              remoteId: rId,
              tallySyncStatus: 'PENDING_TALLY_DELETE',
            },
          }).catch(() => {});
        }
      });
    }
  } catch (err: any) {
    console.error('Error recording Tally tombstone:', err.message);
  }
}

export async function isTombstoned(orgId: string, voucherNumber?: string | null, remoteId?: string | null): Promise<boolean> {
  if (!orgId) return false;
  try {
    const vNum = voucherNumber || null;
    const rId = remoteId || null;
    if (!vNum && !rId) return false;

    const rows: any = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "TallyTombstone"
       WHERE "orgId" = $1 AND (
         ($2::text IS NOT NULL AND "remoteId" = $2::text) OR
         ($3::text IS NOT NULL AND "voucherNumber" = $3::text)
       )
       LIMIT 1`,
      orgId,
      rId,
      vNum
    ).catch(() => null);

    if (Array.isArray(rows) && rows.length > 0) {
      return true;
    }

    if (db.tallyTombstone) {
      const conditions: any[] = [];
      if (remoteId) conditions.push({ remoteId });
      if (voucherNumber) conditions.push({ voucherNumber });
      const count = await db.tallyTombstone.count({
        where: { orgId, OR: conditions },
      }).catch(() => 0);
      return count > 0;
    }

    return false;
  } catch {
    return false;
  }
}

export async function flushPendingTombstones(orgId: string, companyName: string): Promise<number> {
  try {
    let pending: any[] = [];
    const rawRows: any = await prisma.$queryRawUnsafe(
      `SELECT "id", "remoteId" FROM "TallyTombstone"
       WHERE "orgId" = $1 AND "tallySyncStatus" = 'PENDING_TALLY_DELETE'`,
      orgId
    ).catch(() => null);

    if (Array.isArray(rawRows)) {
      pending = rawRows;
    } else if (db.tallyTombstone) {
      pending = await db.tallyTombstone.findMany({
        where: { orgId, tallySyncStatus: 'PENDING_TALLY_DELETE' },
      }).catch(() => []);
    }

    if (!Array.isArray(pending) || pending.length === 0) return 0;

    let purgedCount = 0;
    for (const item of pending) {
      if (item.remoteId) {
        try {
          await deleteVoucherFromTally(item.remoteId, '', '', companyName);
          purgedCount++;
        } catch {
          // ignore individual delete failure
        }
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "TallyTombstone"
       SET "tallySyncStatus" = 'TALLY_PURGED'
       WHERE "orgId" = $1 AND "tallySyncStatus" = 'PENDING_TALLY_DELETE'`,
      orgId
    ).catch(() => {});

    return purgedCount;
  } catch {
    return 0;
  }
}

/**
 * Bi-Directional Reconciliation & Diff Engine:
 * Fetches all existing vouchers from Tally Prime (Port 9000).
 * Detects any vouchers in Tally that were deleted directly from PostgreSQL database.
 * Dispatches batch XML delete/cancel commands to Tally Prime to keep both systems 100% synchronized!
 */
export async function reconcileAndPurgeOrphanedVouchers(orgId: string, companyName: string): Promise<number> {
  try {
    const isOnline = await isTallyOnline(2000);
    if (!isOnline) return 0;

    // 1. Fetch all active PostgreSQL records for this organization
    const [fees, payrolls, expenses, societyFunds, fixedAssets, cashTxs] = await Promise.all([
      db.studentFeeLedger.findMany({ where: { orgId } }).catch(() => []),
      db.payrollRecord.findMany({ where: { orgId } }).catch(() => []),
      db.expenseRecord.findMany({ where: { orgId } }).catch(() => []),
      db.societyFund.findMany({ where: { orgId } }).catch(() => []),
      db.fixedAsset.findMany({ where: { orgId } }).catch(() => []),
      db.cashTransaction.findMany({ where: { orgId } }).catch(() => []),
    ]);

    // 2. Fetch all vouchers currently present in Tally Prime
    const exportXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>All Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="All Vouchers">
      <TYPE>Voucher</TYPE>
      <FETCH>REMOTEID, GUID, VOUCHERNUMBER, VOUCHERTYPENAME, DATE, NARRATION, VCHKEY, VCHTYPE</FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;

    const rawRes = await postToTallyHttp(exportXml, 15000);
    const vRegex = /<VOUCHER\s+([^>]*?)>([\s\S]*?)<\/VOUCHER>/gi;
    let match;
    let deleteMessages = '';
    let purgedCount = 0;

    while ((match = vRegex.exec(rawRes)) !== null) {
      const vAttrs = match[1];
      const vContent = match[2];
      const rIdMatch = vAttrs.match(/REMOTEID=["'](.*?)["']/i) || vContent.match(/<REMOTEID.*?>(.*?)<\/REMOTEID>/i);
      const vTypeMatch = vAttrs.match(/VTYPE=["'](.*?)["']/i) || vAttrs.match(/VCHTYPE=["'](.*?)["']/i) || vContent.match(/<VOUCHERTYPENAME.*?>(.*?)<\/VOUCHERTYPENAME>/i);
      const vNumMatch = vContent.match(/<VOUCHERNUMBER.*?>(.*?)<\/VOUCHERNUMBER>/i);
      const guidMatch = vContent.match(/<GUID.*?>(.*?)<\/GUID>/i);
      const narrationMatch = vContent.match(/<NARRATION.*?>(.*?)<\/NARRATION>/i);
      const dateMatch = vContent.match(/<DATE.*?>(.*?)<\/DATE>/i);

      const remoteId = rIdMatch?.[1] || '';
      const guid = guidMatch?.[1] || remoteId;
      const vType = vTypeMatch?.[1] || 'Journal';
      const vNum = vNumMatch?.[1] || '';
      const narration = narrationMatch?.[1] || '';
      const date = dateMatch?.[1] || '20260401';

      if (narration.includes('[DELETED FROM DATABASE]') || narration.includes('CANCELLED')) {
        continue;
      }

      let isConveeVoucher = false;
      let existsInDb = false;
      let moduleType: 'FEE' | 'EXPENSE' | 'PAYROLL' | 'SOCIETY_FUND' | 'FIXED_ASSET' | 'CASH_TRANSACTION' = 'FEE';

      if (narration.includes('Faculty Salary') || remoteId.includes('CONVEE-FAC-JRN') || remoteId.includes('CONVEE-PAY')) {
        isConveeVoucher = true;
        moduleType = 'PAYROLL';
        existsInDb = payrolls.some((p: any) => narration.includes(p.employeeName) || (p.employeeId && narration.includes(p.employeeId)));
      } else if (narration.includes('Student Fee Demand Invoice') || remoteId.includes('CONVEE-INV')) {
        isConveeVoucher = true;
        moduleType = 'FEE';
        existsInDb = fees.some((f: any) => narration.includes(f.studentName) || (f.studentRollNo && narration.includes(f.studentRollNo)) || (f.receiptNo && narration.includes(f.receiptNo.replace('REC/', 'INV/'))));
      } else if (narration.includes('Student Fee Receipt Payment') || remoteId.includes('CONVEE-REC')) {
        isConveeVoucher = true;
        moduleType = 'FEE';
        existsInDb = fees.some((f: any) => f.paidAmount > 0 && (narration.includes(f.studentName) || (f.studentRollNo && narration.includes(f.studentRollNo)) || (f.receiptNo && narration.includes(f.receiptNo))));
      } else if (narration.includes('Other Expense Paid') || narration.includes('Donation / Grant Income') || remoteId.includes('CONVEE-EXP')) {
        isConveeVoucher = true;
        moduleType = 'EXPENSE';
        existsInDb = expenses.some((e: any) => (e.title && narration.includes(e.title)) || (e.receiptNo && narration.includes(e.receiptNo)));
      } else if (narration.includes('Capital Corpus Inflow') || remoteId.includes('CONVEE-SOC')) {
        isConveeVoucher = true;
        moduleType = 'SOCIETY_FUND';
        existsInDb = societyFunds.some((sf: any) => sf.fundName && narration.includes(sf.fundName));
      } else if (narration.includes('Annual Fixed Asset Depreciation') || remoteId.includes('CONVEE-DEP')) {
        isConveeVoucher = true;
        moduleType = 'FIXED_ASSET';
        existsInDb = fixedAssets.some((fa: any) => fa.assetName && narration.includes(fa.assetName));
      } else if (narration.includes('Cash') || narration.includes('Petty Cash') || remoteId.includes('CONVEE-CSH') || remoteId.includes('CONVEE-WITH')) {
        isConveeVoucher = true;
        moduleType = 'CASH_TRANSACTION';
        existsInDb = cashTxs.some((c: any) => (c.voucherNumber && narration.includes(c.voucherNumber)) || (c.recipientOrPayer && narration.includes(c.recipientOrPayer)) || (c.notes && narration.includes(c.notes)));
      }

      if (isConveeVoucher && !existsInDb) {
        purgedCount++;
        const targetRemoteId = remoteId && remoteId.startsWith('CONVEE-') ? remoteId : guid;
        if (targetRemoteId) {
          deleteMessages += `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="${escapeXml(targetRemoteId)}" ACTION="Delete">
     <GUID>${escapeXml(targetRemoteId)}</GUID>
     <VOUCHERTYPENAME>${escapeXml(vType)}</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${escapeXml(vNum)}</VOUCHERNUMBER>
    </VOUCHER>
   </TALLYMESSAGE>\n`;
        }

        await recordTombstone(orgId, moduleType, vNum || remoteId, vNum, [remoteId, guid]);
      }
    }

    if (deleteMessages.trim()) {
      const purgeXml = `<?xml version="1.0" encoding="UTF-8"?>
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
${deleteMessages}  </DATA>
 </BODY>
</ENVELOPE>`;
      await postToTallyHttp(purgeXml, 15000);
    }

    return purgedCount;
  } catch (err: any) {
    console.error('Error during reconcileAndPurgeOrphanedVouchers:', err.message);
    return 0;
  }
}

// =========================================================================
// MASTER LEDGER SYNC & DELETE
// =========================================================================

export async function syncMasterToTally(
  ledgerName: string,
  parentGroup: string,
  openingBalance = 0,
  companyName: string,
  action: 'Create' | 'Alter' = 'Alter'
): Promise<boolean> {
  const lName = escapeXml(ledgerName);
  const pGroup = escapeXml(parentGroup);
  const opBal = openingBalance !== 0
    ? `\n     <OPENINGBALANCE>${openingBalance < 0 ? openingBalance.toFixed(2) : `-${openingBalance.toFixed(2)}`}</OPENINGBALANCE>`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${lName}" ACTION="${action}">
     <NAME.LIST><NAME>${lName}</NAME></NAME.LIST>
     <PARENT>${pGroup}</PARENT>${opBal}
    </LEDGER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;

  try {
    await postToTallyHttp(xml);
    return true;
  } catch {
    return false;
  }
}

export async function deleteMasterFromTally(ledgerName: string, companyName: string): Promise<boolean> {
  const lName = escapeXml(ledgerName);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
   <TALLYMESSAGE xmlns:UDF="TALLYUDF">
    <LEDGER NAME="${lName}" ACTION="Delete">
    </LEDGER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;

  try {
    await postToTallyHttp(xml);
    return true;
  } catch {
    return false;
  }
}

// =========================================================================
// VOUCHER DELETION ENGINE
// =========================================================================

export async function deleteVoucherFromTally(
  remoteId: string,
  voucherTypeName = '',
  voucherNumber = '',
  companyName: string
): Promise<boolean> {
  const rId = escapeXml(remoteId);
  const vType = escapeXml(voucherTypeName);
  const vNum = escapeXml(voucherNumber);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <VOUCHER REMOTEID="${rId}" ACTION="Delete">
     <GUID>${rId}</GUID>
     ${vType ? `<VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>` : ''}
     ${vNum ? `<VOUCHERNUMBER>${vNum}</VOUCHERNUMBER>` : ''}
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;

  try {
    await postToTallyHttp(xml);
    return true;
  } catch {
    return false;
  }
}

// =========================================================================
// REAL-TIME SYNC HANDLERS PER MODULE
// =========================================================================

/**
 * 1. Sync Student Fee (Master Ledger + Demand Invoice + Receipt Payment)
 */
export async function syncFeeLive(fee: any, orgId: string): Promise<boolean> {
  try {
    const companyName = await getCompanyName(orgId);
    const yr = formatYearTag(fee.academicYear);
    const studentLedger = getStudentLedgerName(fee);

    // Master
    await syncMasterToTally(studentLedger, 'Sundry Debtors', 0, companyName);

    const isDonation = (fee.feeHeader || '').toLowerCase().includes('donation') || (fee.feeHeader || '').toLowerCase().includes('grant');
    const incomeLedger = isDonation ? `Donation & Grant Income [${yr}]` : `Student Tuition & Fees Income [${yr}]`;
    await syncMasterToTally(incomeLedger, 'Direct Incomes', 0, companyName);

    const rawInv = fee.receiptNo ? fee.receiptNo.replace('REC/', 'INV/') : (fee.tallyVoucherId || `INV-${fee.studentRollNo || fee.id.slice(0, 8)}`);
    const invNum = rawInv.replace(/[^a-zA-Z0-9-]/g, '-');
    const totalStr = (fee.totalAmount || fee.paidAmount).toFixed(2);

    // Journal Invoice Voucher
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
     <NARRATION>Student Fee Demand Invoice - ${escapeXml(fee.studentName)} (${escapeXml(fee.feeHeader || 'Tuition')}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${invNum}</VOUCHERNUMBER>
     <REFERENCE>${invNum}</REFERENCE>
     <PARTYLEDGERNAME>${escapeXml(studentLedger)}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(studentLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${totalStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${escapeXml(incomeLedger)}</LEDGERNAME>
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

    // Receipt Payment Voucher if paid > 0
    if (fee.paidAmount > 0) {
      const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
      const activeRegisters = await db.cashRegister.findMany({ where: { orgId, isActive: true } }).catch(() => []);
      const defaultCashName = activeRegisters[0]?.registerName || 'Main Admissions Counter Cash Box';
      const defaultBankName = activeBanks[0]?.accountName || 'HDFC Bank Main Account';

      const rawRec = fee.receiptNo || fee.tallyVoucherId || `REC-${fee.studentRollNo || fee.id.slice(0, 8)}`;
      const recNum = rawRec.replace(/[^a-zA-Z0-9-]/g, '-');
      const paidStr = fee.paidAmount.toFixed(2);
      const isCash = (fee.paymentMethod || '').toUpperCase().includes('CASH');
      const destinationLedger = isCash ? escapeXml(defaultCashName) : escapeXml(fee.bankAccountName || defaultBankName);

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
     <NARRATION>Student Fee Receipt Payment - ${escapeXml(fee.studentName)} (${escapeXml(fee.feeHeader || 'Tuition')}) [${yr}] via ${isCash ? 'Cash' : 'Bank'}</NARRATION>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${recNum}</VOUCHERNUMBER>
     <REFERENCE>${recNum}</REFERENCE>
     <PARTYLEDGERNAME>${studentLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${destinationLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>-${paidStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${studentLedger}</LEDGERNAME>
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
    }

    return true;
  } catch (err: any) {
    return false;
  }
}

/**
 * Delete Student Fee from Tally & record Tombstone
 */
export async function deleteFeeLive(fee: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  const rawInv = fee.receiptNo ? fee.receiptNo.replace('REC/', 'INV/') : (fee.tallyVoucherId || `INV-${fee.studentRollNo || fee.id.slice(0, 8)}`);
  const invNum = rawInv.replace(/[^a-zA-Z0-9-]/g, '-');
  const invRemoteId = `CONVEE-INV-${invNum}`;

  const rawRec = fee.receiptNo || fee.tallyVoucherId || `REC-${fee.studentRollNo || fee.id.slice(0, 8)}`;
  const recNum = rawRec.replace(/[^a-zA-Z0-9-]/g, '-');
  const recRemoteId = `CONVEE-REC-${recNum}`;

  await recordTombstone(orgId, 'FEE', fee.id, fee.receiptNo || fee.tallyVoucherId, [invRemoteId, recRemoteId]);

  try {
    await deleteVoucherFromTally(invRemoteId, 'Journal', invNum, companyName);
    if (fee.paidAmount > 0) {
      await deleteVoucherFromTally(recRemoteId, 'Receipt', recNum, companyName);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 2. Sync Expense / Donation Live
 */
export async function syncExpenseLive(expense: any, orgId: string): Promise<boolean> {
  try {
    const companyName = await getCompanyName(orgId);
    const yr = formatYearTag(expense.academicYear);
    const isDonation = expense.category === 'DONATION';

    if (expense.vendorName) {
      await syncMasterToTally(
        expense.vendorName,
        isDonation ? 'Sundry Debtors' : 'Sundry Creditors',
        0,
        companyName
      );
    }

    const expLedger = isDonation
      ? `Donation &amp; Grant Income [${escapeXml(yr)}]`
      : `Campus Maintenance &amp; Operations Expense [${escapeXml(yr)}]`;

    await syncMasterToTally(
      expLedger,
      isDonation ? 'Direct Incomes' : 'Indirect Expenses',
      0,
      companyName
    );

    const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const activeRegisters = await db.cashRegister.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const defaultCashName = activeRegisters[0]?.registerName || 'Main Admissions Counter Cash Box';
    const defaultBankName = activeBanks[0]?.accountName || 'HDFC Bank Main Account';

    const isCash = (expense.paymentMethod || '').toUpperCase().includes('CASH');
    const sourceLedger = isCash ? escapeXml(defaultCashName) : escapeXml(expense.bankAccountName || defaultBankName);
    const expNum = (expense.receiptNo || expense.tallyVoucherId || `EXP-${expense.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
    const amtStr = expense.amount.toFixed(2);
    const vType = isDonation ? 'Receipt' : 'Payment';
    const remoteId = `CONVEE-EXP-${expNum}`;

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
    <VOUCHER REMOTEID="${remoteId}" VTYPE="${vType}" ACTION="Alter">
     <GUID>${remoteId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>${isDonation ? 'Donation / Grant Income Received' : 'Other Expense Paid'} - ${escapeXml(expense.title)} (${escapeXml(expense.vendorName || 'Vendor')}) [${yr}] via ${isCash ? 'Cash' : 'Bank'}</NARRATION>
     <VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${expNum}</VOUCHERNUMBER>
     <REFERENCE>${expNum}</REFERENCE>
     <PARTYLEDGERNAME>${expLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${isDonation ? sourceLedger : expLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${isDonation ? expLedger : sourceLedger}</LEDGERNAME>
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
    return true;
  } catch {
    return false;
  }
}

export async function deleteExpenseLive(expense: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  const expNum = (expense.receiptNo || expense.tallyVoucherId || `EXP-${expense.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
  const remoteId = `CONVEE-EXP-${expNum}`;
  const vType = expense.category === 'DONATION' ? 'Receipt' : 'Payment';

  await recordTombstone(orgId, 'EXPENSE', expense.id, expNum, [remoteId]);

  try {
    await deleteVoucherFromTally(remoteId, vType, expNum, companyName);
    return true;
  } catch {
    return false;
  }
}

/**
 * 3. Sync Faculty Payroll Live (Salary Due Journal + Bank Payment)
 */
export async function syncPayrollLive(payroll: any, orgId: string): Promise<boolean> {
  try {
    const companyName = await getCompanyName(orgId);
    const yr = formatYearTag(payroll.year);
    const teacherLedger = getFacultyLedgerName(payroll);
    const salaryExpenseLedger = `Faculty Salary Expense [${escapeXml(yr)}]`;

    await syncMasterToTally(teacherLedger, 'Sundry Creditors', 0, companyName);
    await syncMasterToTally(salaryExpenseLedger, 'Indirect Expenses', 0, companyName);

    const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const defaultBankName = activeBanks[0]?.accountName || 'HDFC Bank Main Account';
    const bankLedger = escapeXml(defaultBankName);
    await syncMasterToTally(bankLedger, 'Bank Accounts', 0, companyName);

    const jrnNum = (payroll.tallyVoucherId || `JRN-PAY-${payroll.employeeId || payroll.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
    const payNum = (payroll.tallyVoucherId ? `PAY-${payroll.tallyVoucherId}` : `PAY-DIR-${payroll.employeeId || payroll.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
    const netStr = (payroll.netSalary || payroll.basicPay).toFixed(2);

    // Salary Due Voucher
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
     <NARRATION>Faculty Salary Due Voucher - ${escapeXml(payroll.employeeName)} (${escapeXml(payroll.designation || 'Faculty')}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${jrnNum}</VOUCHERNUMBER>
     <REFERENCE>${jrnNum}</REFERENCE>
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

    // Salary Disbursement Payment Voucher
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
     <NARRATION>Faculty Salary Disbursement - ${escapeXml(payroll.employeeName)} (${escapeXml(payroll.designation || 'Faculty')}) [${yr}]</NARRATION>
     <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${payNum}</VOUCHERNUMBER>
     <REFERENCE>${payNum}</REFERENCE>
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
    return true;
  } catch {
    return false;
  }
}

export async function deletePayrollLive(payroll: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  const jrnNum = (payroll.tallyVoucherId || `JRN-PAY-${payroll.employeeId || payroll.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
  const payNum = (payroll.tallyVoucherId ? `PAY-${payroll.tallyVoucherId}` : `PAY-DIR-${payroll.employeeId || payroll.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
  const jrnRemoteId = `CONVEE-FAC-JRN-${jrnNum}`;
  const payRemoteId = `CONVEE-PAY-${payNum}`;

  await recordTombstone(orgId, 'PAYROLL', payroll.id, payroll.tallyVoucherId, [jrnRemoteId, payRemoteId]);

  try {
    await deleteVoucherFromTally(jrnRemoteId, 'Journal', jrnNum, companyName);
    await deleteVoucherFromTally(payRemoteId, 'Payment', payNum, companyName);
    return true;
  } catch {
    return false;
  }
}

/**
 * 4. Sync Bank Account Master Live
 */
export async function syncBankAccountLive(bank: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  return syncMasterToTally(bank.accountName, 'Bank Accounts', bank.openingBalance || 0, companyName);
}

export async function deleteBankAccountLive(bank: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  await recordTombstone(orgId, 'BANK_ACCOUNT', bank.id, bank.accountNumber, []);
  return deleteMasterFromTally(bank.accountName, companyName);
}

/**
 * 5. Sync Society Fund Live
 */
export async function syncSocietyFundLive(fund: any, orgId: string): Promise<boolean> {
  try {
    const companyName = await getCompanyName(orgId);
    await syncMasterToTally(fund.fundName, 'Capital Account', fund.amount || 0, companyName);

    const fDate = fund.fundDate ? new Date(fund.fundDate) : new Date();
    const isOpeningFund = fDate.getFullYear() === 2026 && fDate.getMonth() === 3 && fDate.getDate() === 1;

    if (!isOpeningFund && fund.amount > 0) {
      const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
      const defaultBankName = activeBanks[0]?.accountName || 'HDFC Bank Main Account';
      const bankLedger = escapeXml(defaultBankName);

      const sfNum = (fund.receiptNo || `SOC-${fund.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
      const sfName = escapeXml(fund.fundName);
      const amtStr = fund.amount.toFixed(2);
      const remoteId = `CONVEE-SOC-${sfNum}`;

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
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="${remoteId}" VTYPE="Receipt" ACTION="Alter">
     <GUID>${remoteId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Society / Corpus Fund Contribution Received - ${sfName} (${escapeXml(fund.contributingBody || 'Trust')})</NARRATION>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${sfNum}</VOUCHERNUMBER>
     <REFERENCE>${sfNum}</REFERENCE>
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
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteSocietyFundLive(fund: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  const sfNum = (fund.receiptNo || `SOC-${fund.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
  const remoteId = `CONVEE-SOC-${sfNum}`;

  await recordTombstone(orgId, 'SOCIETY_FUND', fund.id, fund.receiptNo || sfNum, [remoteId, sfNum]);

  try {
    await deleteVoucherFromTally(remoteId, 'Receipt', sfNum, companyName);
    return true;
  } catch {
    return false;
  }
}

/**
 * 6. Sync Fixed Asset Live
 */
export async function syncFixedAssetLive(asset: any, orgId: string): Promise<boolean> {
  try {
    const companyName = await getCompanyName(orgId);
    const assetLedger = escapeXml(asset.assetName);
    await syncMasterToTally(assetLedger, 'Fixed Assets', asset.purchasePrice || 0, companyName);

    const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const defaultBankName = activeBanks[0]?.accountName || 'HDFC Bank Main Account';
    const bankLedger = escapeXml(defaultBankName);

    const astNum = (asset.invoiceNo || asset.assetCode || `AST-${asset.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
    const amtStr = (asset.purchasePrice || 0).toFixed(2);
    const remoteId = `CONVEE-AST-${astNum}`;

    if (asset.purchasePrice > 0) {
      const astXml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <VOUCHER REMOTEID="${remoteId}" VTYPE="Payment" ACTION="Alter">
     <GUID>${remoteId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Fixed Asset Acquisition - ${assetLedger} (${escapeXml(asset.vendorName || 'Vendor')})</NARRATION>
     <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${astNum}</VOUCHERNUMBER>
     <REFERENCE>${astNum}</REFERENCE>
     <PARTYLEDGERNAME>${assetLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${assetLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>-${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${bankLedger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>No</ISPARTYLEDGER>
      <AMOUNT>${amtStr}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
      await postToTallyHttp(astXml);
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteFixedAssetLive(asset: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  const astNum = (asset.invoiceNo || asset.assetCode || `AST-${asset.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
  const remoteId = `CONVEE-AST-${astNum}`;

  await recordTombstone(orgId, 'FIXED_ASSET', asset.id, astNum, [remoteId]);

  try {
    await deleteVoucherFromTally(remoteId, 'Payment', astNum, companyName);
    return true;
  } catch {
    return false;
  }
}

/**
 * 7. Sync Cash Transaction Live
 */
export async function syncCashTransactionLive(ctx: any, orgId: string): Promise<boolean> {
  try {
    const companyName = await getCompanyName(orgId);
    const reg = await db.cashRegister.findUnique({ where: { id: ctx.registerId } }).catch(() => null);
    const regName = escapeXml(reg?.registerName || 'Main Admissions Counter Cash Box');

    const activeBanks = await db.bankAccount.findMany({ where: { orgId, isActive: true } }).catch(() => []);
    const defaultBankName = activeBanks[0]?.accountName || 'HDFC Bank Main Account';
    const bankLedger = escapeXml(defaultBankName);

    const ctxNum = (ctx.voucherNumber || `CSH-${ctx.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
    const amtStr = (ctx.amount || 0).toFixed(2);

    let xml = '';
    if (ctx.transactionType === 'BANK_WITHDRAWAL') {
      const rId = `CONVEE-CSH-CON-${ctxNum}`;
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER>
 <BODY>
  <DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES></DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="${rId}" VTYPE="Contra" ACTION="Alter">
     <GUID>${rId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Bank Cash Withdrawal - ${escapeXml(ctx.recipientOrPayer || 'Cashier')}</NARRATION>
     <VOUCHERTYPENAME>Contra</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${ctxNum}</VOUCHERNUMBER>
     <REFERENCE>${ctxNum}</REFERENCE>
     <PARTYLEDGERNAME>${bankLedger}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>${regName}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER><AMOUNT>-${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>${bankLedger}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
    } else if (ctx.transactionType === 'BANK_DEPOSIT') {
      const rId = `CONVEE-CSH-DEP-${ctxNum}`;
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER>
 <BODY>
  <DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES></DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="${rId}" VTYPE="Contra" ACTION="Alter">
     <GUID>${rId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Cash Deposited to Bank - ${escapeXml(ctx.recipientOrPayer || 'Accountant')}</NARRATION>
     <VOUCHERTYPENAME>Contra</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${ctxNum}</VOUCHERNUMBER>
     <REFERENCE>${ctxNum}</REFERENCE>
     <PARTYLEDGERNAME>${regName}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>${bankLedger}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER><AMOUNT>-${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>${regName}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
    } else if (ctx.transactionType === 'CASH_IN' || ctx.transactionType === 'FEE_COLLECTION') {
      const rId = `CONVEE-CSH-REC-${ctxNum}`;
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER>
 <BODY>
  <DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES></DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="${rId}" VTYPE="Receipt" ACTION="Alter">
     <GUID>${rId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Cash Inflow / Collection - ${escapeXml(ctx.recipientOrPayer || 'Counter Collection')} (${escapeXml(ctx.notes || '')})</NARRATION>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${ctxNum}</VOUCHERNUMBER>
     <REFERENCE>${ctxNum}</REFERENCE>
     <PARTYLEDGERNAME>Student Tuition &amp; Fees Income [2026-27]</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>${regName}</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER><AMOUNT>-${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>Student Tuition &amp; Fees Income [2026-27]</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
    } else {
      const rId = `CONVEE-CSH-PAY-${ctxNum}`;
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER>
 <BODY>
  <DESC><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES></DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER REMOTEID="${rId}" VTYPE="Payment" ACTION="Alter">
     <GUID>${rId}</GUID>
     <DATE>20260401</DATE>
     <NARRATION>Petty Cash Expense - ${escapeXml(ctx.recipientOrPayer || 'Petty Disbursement')} (${escapeXml(ctx.notes || '')})</NARRATION>
     <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${ctxNum}</VOUCHERNUMBER>
     <REFERENCE>${ctxNum}</REFERENCE>
     <PARTYLEDGERNAME>Campus Maintenance &amp; Operations Expense [2026-27]</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>Campus Maintenance &amp; Operations Expense [2026-27]</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER><AMOUNT>-${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST><LEDGERNAME>${regName}</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>${amtStr}</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>`;
    }

    if (xml) {
      await postToTallyHttp(xml);
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteCashTransactionLive(ctx: any, orgId: string): Promise<boolean> {
  const companyName = await getCompanyName(orgId);
  const ctxNum = (ctx.voucherNumber || `CSH-${ctx.id.slice(0, 8)}`).replace(/[^a-zA-Z0-9-]/g, '-');
  const remoteIds = [
    `CONVEE-CSH-CON-${ctxNum}`,
    `CONVEE-CSH-DEP-${ctxNum}`,
    `CONVEE-CSH-REC-${ctxNum}`,
    `CONVEE-CSH-PAY-${ctxNum}`,
  ];

  await recordTombstone(orgId, 'CASH_TRANSACTION', ctx.id, ctxNum, remoteIds);

  try {
    for (const rId of remoteIds) {
      await deleteVoucherFromTally(rId, '', ctxNum, companyName);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * =========================================================================================
 * 6. BI-DIRECTIONAL RECONCILIATION & DIFF ENGINE
 * =========================================================================================
 */

export interface ReconcileDiffResult {
  tallyConnected: boolean;
  activeCompany: string;
  matchedCount: number;
  onlyInConveeCount: number;
  onlyInTallyCount: number;
  onlyInConvee: Array<{
    id: string;
    type: 'FEE' | 'PAYROLL' | 'EXPENSE' | 'CASH_TRANSACTION';
    title: string;
    partyName: string;
    identifier: string;
    amount: number;
    academicYear?: string;
    date: string;
    status?: string;
    rawRecord: any;
  }>;
  onlyInTally: Array<{
    id: string;
    voucherType: string;
    voucherNumber: string;
    remoteId: string;
    guid: string;
    partyLedger: string;
    amount: number;
    date: string;
    narration: string;
    isConveeOrphan: boolean;
  }>;
}

export async function computeTallyDiff(orgId: string): Promise<ReconcileDiffResult> {
  const companyName = await getCompanyName(orgId);

  // 1. Fetch all active records from DB across all financial modules
  const [allFees, allPayrolls, allExpenses, allCashTxs, allAssets, allSocietyFunds, allRegisters] = await Promise.all([
    db.studentFeeLedger.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } }).catch(() => []),
    db.payrollRecord.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } }).catch(() => []),
    db.expenseRecord.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } }).catch(() => []),
    db.cashTransaction.findMany({ where: { orgId }, orderBy: { transactionDate: 'desc' } }).catch(() => []),
    db.fixedAsset.findMany({ where: { orgId } }).catch(() => []),
    db.societyFund.findMany({ where: { orgId } }).catch(() => []),
    db.cashRegister.findMany({ where: { orgId } }).catch(() => []),
  ]);

  // 2. Fetch all vouchers from Tally Prime
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>AllVouchersDiff</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
   </STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="AllVouchersDiff">
      <TYPE>Voucher</TYPE>
      <FETCH>REMOTEID, GUID, VOUCHERNUMBER, VOUCHERTYPENAME, PARTYLEDGERNAME, DATE, AMOUNT, NARRATION, PERSISTEDVIEW, ALLLEDGERENTRIES.LIST</FETCH>
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>`;

  let tallyXmlRes = '';
  try {
    tallyXmlRes = await postToTallyHttp(xml, 12000);
  } catch {
    return {
      tallyConnected: false,
      activeCompany: companyName,
      matchedCount: 0,
      onlyInConveeCount: allFees.length + allPayrolls.length + allExpenses.length + allCashTxs.length,
      onlyInTallyCount: 0,
      onlyInConvee: [
        ...allFees.map((f: any) => ({
          id: f.id,
          type: 'FEE' as const,
          title: f.feeHeader || 'Student Fee',
          partyName: f.studentName || 'Student',
          identifier: f.studentRollNo || f.receiptNo || f.id.slice(0, 8),
          amount: f.totalAmount || f.paidAmount || 0,
          academicYear: f.academicYear || '',
          date: f.createdAt ? new Date(f.createdAt).toISOString().split('T')[0] : '',
          status: f.status,
          rawRecord: f,
        })),
        ...allPayrolls.map((p: any) => ({
          id: p.id,
          type: 'PAYROLL' as const,
          title: `Salary - ${p.month || ''} ${p.year || ''}`,
          partyName: p.employeeName || 'Faculty',
          identifier: p.employeeId || p.receiptNo || p.id.slice(0, 8),
          amount: p.netSalary || p.basicPay || 0,
          academicYear: String(p.year || ''),
          date: p.disbursedAt ? new Date(p.disbursedAt).toISOString().split('T')[0] : '',
          status: p.status,
          rawRecord: p,
        })),
      ],
      onlyInTally: [],
    };
  }

  // Parse Tally Vouchers
  const tallyVouchers: Array<{
    remoteId: string;
    guid: string;
    voucherNumber: string;
    voucherType: string;
    partyLedger: string;
    amount: number;
    date: string;
    narration: string;
    allLedgers?: string[];
    isCancelled: boolean;
  }> = [];

  const vRegex = /<VOUCHER\s+([^>]*?)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = vRegex.exec(tallyXmlRes)) !== null) {
    const attrStr = match[1];
    const bodyStr = match[2];

    const isCancelled = bodyStr.includes('<ISCANCELLED>Yes</ISCANCELLED>') ||
      bodyStr.includes('<ISCANCELLED TYPE="Logical">Yes</ISCANCELLED>') ||
      bodyStr.includes('(cancelled)');
    if (isCancelled) continue;

    const unescapeXml = (str: string) =>
      (str || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

    const rIdMatch = attrStr.match(/REMOTEID="([^"]+)"/i) || bodyStr.match(/<REMOTEID[^>]*>([^<]+)<\/REMOTEID>/i);
    const guidMatch = bodyStr.match(/<GUID[^>]*>([^<]+)<\/GUID>/i);
    const vTypeMatch = attrStr.match(/VCHTYPE="([^"]+)"/i) || bodyStr.match(/<VOUCHERTYPENAME[^>]*>([^<]+)<\/VOUCHERTYPENAME>/i);
    const vNumMatch = bodyStr.match(/<VOUCHERNUMBER[^>]*>([^<]+)<\/VOUCHERNUMBER>/i);
    const partyMatch = bodyStr.match(/<PARTYLEDGERNAME[^>]*>([^<]+)<\/PARTYLEDGERNAME>/i);
    const narrationMatch = bodyStr.match(/<NARRATION[^>]*>([^<]+)<\/NARRATION>/i);
    const dateMatch = bodyStr.match(/<DATE[^>]*>([^<]+)<\/DATE>/i);

    // Extract amount
    const amtMatches = [...bodyStr.matchAll(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/gi)];
    let maxAmt = 0;
    for (const am of amtMatches) {
      const parsed = Math.abs(parseFloat(am[1]) || 0);
      if (parsed > maxAmt) maxAmt = parsed;
    }

    // Extract all ledger names
    const ledgerMatches = [...bodyStr.matchAll(/<LEDGERNAME[^>]*>([^<]+)<\/LEDGERNAME>/gi)].map((m) => unescapeXml(m[1]));
    const narrationClean = unescapeXml(narrationMatch ? narrationMatch[1] : '');
    const partyClean = unescapeXml(partyMatch ? partyMatch[1] : '');

    tallyVouchers.push({
      remoteId: rIdMatch ? rIdMatch[1] : '',
      guid: guidMatch ? guidMatch[1] : '',
      voucherNumber: vNumMatch ? vNumMatch[1] : '',
      voucherType: vTypeMatch ? vTypeMatch[1] : 'Voucher',
      partyLedger: partyClean,
      amount: maxAmt,
      date: dateMatch ? dateMatch[1] : '',
      narration: narrationClean,
      allLedgers: ledgerMatches,
      isCancelled: false,
    });
  }

  // 3. Build lookup keys from Convee DB
  const conveeInvKeys = new Set<string>();
  const conveeRecKeys = new Set<string>();
  const conveePayKeys = new Set<string>();
  const conveeExpKeys = new Set<string>();
  const conveeCashKeys = new Set<string>();

  for (const f of allFees) {
    const rawInv = f.receiptNo ? f.receiptNo.replace('REC/', 'INV/') : (f.tallyVoucherId || `INV-${f.studentRollNo || f.id.slice(0, 8)}`);
    const invNum = rawInv.replace(/[^a-zA-Z0-9-]/g, '-');
    const rawRec = f.receiptNo || f.tallyVoucherId || `REC-${f.studentRollNo || f.id.slice(0, 8)}`;
    const recNum = rawRec.replace(/[^a-zA-Z0-9-]/g, '-');
    conveeInvKeys.add(`CONVEE-INV-${invNum}`);
    conveeInvKeys.add(invNum);
    conveeRecKeys.add(`CONVEE-REC-${recNum}`);
    conveeRecKeys.add(recNum);
  }

  for (const p of allPayrolls) {
    const rawPay = p.receiptNo || p.tallyVoucherId || `PAY-${p.employeeId || p.id.slice(0, 8)}`;
    const payNum = rawPay.replace(/[^a-zA-Z0-9-]/g, '-');
    conveePayKeys.add(`CONVEE-PAY-${payNum}`);
    conveePayKeys.add(payNum);
  }

  for (const e of allExpenses) {
    const rawExp = e.receiptNo || e.tallyVoucherId || `EXP-${e.id.slice(0, 8)}`;
    const expNum = rawExp.replace(/[^a-zA-Z0-9-]/g, '-');
    conveeExpKeys.add(`CONVEE-EXP-${expNum}`);
    conveeExpKeys.add(expNum);
  }

  for (const c of allCashTxs) {
    const rawCtx = c.voucherNumber || `CSH-${c.id.slice(0, 8)}`;
    const ctxNum = rawCtx.replace(/[^a-zA-Z0-9-]/g, '-');
    conveeCashKeys.add(`CONVEE-CSH-CON-${ctxNum}`);
    conveeCashKeys.add(`CONVEE-CSH-DEP-${ctxNum}`);
    conveeCashKeys.add(`CONVEE-CSH-REC-${ctxNum}`);
    conveeCashKeys.add(`CONVEE-CSH-PAY-${ctxNum}`);
    conveeCashKeys.add(ctxNum);
  }

  // 4. Determine "Only in Convee" and "Matched"
  const matchedTallyIndices = new Set<number>();
  const onlyInConvee: ReconcileDiffResult['onlyInConvee'] = [];
  let matchedCount = 0;

  for (const f of allFees) {
    const rawInv = f.receiptNo ? f.receiptNo.replace('REC/', 'INV/') : (f.tallyVoucherId || `INV-${f.studentRollNo || f.id.slice(0, 8)}`);
    const invNum = rawInv.replace(/[^a-zA-Z0-9-]/g, '-');
    const invRemote = `CONVEE-INV-${invNum}`;
    const rawRec = f.receiptNo || f.tallyVoucherId || `REC-${f.studentRollNo || f.id.slice(0, 8)}`;
    const recNum = rawRec.replace(/[^a-zA-Z0-9-]/g, '-');
    const recRemote = `CONVEE-REC-${recNum}`;
    const rollNo = (f.studentRollNo || '').trim();
    const studentName = (f.studentName || '').trim();

    let matchedAny = false;
    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (
        tv.remoteId === invRemote ||
        tv.remoteId === recRemote ||
        tv.voucherNumber === invNum ||
        tv.voucherNumber === recNum ||
        (f.tallyVoucherId && (tv.voucherNumber === f.tallyVoucherId || tv.remoteId === f.tallyVoucherId || tv.guid === f.tallyVoucherId)) ||
        (rollNo && (tv.partyLedger.includes(rollNo) || tv.narration.includes(rollNo) || tv.allLedgers?.some((l: string) => l.includes(rollNo)))) ||
        (studentName && (tv.partyLedger.includes(studentName) || tv.narration.includes(studentName) || tv.allLedgers?.some((l: string) => l.includes(studentName))))
      ) {
        matchedTallyIndices.add(i);
        matchedAny = true;
      }
    }

    if (matchedAny) {
      matchedCount++;
    } else {
      onlyInConvee.push({
        id: f.id,
        type: 'FEE',
        title: f.feeHeader || 'Tuition Fee Demand',
        partyName: f.studentName || 'Student',
        identifier: f.studentRollNo || f.receiptNo || f.id.slice(0, 8),
        amount: f.totalAmount || f.paidAmount || 0,
        academicYear: f.academicYear || '',
        date: f.createdAt ? new Date(f.createdAt).toISOString().split('T')[0] : '',
        status: f.status,
        rawRecord: f,
      });
    }
  }

  for (const p of allPayrolls) {
    const rawPay = (p as any).receiptNo || p.tallyVoucherId || `PAY-${p.employeeId || p.id.slice(0, 8)}`;
    const payNum = rawPay.replace(/[^a-zA-Z0-9-]/g, '-');
    const payRemote = `CONVEE-PAY-${payNum}`;
    const empId = (p.employeeId || '').trim();
    const rawName = (p.employeeName || '').trim();
    const firstWord = rawName.split(' ')[0] || '';

    let matchedAny = false;
    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (
        tv.remoteId === payRemote ||
        tv.voucherNumber === payNum ||
        (empId && (tv.partyLedger.includes(empId) || tv.narration.includes(empId) || tv.allLedgers?.some((l: string) => l.includes(empId)))) ||
        (rawName && (tv.partyLedger.includes(rawName) || tv.narration.includes(rawName) || tv.allLedgers?.some((l: string) => l.includes(rawName)))) ||
        (firstWord.length > 2 && (tv.partyLedger.includes(firstWord) || tv.narration.includes(firstWord)))
      ) {
        matchedTallyIndices.add(i);
        matchedAny = true;
      }
    }

    if (matchedAny) {
      matchedCount++;
    } else {
      onlyInConvee.push({
        id: p.id,
        type: 'PAYROLL',
        title: `Salary - ${p.month || ''} ${p.year || ''}`,
        partyName: p.employeeName || 'Faculty',
        identifier: p.employeeId || (p as any).receiptNo || p.id.slice(0, 8),
        amount: p.netSalary || p.basicPay || 0,
        academicYear: String(p.year || ''),
        date: p.disbursedAt ? new Date(p.disbursedAt).toISOString().split('T')[0] : '',
        status: p.status,
        rawRecord: p,
      });
    }
  }

  for (const e of allExpenses) {
    const rawExp = e.receiptNo || e.tallyVoucherId || `EXP-${e.id.slice(0, 8)}`;
    const expNum = rawExp.replace(/[^a-zA-Z0-9-]/g, '-');
    const expRemote = `CONVEE-EXP-${expNum}`;
    const vName = (e.vendorName || '').trim();
    const title = (e.title || '').trim();

    let matchedAny = false;
    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (
        tv.remoteId === expRemote ||
        tv.voucherNumber === expNum ||
        (vName && (tv.partyLedger.includes(vName) || tv.narration.includes(vName) || tv.allLedgers?.some((l: string) => l.includes(vName)))) ||
        (title && (tv.partyLedger.includes(title) || tv.narration.includes(title) || tv.allLedgers?.some((l: string) => l.includes(title))))
      ) {
        matchedTallyIndices.add(i);
        matchedAny = true;
      }
    }

    if (matchedAny) {
      matchedCount++;
    } else {
      onlyInConvee.push({
        id: e.id,
        type: 'EXPENSE',
        title: e.title || 'Institutional Expense',
        partyName: e.vendorName || (e.category === 'DONATION' ? 'Donor / Grantor' : 'Vendor'),
        identifier: e.receiptNo || e.id.slice(0, 8),
        amount: e.amount || 0,
        academicYear: e.academicYear || '',
        date: e.expenseDate ? new Date(e.expenseDate).toISOString().split('T')[0] : '',
        status: e.status,
        rawRecord: e,
      });
    }
  }

  for (const a of allAssets) {
    const aName = (a.assetName || '').trim();
    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (aName && (tv.partyLedger.includes(aName) || tv.narration.includes(aName) || tv.allLedgers?.some((l: string) => l.includes(aName)))) {
        matchedTallyIndices.add(i);
      }
    }
  }

  for (const s of allSocietyFunds) {
    const sName = (s.fundName || '').trim();
    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (sName && (tv.partyLedger.includes(sName) || tv.narration.includes(sName) || tv.allLedgers?.some((l: string) => l.includes(sName)))) {
        matchedTallyIndices.add(i);
      }
    }
  }

  for (const c of allCashTxs) {
    const rawCtx = c.voucherNumber || `CSH-${c.id.slice(0, 8)}`;
    const ctxNum = rawCtx.replace(/[^a-zA-Z0-9-]/g, '-');
    const recipient = (c.recipientOrPayer || '').trim();
    const notes = (c.notes || '').trim();
    const amt = parseFloat(String(c.amount)) || 0;

    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (
        tv.remoteId.includes(ctxNum) ||
        tv.voucherNumber === ctxNum ||
        (amt > 0 && tv.amount === amt && (tv.voucherType === 'Contra' || tv.voucherType === 'Receipt' || tv.voucherType === 'Payment')) ||
        (notes && (tv.narration.includes(notes) || notes.includes(tv.narration))) ||
        (recipient && (tv.partyLedger.includes(recipient) || tv.narration.includes(recipient) || tv.allLedgers?.some((l: string) => l.includes(recipient))))
      ) {
        matchedTallyIndices.add(i);
      }
    }
  }

  for (const reg of allRegisters) {
    const regName = ((reg as any).registerName || (reg as any).name || '').trim();
    for (let i = 0; i < tallyVouchers.length; i++) {
      const tv = tallyVouchers[i];
      if (regName && (tv.partyLedger.includes(regName) || tv.narration.includes(regName) || tv.allLedgers?.some((l: string) => l.includes(regName)))) {
        matchedTallyIndices.add(i);
      }
    }
  }

  // 5. Determine "Only in Tally" with Logical Transaction-Level Consolidation
  const rawUnmatched = tallyVouchers.filter((_, idx) => !matchedTallyIndices.has(idx));
  const onlyInTally: ReconcileDiffResult['onlyInTally'] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < rawUnmatched.length; i++) {
    if (processedIndices.has(i)) continue;
    const v1 = rawUnmatched[i];
    const cleanParty = (v1.partyLedger || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();

    // Look for paired voucher (e.g. Journal Due + Payment Disbursement for same salary)
    const isFeeVoucher = (v1.narration || '').toLowerCase().includes('student') || (v1.narration || '').toLowerCase().includes('fee') || (v1.partyLedger || '').includes('STU-');
    const pairedIdx = isFeeVoucher ? -1 : rawUnmatched.findIndex(
      (v2, idx2) =>
        idx2 !== i &&
        !processedIndices.has(idx2) &&
        !((v2.narration || '').toLowerCase().includes('fee') || (v2.partyLedger || '').includes('STU-')) &&
        Math.abs(v2.amount - v1.amount) < 0.01 &&
        ((cleanParty && v2.partyLedger.includes(cleanParty)) || (v1.narration && v2.narration && v1.narration.slice(0, 20) === v2.narration.slice(0, 20)))
    );

    if (pairedIdx !== -1) {
      const v2 = rawUnmatched[pairedIdx];
      processedIndices.add(i);
      processedIndices.add(pairedIdx);
      onlyInTally.push({
        id: `${v1.remoteId || v1.guid}_${v2.remoteId || v2.guid}`,
        voucherType: `${v1.voucherType} & ${v2.voucherType}`,
        voucherNumber: `#${v1.voucherNumber} & #${v2.voucherNumber}`,
        remoteId: v1.remoteId || v2.remoteId,
        guid: v1.guid,
        partyLedger: v1.partyLedger || v2.partyLedger,
        amount: v1.amount,
        date: v1.date,
        narration: `Faculty Salary Package - ${cleanParty || v1.partyLedger} (Accrual & Disbursement)`,
        isConveeOrphan: v1.remoteId.startsWith('CONVEE-') || v2.remoteId.startsWith('CONVEE-'),
        pairedVouchers: [v1, v2],
      } as any);
    } else {
      processedIndices.add(i);
      onlyInTally.push({
        id: v1.remoteId || v1.guid || v1.voucherNumber || String(Math.random()),
        voucherType: v1.voucherType,
        voucherNumber: v1.voucherNumber,
        remoteId: v1.remoteId,
        guid: v1.guid,
        partyLedger: v1.partyLedger,
        amount: v1.amount,
        date: v1.date,
        narration: v1.narration,
        isConveeOrphan: v1.remoteId.startsWith('CONVEE-'),
      });
    }
  }

  return {
    tallyConnected: true,
    activeCompany: companyName,
    matchedCount,
    onlyInConveeCount: onlyInConvee.length,
    onlyInTallyCount: onlyInTally.length,
    onlyInConvee,
    onlyInTally,
  };
}

/**
 * 7. Execute Individual or Batch Reconcile Action
 */
export async function executeReconcileAction(
  action: 'PUSH_TO_TALLY' | 'DELETE_FROM_CONVEE' | 'IMPORT_TO_CONVEE' | 'PURGE_FROM_TALLY',
  payload: any,
  orgId: string
): Promise<{ success: boolean; message: string }> {
  const companyName = await getCompanyName(orgId);

  try {
    if (action === 'PUSH_TO_TALLY') {
      const { type, id } = payload;
      if (type === 'FEE') {
        const fee = await db.studentFeeLedger.findUnique({ where: { id } });
        if (!fee) return { success: false, message: 'Fee record not found in database' };
        await syncFeeLive(fee, orgId);
        return { success: true, message: `Pushed student fee '${fee.studentName}' (${fee.receiptNo || fee.id.slice(0, 8)}) to Tally Prime.` };
      } else if (type === 'PAYROLL') {
        const payroll = await db.payrollRecord.findUnique({ where: { id } });
        if (!payroll) return { success: false, message: 'Payroll record not found in database' };
        await syncPayrollLive(payroll, orgId);
        return { success: true, message: `Pushed payroll for '${payroll.employeeName}' (${payroll.month} ${payroll.year}) to Tally Prime.` };
      } else if (type === 'EXPENSE') {
        const expense = await db.expenseRecord.findUnique({ where: { id } });
        if (!expense) return { success: false, message: 'Expense record not found in database' };
        await syncExpenseLive(expense, orgId);
        return { success: true, message: `Pushed expense '${expense.title}' to Tally Prime.` };
      }
    } else if (action === 'DELETE_FROM_CONVEE') {
      const { type, id } = payload;
      if (type === 'FEE') {
        await db.studentFeeLedger.delete({ where: { id } }).catch(() => {});
        return { success: true, message: `Removed fee record from Convee database.` };
      } else if (type === 'PAYROLL') {
        await db.payrollRecord.delete({ where: { id } }).catch(() => {});
        return { success: true, message: `Removed payroll record from Convee database.` };
      } else if (type === 'EXPENSE') {
        await db.expenseRecord.delete({ where: { id } }).catch(() => {});
        return { success: true, message: `Removed expense record from Convee database.` };
      }
    } else if (action === 'IMPORT_TO_CONVEE') {
      const { voucherType, voucherNumber, partyLedger, amount, narration, date, pairedVouchers, guid, remoteId } = payload;
      const vType = (voucherType || '').toUpperCase();
      const yr = '2026-27';

      if (vType === 'RECEIPT' || (narration || '').toLowerCase().includes('fee') || (narration || '').toLowerCase().includes('student') || (partyLedger || '').includes('STU-')) {
        const rollMatch = (partyLedger || narration || '').match(/\[(STU-[^\]]+)\]/i) ||
          (partyLedger || narration || '').match(/\((STU-[^)]+)\)/i) ||
          (partyLedger || narration || '').match(/(STU-[A-Za-z0-9-]+)/i);
        const nameClean = (partyLedger || '').replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim() || 'Imported Student';
        const feeAmt = parseFloat(amount) || 0;

        await db.studentFeeLedger.create({
          data: {
            orgId,
            studentRollNo: rollMatch ? rollMatch[1] : `STU-${Math.floor(1000 + Math.random() * 9000)}`,
            studentName: nameClean,
            feeHeader: narration && narration.includes('-') ? narration.split('-')[1]?.split('(')[0]?.trim() || 'Imported Tally Tuition Fee' : 'Imported Tally Tuition Fee',
            academicYear: yr,
            totalAmount: feeAmt,
            paidAmount: feeAmt,
            pendingBalance: 0,
            status: 'PAID',
            receiptNo: voucherNumber ? `REC-${voucherNumber}` : `REC-IMP-${Date.now().toString().slice(-6)}`,
            tallyVoucherId: voucherNumber || guid || remoteId || `VCH-${Date.now().toString().slice(-6)}`,
            paymentMethod: 'Tally Direct Receipt',
            notes: `Imported from Tally Prime: ${narration || partyLedger}`,
            tallySyncStatus: 'TALLY_VOUCHER_SYNCED',
            syncedAt: new Date(),
          },
        });
        return { success: true, message: `Imported student fee voucher '${voucherNumber || nameClean}' into Student Fees.` };
      } else if (vType.includes('PAYMENT') || vType.includes('JOURNAL') || (narration || '').toLowerCase().includes('salary') || pairedVouchers) {
        const payAmt = parseFloat(amount) || 0;
        const isSalary = (partyLedger || narration || '').toLowerCase().includes('salary') || (partyLedger || narration || '').toLowerCase().includes('accountant') || (partyLedger || narration || '').toLowerCase().includes('fac-');

        if (isSalary) {
          const empMatch = (partyLedger || narration || '').match(/\[(EMP-[^\]]+)\]/i) || (partyLedger || narration || '').match(/\[(FAC-[^\]]+)\]/i) || (partyLedger || narration || '').match(/\[(ACC-[^\]]+)\]/i);
          const empName = (partyLedger || '').replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim() || 'Imported Faculty';
          await db.payrollRecord.create({
            data: {
              orgId,
              employeeId: empMatch ? empMatch[1] : `ACC-2026-1106`,
              employeeName: empName,
              designation: 'Accountant',
              month: 'April',
              year: 2026,
              basicPay: payAmt,
              allowances: 0,
              deductions: 0,
              netSalary: payAmt,
              status: 'DISBURSED',
              tallyVoucherId: voucherNumber || `VCH-${Date.now().toString().slice(-6)}`,
              disbursedAt: new Date(),
              syncedAt: new Date(),
            },
          });
          return { success: true, message: `Imported salary package for '${empName}' (₹${payAmt.toLocaleString()}) into Faculty Payroll.` };
        } else {
          await db.expenseRecord.create({
            data: {
              orgId,
              title: narration || partyLedger || 'Imported Expense from Tally',
              category: 'OPERATIONAL',
              amount: payAmt,
              paymentMethod: 'Bank Transfer',
              vendorName: partyLedger || 'Tally Vendor',
              academicYear: yr,
              expenseDate: new Date(),
              receiptNo: voucherNumber ? `EXP-${voucherNumber}` : `EXP-IMP-${Date.now().toString().slice(-6)}`,
              tallyVoucherId: voucherNumber || `VCH-${Date.now().toString().slice(-6)}`,
              status: 'PAID',
              notes: `Imported from Tally Prime voucher #${voucherNumber}`,
            },
          });
          return { success: true, message: `Imported payment voucher '${voucherNumber}' into Expenses.` };
        }
      }
    } else if (action === 'PURGE_FROM_TALLY') {
      const { remoteId, voucherType, voucherNumber, pairedVouchers } = payload;
      if (pairedVouchers && Array.isArray(pairedVouchers)) {
        for (const pv of pairedVouchers) {
          await deleteVoucherFromTally(pv.remoteId, pv.voucherType, pv.voucherNumber, companyName).catch(() => {});
        }
        return { success: true, message: `Purged paired salary vouchers (${voucherNumber}) from Tally Prime.` };
      }
      await deleteVoucherFromTally(remoteId, voucherType, voucherNumber, companyName);
      return { success: true, message: `Purged voucher '${voucherNumber || remoteId}' from Tally Prime.` };
    }

    return { success: false, message: 'Invalid or unrecognized action' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to execute reconciliation action' };
  }
}


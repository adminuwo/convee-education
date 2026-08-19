import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import prisma from '../db/prisma';

const BASE_URL = 'http://localhost:8001/api/v1';

interface AuditResult {
  category: string;
  endpoint: string;
  method: string;
  role: string;
  expectedStatus: number | number[];
  actualStatus: number;
  dataLeakDetected: boolean;
  leakDetails?: string;
  status: 'PASS' | 'FAIL' | 'SECURITY_VIOLATION';
  note?: string;
}

const auditResults: AuditResult[] = [];

function checkDataLeaks(data: any): { hasLeak: boolean; reason?: string } {
  if (!data) return { hasLeak: false };
  const str = JSON.stringify(data).toLowerCase();

  if (str.includes('"passwordhash"') || str.includes('"password_hash"')) {
    return { hasLeak: true, reason: 'passwordHash field exposed in response payload' };
  }
  if (/\$2[abxy]\$\d{2}\$[A-Za-z0-9./]{53}/.test(str)) {
    return { hasLeak: true, reason: 'Bcrypt password hash string detected in payload' };
  }
  if (str.includes('dev-super-secret-jwt-key') || str.includes('dev-super-secret-refresh-jwt-key')) {
    return { hasLeak: true, reason: 'JWT secret key leaked in payload' };
  }
  if (str.includes('"privatekey"') || str.includes('"private_key"')) {
    return { hasLeak: true, reason: 'Private key exposed in payload' };
  }
  return { hasLeak: false };
}

function recordTest(
  category: string,
  endpoint: string,
  method: string,
  role: string,
  expectedStatus: number | number[],
  actualStatus: number,
  data: any,
  note?: string
) {
  const allowed = Array.isArray(expectedStatus) ? expectedStatus.includes(actualStatus) : actualStatus === expectedStatus;
  const leakCheck = checkDataLeaks(data);

  let status: 'PASS' | 'FAIL' | 'SECURITY_VIOLATION' = 'PASS';
  if (leakCheck.hasLeak) {
    status = 'SECURITY_VIOLATION';
  } else if (!allowed) {
    status = 'FAIL';
  }

  auditResults.push({
    category,
    endpoint,
    method: method.toUpperCase(),
    role,
    expectedStatus,
    actualStatus,
    dataLeakDetected: leakCheck.hasLeak,
    leakDetails: leakCheck.reason,
    status,
    note,
  });

  const icon = status === 'PASS' ? '✅' : status === 'SECURITY_VIOLATION' ? '🚨' : '❌';
  console.log(`${icon} [${category}] ${method.toUpperCase()} ${endpoint} (${role}) -> HTTP ${actualStatus} ${note || ''}`);
  if (leakCheck.hasLeak) {
    console.error(`   🚨 DATA LEAK DETECTED: ${leakCheck.reason}`);
  }
}

async function runComprehensiveAudit() {
  console.log('\n========================================================================================');
  console.log('🔒 CONVEE EDUCATION - COMPREHENSIVE ENDPOINT, RBAC & DATA LEAK SECURITY AUDIT');
  console.log('========================================================================================\n');

  // 1. Log in as each role
  const tokens: Record<string, string> = {};
  const roles = [
    { role: 'ADMIN', email: 'admin@demo.edu', pass: 'Admin1234!' },
    { role: 'HOD', email: 'hod.cs@demo.edu', pass: 'Demo1234!' },
    { role: 'TEACHER', email: 'teacher.sarah@demo.edu', pass: 'Demo1234!' },
    { role: 'STUDENT', email: 'student.aarav@demo.edu', pass: 'Demo1234!' },
    { role: 'PARENT', email: 'parent.david@demo.edu', pass: 'Demo1234!' },
    { role: 'ACCOUNTANT', email: 'accountant@demo.edu', pass: 'Demo1234!' },
  ];

  console.log('--- Phase 1: Authentication & Token Issuance ---');
  for (const r of roles) {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, {
        email: r.email,
        password: r.pass,
      });
      tokens[r.role] = res.data?.accessToken;
      recordTest('Auth', '/auth/login', 'POST', r.role, 200, res.status, res.data, `Token acquired for ${r.role}`);
    } catch (err: any) {
      recordTest('Auth', '/auth/login', 'POST', r.role, 200, err?.response?.status || 500, err?.response?.data, `Failed login for ${r.role}`);
    }
  }

  const org = await prisma.organization.findFirst();
  const orgId = org?.id || '';

  // 2. Unauthenticated Security Barrier Tests (401 Expected)
  console.log('\n--- Phase 2: Unauthenticated Access Guards ---');
  const guardedEndpoints = [
    { path: '/orgs', method: 'get' },
    { path: `/orgs/${orgId}/members`, method: 'get' },
    { path: '/channels', method: 'get' },
    { path: '/tasks', method: 'get' },
    { path: '/meetings', method: 'get' },
    { path: '/timetable/slots', method: 'get' },
    { path: '/files', method: 'get' },
    { path: '/finance/fees', method: 'get' },
    { path: '/exams/department-exams', method: 'get' },
    { path: '/attendance/stats', method: 'get' },
  ];

  for (const ep of guardedEndpoints) {
    try {
      const res = await (axios as any)[ep.method](`${BASE_URL}${ep.path}`);
      recordTest('Guards', ep.path, ep.method, 'ANONYMOUS', 401, res.status, res.data, 'Missing auth guard!');
    } catch (err: any) {
      recordTest('Guards', ep.path, ep.method, 'ANONYMOUS', 401, err?.response?.status || 500, err?.response?.data, 'Barrier active');
    }
  }

  // Helper for authenticated requests
  const apiReq = async (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, role: string, body?: any) => {
    try {
      const res = await (axios as any)[method](`${BASE_URL}${path}`, ...(method === 'get' || method === 'delete' ? [{ headers: { Authorization: `Bearer ${tokens[role]}` } }] : [body, { headers: { Authorization: `Bearer ${tokens[role]}` } }]));
      return { status: res.status, data: res.data };
    } catch (err: any) {
      return { status: err?.response?.status || 500, data: err?.response?.data };
    }
  };

  // 3. Organization & Hierarchy Endpoints
  console.log('\n--- Phase 3: Organizations & Academic Hierarchy ---');
  let res = await apiReq('get', '/orgs', 'ADMIN');
  recordTest('Organizations', '/orgs', 'GET', 'ADMIN', 200, res.status, res.data);

  res = await apiReq('get', `/orgs/${orgId}`, 'ADMIN');
  recordTest('Organizations', `/orgs/:id`, 'GET', 'ADMIN', 200, res.status, res.data);

  res = await apiReq('get', `/orgs/${orgId}/members`, 'ADMIN');
  recordTest('Organizations', `/orgs/:id/members`, 'GET', 'ADMIN', 200, res.status, res.data);

  res = await apiReq('get', `/orgs/${orgId}/departments`, 'HOD');
  recordTest('Organizations', `/orgs/:id/departments`, 'GET', 'HOD', 200, res.status, res.data);

  // 4. Exams, Grading & Governance Endpoints
  console.log('\n--- Phase 4: Exams, Grading Matrix & Defaulters Tracker ---');
  res = await apiReq('get', `/exams?orgId=${orgId}`, 'HOD');
  recordTest('Exams', '/exams', 'GET', 'HOD', 200, res.status, res.data, 'HOD Exam List');

  const firstExamId = res.data?.[0]?.id || '';
  const firstSectionId = res.data?.[0]?.targetTeams?.[0]?.id || res.data?.[0]?.targetClassIds?.[0] || '';

  if (firstExamId) {
    if (firstSectionId) {
      res = await apiReq('get', `/exams/${firstExamId}/class/${firstSectionId}/grading-sheet`, 'TEACHER');
      recordTest('Exams', `/exams/:id/class/:teamId/grading-sheet`, 'GET', 'TEACHER', 200, res.status, res.data, 'Teacher Grading Matrix');
    }

    res = await apiReq('get', `/exams/${firstExamId}/defaulters`, 'HOD');
    recordTest('Exams', `/exams/:id/defaulters`, 'GET', 'HOD', 200, res.status, res.data, 'HOD Defaulters Tracker');

    res = await apiReq('post', `/exams/${firstExamId}/generate-report-cards`, 'HOD', {});
    recordTest('Exams', `/exams/:id/generate-report-cards`, 'POST', 'HOD', 200, res.status, res.data, 'Generate Report Cards');
  }

  // 5. Cloud Storage (GCS) Files Endpoints
  console.log('\n--- Phase 5: Google Cloud Storage (GCS) Files API ---');
  try {
    const form = new FormData();
    form.append('file', Buffer.from('Convee Platform Security Verification Test Document'), {
      filename: 'security-audit-test.txt',
      contentType: 'text/plain',
    });
    form.append('orgId', orgId);

    const uploadRes = await axios.post(`${BASE_URL}/files/upload`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${tokens['TEACHER']}` },
    });
    recordTest('Files GCS', '/files/upload', 'POST', 'TEACHER', 201, uploadRes.status, uploadRes.data, `Uploaded to ${uploadRes.data?.storedPath}`);

    const fileId = uploadRes.data.id;
    const downloadRes = await axios.get(`${BASE_URL}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${tokens['TEACHER']}` },
    });
    recordTest('Files GCS', `/files/:id/download`, 'GET', 'TEACHER', 200, downloadRes.status, downloadRes.data, 'Direct GCS streaming download');

    res = await apiReq('get', `/files?orgId=${orgId}`, 'TEACHER');
    recordTest('Files GCS', '/files', 'GET', 'TEACHER', 200, res.status, res.data, 'Listed GCS files');

    res = await apiReq('delete', `/files/${fileId}`, 'TEACHER');
    recordTest('Files GCS', `/files/:id`, 'DELETE', 'TEACHER', 200, res.status, res.data, 'Deleted from GCS & DB');
  } catch (err: any) {
    recordTest('Files GCS', '/files/upload', 'POST', 'TEACHER', 201, err?.response?.status || 500, err?.response?.data, err.message);
  }

  // 6. Timetable & Schedule Endpoints
  console.log('\n--- Phase 6: Timetable & Substitutes ---');
  res = await apiReq('get', `/timetable/slots`, 'TEACHER');
  recordTest('Timetable', '/timetable/slots', 'GET', 'TEACHER', 200, res.status, res.data);

  res = await apiReq('get', `/timetable/free-teachers`, 'ADMIN');
  recordTest('Timetable', '/timetable/free-teachers', 'GET', 'ADMIN', 200, res.status, res.data);

  // 7. Finance, Fees & Payslips Endpoints
  console.log('\n--- Phase 7: Finance & Fee Status ---');
  res = await apiReq('get', `/finance/fees`, 'ACCOUNTANT');
  recordTest('Finance', '/finance/fees', 'GET', 'ACCOUNTANT', 200, res.status, res.data, 'Accountant Fee Access');

  res = await apiReq('get', `/finance/payroll`, 'ACCOUNTANT');
  recordTest('Finance', '/finance/payroll', 'GET', 'ACCOUNTANT', 200, res.status, res.data, 'Accountant Payroll Access');

  // 8. Role-Based Access Control (RBAC) Barrier Enforcement
  console.log('\n--- Phase 8: Strict RBAC Barrier Enforcement ---');
  // Student should NOT access finance fees
  res = await apiReq('get', `/finance/fees`, 'STUDENT');
  recordTest('RBAC', '/finance/fees', 'GET', 'STUDENT', [403, 401, 400], res.status, res.data, 'Student blocked from general finance fees');

  // Student should NOT create department exams
  res = await apiReq('post', '/exams', 'STUDENT', { orgId, title: 'Unauthorized Exam' });
  recordTest('RBAC', '/exams', 'POST', 'STUDENT', [403, 401], res.status, res.data, 'Student blocked from creating exams');

  // Student should NOT upload files (Only teachers/faculty)
  try {
    const sForm = new FormData();
    sForm.append('file', Buffer.from('Unauthorized Student Upload'), { filename: 'student.txt' });
    sForm.append('orgId', orgId);
    const sRes = await axios.post(`${BASE_URL}/files/upload`, sForm, {
      headers: { ...sForm.getHeaders(), Authorization: `Bearer ${tokens['STUDENT']}` },
    });
    recordTest('RBAC', '/files/upload', 'POST', 'STUDENT', 403, sRes.status, sRes.data, 'Student upload guard failed');
  } catch (sErr: any) {
    recordTest('RBAC', '/files/upload', 'POST', 'STUDENT', 403, sErr?.response?.status || 500, sErr?.response?.data, 'Student upload prevented');
  }

  // Parent should NOT access teacher grading sheets
  if (firstExamId && firstSectionId) {
    res = await apiReq('get', `/exams/${firstExamId}/class/${firstSectionId}/grading-sheet`, 'PARENT');
    recordTest('RBAC', '/exams/:id/class/:teamId/grading-sheet', 'GET', 'PARENT', [403, 401], res.status, res.data, 'Parent blocked from teacher grading matrix');
  }

  // 9. Summary & Statistics
  console.log('\n========================================================================================');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('========================================================================================');

  const total = auditResults.length;
  const passed = auditResults.filter((r) => r.status === 'PASS').length;
  const failed = auditResults.filter((r) => r.status === 'FAIL').length;
  const leaks = auditResults.filter((r) => r.status === 'SECURITY_VIOLATION').length;

  console.log(`Total Endpoints & Guards Checked : ${total}`);
  console.log(`Passed Status Code & RBAC Rules  : ${passed} / ${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed Functional Checks          : ${failed}`);
  console.log(`Data / Credential Leaks Detected : ${leaks} (Target: 0)\n`);

  if (leaks > 0) {
    console.error('🚨 WARNING: SENSITIVE DATA LEAKS WERE DETECTED:');
    auditResults.filter((r) => r.status === 'SECURITY_VIOLATION').forEach((r) => {
      console.error(`- [${r.category}] ${r.method} ${r.endpoint}: ${r.leakDetails}`);
    });
  } else {
    console.log('✅ ZERO SENSITIVE DATA LEAKS DETECTED! (No password hashes, secret keys, or unauthenticated tokens exposed).');
  }
}

runComprehensiveAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Audit execution failed:', err);
    process.exit(1);
  });

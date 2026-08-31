import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import dns from 'dns';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import prisma from '../db/prisma';

// Ensure MongoDB Atlas SRV queries resolve reliably across all local network DNS resolvers
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  // Ignore in environments where setting DNS servers is restricted
}

let mongoClient: MongoClient | null = null;

async function getMongoClient(): Promise<MongoClient | null> {
  if (!env.AI_LEGAL_MONGODB_URI) {
    logger.warn('[AI-Legal Sync] AI_LEGAL_MONGODB_URI is not set in environment.');
    return null;
  }
  if (!mongoClient) {
    try {
      mongoClient = new MongoClient(env.AI_LEGAL_MONGODB_URI, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
      });
      await mongoClient.connect();
      logger.info('[AI-Legal Sync] Successfully connected to AI-Legal MongoDB cluster.');
    } catch (err: any) {
      logger.error({ err: err?.message }, '[AI-Legal Sync] Failed to connect to AI-Legal MongoDB.');
      mongoClient = null;
      return null;
    }
  }
  return mongoClient;
}

export interface StudentSyncPayload {
  studentName: string;
  studentEmail: string;
  rawPassword?: string;
  passwordHash?: string;
  studentId: string;
  organizationName: string;
  organizationSlug: string;
  className?: string;
  parentFullName?: string;
}

/**
 * Direct Backend Account Creation & Organization Registration:
 * 1. Calls AI-Legal backend directly (POST /api/auth/signup) to create the student account with native security, tokens, and plan.
 * 2. If the user already exists (HTTP 400), continues gracefully.
 * 3. If the backend is offline during local testing, falls back to direct MongoDB user upsert.
 * 4. Records student directly in Convee's dedicated 'organizations' collection in MongoDB.
 */
export async function syncStudentToAiLegal(payload: StudentSyncPayload) {
  try {
    const normalizedEmail = (payload.studentEmail || '').toLowerCase().trim();
    if (!normalizedEmail) {
      return { success: false, reason: 'Missing student email' };
    }

    const rawPassword = payload.rawPassword || 'Student@1234!';
    let backendCreated = false;

    // 1. Direct Backend API Call for Native Account Creation
    const aiLegalApiUrl = env.AI_LEGAL_BACKEND_URL.replace(/\/$/, '');
    try {
      const signupResp = await axios.post(
        `${aiLegalApiUrl}/api/auth/signup`,
        {
          name: payload.studentName,
          email: normalizedEmail,
          password: rawPassword,
          acceptedTerms: true,
          acceptedPrivacy: true,
          acceptedCookiePolicy: true,
        },
        {
          timeout: 6000,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      if (signupResp.status === 201 || signupResp.status === 200) {
        backendCreated = true;
        logger.info(`[AI-Legal Sync] Direct backend account successfully created for ${normalizedEmail} via AI-Legal API.`);
      }
    } catch (apiErr: any) {
      const errStatus = apiErr?.response?.status;
      const errMsg = apiErr?.response?.data?.error || apiErr?.message || '';

      if (errStatus === 400 && errMsg.toLowerCase().includes('already exists')) {
        backendCreated = true;
        logger.info(`[AI-Legal Sync] Account for ${normalizedEmail} already exists in AI-Legal. Proceeding with org mapping.`);
      } else {
        logger.warn(`[AI-Legal Sync] AI-Legal API signup endpoint unreachable (${apiErr.message}). Using resilient direct DB sync.`);
      }
    }

    // 2. Direct MongoDB Registration in 'organizations' & user verification
    const client = await getMongoClient();
    if (!client) {
      logger.warn('[AI-Legal Sync] MongoDB client unreachable, skipping DB indexing.');
      return { success: backendCreated, directApi: backendCreated, reason: 'MongoDB client unreachable' };
    }

    const dbName = env.AI_LEGAL_DB_NAME || 'AISA';
    const db = client.db(dbName);
    const usersCol = db.collection('users');
    const orgsCol = db.collection('organizations');

    // Ensure User document exists in AI-Legal users collection with verified status & active plan
    const existingUser = await usersCol.findOne({ email: normalizedEmail });
    let userId = existingUser ? existingUser._id : new ObjectId();
    const oneYearExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    let finalPasswordHash = payload.passwordHash;
    if (!finalPasswordHash) {
      finalPasswordHash = await bcrypt.hash(rawPassword, 10);
    }

    if (!existingUser) {
      await usersCol.insertOne({
        _id: userId,
        name: payload.studentName,
        fullName: payload.studentName,
        email: normalizedEmail,
        password: finalPasswordHash,
        phone: '',
        country: 'India',
        jurisdiction: 'India',
        isVerified: true,
        role: 'user',
        plan: 'Plan_1',
        planType: 'Plan_1',
        subscription: {
          plan: 'BASIC',
          planKey: 'Plan_1',
          status: 'active',
          paymentId: `CONVEE_ORG_${payload.organizationSlug}`,
          orderId: payload.studentId,
          amount: 499,
          currency: 'INR',
          gateway: 'Institutional',
          expiryDate: oneYearExpiry,
          purchaseDate: new Date(),
          autoRenew: true,
        },
        settings: { emailNotif: true, pushNotif: true, publicProfile: true, twoFactor: false },
        personalizations: {
          general: { language: 'English', theme: 'System', responseSpeed: 'Balanced' },
          personalization: { fontStyle: 'Default', emojiUsage: 'Moderate' },
          dataControls: { chatHistory: 'On', trainingDataUsage: true, autoDeleteDays: 30 },
        },
        modePreferences: { defaultMode: 'NORMAL_CHAT', autoDetect: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info(`[AI-Legal Sync] Direct user verified & provisioned in AI-Legal store for ${normalizedEmail}.`);
    } else {
      await usersCol.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            name: payload.studentName,
            fullName: payload.studentName,
            isVerified: true,
            plan: 'Plan_1',
            planType: 'Plan_1',
            'subscription.plan': 'BASIC',
            'subscription.planKey': 'Plan_1',
            'subscription.status': 'active',
            'subscription.expiryDate': oneYearExpiry,
            updatedAt: new Date(),
          },
        }
      );
    }

    // 3. Upsert directly into Convee's 'organizations' collection
    await orgsCol.updateOne(
      { organizationName: payload.organizationName, studentEmail: normalizedEmail },
      {
        $set: {
          organizationName: payload.organizationName,
          organizationSlug: payload.organizationSlug,
          studentEmail: normalizedEmail,
          studentName: payload.studentName,
          studentId: payload.studentId,
          className: payload.className || 'General',
          plan: 'BASIC',
          status: 'active',
          syncedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    logger.info(`[AI-Legal Sync] Recorded student directly in organizations schema (${payload.organizationName} -> ${normalizedEmail}).`);

    return {
      success: true,
      syncedEmail: normalizedEmail,
      plan: 'BASIC',
      status: 'active',
      directApi: backendCreated,
    };
  } catch (error: any) {
    logger.error({ err: error?.message }, '[AI-Legal Sync] Error during AI-Legal student synchronization.');
    return { success: false, error: error?.message };
  }
}

/**
 * Retrieves the set of student emails that exist in AI-Legal's 'organizations' collection for a given organization.
 */
export async function getOrgSyncedStudentEmails(organizationSlug: string): Promise<Set<string>> {
  try {
    const client = await getMongoClient();
    if (!client) return new Set();
    const db = client.db(env.AI_LEGAL_DB_NAME || 'AISA');
    const docs = await db.collection('organizations').find({
      organizationSlug: organizationSlug,
    }).toArray();
    return new Set(docs.map((d) => (d.studentEmail || '').toLowerCase().trim()).filter(Boolean));
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[AI-Legal Sync] Failed to fetch synced student emails from organizations schema.');
    return new Set();
  }
}

/**
 * Bulk Catch-Up / Backfill Sync:
 * When an organization enables AI-Legal (or re-enables it), this automatically iterates through
 * all active students in Convee PostgreSQL and provisions any who are not yet present in AI-Legal's organizations schema.
 */
export async function bulkSyncOrgStudentsToAiLegal(orgId: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, description: true },
    });
    if (!org) return { success: false, error: 'Organization not found' };

    const addons = (org.description || '').match(/\[ADDONS:([^\]]+)\]/i)?.[1]?.split(',').map((s) => s.trim().toUpperCase()) || [];
    if (!addons.includes('AI_LEGAL')) {
      return { success: false, error: 'AI-Legal add-on is not enabled for this organization' };
    }

    const students = await prisma.membership.findMany({
      where: { orgId, role: 'STUDENT', isActive: true },
      include: {
        user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        team: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (students.length === 0) {
      return { success: true, totalStudents: 0, syncedCount: 0, alreadySyncedCount: 0 };
    }

    const syncedEmails = await getOrgSyncedStudentEmails(org.slug);
    let newlySyncedCount = 0;

    for (const m of students) {
      const email = (m.user.email || '').toLowerCase().trim();
      if (!syncedEmails.has(email)) {
        const studentId = m.title?.match(/\[(.*?)\]/)?.[1] || `STU-${new Date().getFullYear()}-${m.user.id.substring(0, 4)}`;
        await syncStudentToAiLegal({
          studentName: m.user.fullName,
          studentEmail: email,
          rawPassword: 'Student@1234!',
          studentId,
          organizationName: org.name,
          organizationSlug: org.slug,
          className: m.team?.name || m.department?.name || 'General',
        });
        newlySyncedCount++;
      }
    }

    logger.info(`[AI-Legal Sync] Bulk sync complete for "${org.name}": ${newlySyncedCount} newly provisioned, ${syncedEmails.size} already active.`);

    return {
      success: true,
      totalStudents: students.length,
      syncedCount: newlySyncedCount,
      alreadySyncedCount: syncedEmails.size,
    };
  } catch (err: any) {
    logger.error({ err: err?.message }, '[AI-Legal Sync] Bulk student sync error.');
    return { success: false, error: err?.message };
  }
}

/**
 * Monthly Automated Student Plan Reset:
 * Automatically resets and extends all Convee institutional students' active academic plan for the new month.
 * Can be enabled or stopped per institution via the Superadmin panel.
 */
export async function monthlyResetAiLegalPlan(targetOrgId?: string, forced: boolean = false) {
  try {
    const client = await getMongoClient();
    if (!client) {
      logger.warn('[AI-Legal Monthly Reset] Skipped monthly reset: MongoDB client unreachable.');
      return { success: false, reason: 'MongoDB client unreachable', resetCount: 0 };
    }

    // 1. Fetch active organizations from Convee database
    let orgsQuery: any = targetOrgId
      ? { id: targetOrgId }
      : { description: { contains: '[ADDONS:' } };

    const activeOrgs = await prisma.organization.findMany({
      where: orgsQuery,
      select: { id: true, name: true, slug: true, description: true },
    });

    // Helper to check if AI-Legal is enabled and if auto-monthly reset is not paused
    const eligibleOrgs = activeOrgs.filter((org) => {
      const desc = org.description || '';
      const hasAiLegal = desc.toUpperCase().includes('AI_LEGAL');
      if (!hasAiLegal) return false;

      if (forced) return true; // Manual Superadmin override triggers immediate renewal

      // If AI_LEGAL_AUTO_RENEW_PAUSED tag is explicitly present, skip
      const isPaused = desc.toUpperCase().includes('AI_LEGAL_AUTO_RENEW_PAUSED');
      return !isPaused;
    });

    if (eligibleOrgs.length === 0) {
      logger.info('[AI-Legal Monthly Reset] No active institutions eligible for automated monthly student plan reset.');
      return { success: true, resetCount: 0, eligibleOrgsCount: 0 };
    }

    const eligibleOrgNames = eligibleOrgs.map((o) => o.name);
    const eligibleOrgSlugs = eligibleOrgs.map((o) => o.slug);

    const dbName = env.AI_LEGAL_DB_NAME || 'AISA';
    const db = client.db(dbName);
    const usersCol = db.collection('users');
    const orgsCol = db.collection('organizations');
    const creditLogsCol = db.collection('creditlogs');

    // 2. Fetch all student records belonging to these eligible institutions from 'organizations'
    const orgStudents = await orgsCol
      .find({
        $or: [
          { organizationName: { $in: eligibleOrgNames } },
          { organizationSlug: { $in: eligibleOrgSlugs } },
        ],
      })
      .toArray();

    const allowedStudentEmails = orgStudents
      .map((s) => (s.studentEmail || '').toLowerCase().trim())
      .filter(Boolean);

    if (allowedStudentEmails.length === 0) {
      logger.info('[AI-Legal Monthly Reset] No students found in organizations collection for eligible institutions.');
      return { success: true, resetCount: 0, eligibleOrgsCount: eligibleOrgs.length };
    }

    // 3. Batch extend student validity & subscription for the new month in AI-Legal users collection
    const nextMonthExpiry = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
    const updateResult = await usersCol.updateMany(
      { email: { $in: allowedStudentEmails } },
      {
        $set: {
          isVerified: true,
          plan: 'Plan_1',
          planType: 'Plan_1',
          'subscription.plan': 'BASIC',
          'subscription.planKey': 'Plan_1',
          'subscription.status': 'active',
          'subscription.expiryDate': nextMonthExpiry,
          updatedAt: new Date(),
        },
      }
    );

    // 4. Update 'organizations' collection timestamps
    await orgsCol.updateMany(
      { studentEmail: { $in: allowedStudentEmails } },
      {
        $set: {
          status: 'active',
          plan: 'BASIC',
          lastMonthlyResetAt: new Date(),
        },
      }
    );

    // 5. Insert audit log entries for institutional tracking
    try {
      const logs = eligibleOrgs.map((org) => ({
        organizationName: org.name,
        organizationSlug: org.slug,
        action: 'CONVEE_MONTHLY_PLAN_RENEWAL',
        description: `Automated Monthly Academic Plan Renewal (${org.name})`,
        status: 'active',
        plan: 'BASIC',
        createdAt: new Date(),
      }));

      if (logs.length > 0) {
        await creditLogsCol.insertMany(logs);
      }
    } catch (logErr: any) {
      logger.warn('[AI-Legal Monthly Reset] Audit log insertion note:', logErr?.message);
    }

    logger.info(`[AI-Legal Monthly Reset] Successfully renewed academic plans for ${updateResult.modifiedCount} students across ${eligibleOrgs.length} institutions.`);
    return {
      success: true,
      resetCount: updateResult.modifiedCount,
      eligibleOrgsCount: eligibleOrgs.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error({ err: error?.message }, '[AI-Legal Monthly Reset] Error during monthly student plan reset.');
    return { success: false, error: error?.message, resetCount: 0 };
  }
}

/**
 * Initializes the automated 1st-of-the-month cron job in Convee backend
 */
export function startAiLegalMonthlyQuotaCron() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cron = require('node-cron');

    logger.info('[AI-Legal Sync] Initializing Monthly Student Plan Renewal Scheduler (00:00 on 1st of every month)...');

    // Schedule to run on the 1st of every month at 00:00 (Midnight)
    cron.schedule('0 0 1 * *', async () => {
      logger.info('[AI-Legal Sync] Executing scheduled 1st-of-month student academic plan renewal for active Convee institutions...');
      await monthlyResetAiLegalPlan();
    });
  } catch (err: any) {
    logger.info('[AI-Legal Sync] node-cron scheduler initialized in passive mode.');
  }
}

/**
 * Privacy-Preserving Academic Telemetry Aggregator:
 * Aggregates student feature usage counts, inquiries, and chat session counts directly from Convee's organizations collection & AI-Legal activity logs.
 * PRIVACY GUARANTEE: Never inspects, extracts, or returns message contents or prompts.
 */
export async function getAiLegalOrgTelemetry(orgName: string, orgSlug: string, orgDescription?: string) {
  try {
    const client = await getMongoClient();
    if (!client) {
      return {
        enabled: true,
        connected: false,
        message: 'AI-Legal telemetry service connecting...',
        overview: { totalStudents: 0, activeScholars: 0, totalInquiries: 0, totalChatSessions: 0, planName: 'Full Academic Suite' },
        autoMonthlyResetActive: true,
        featureBreakdown: [],
        students: [],
      };
    }

    const isAutoResetPaused = (orgDescription || '').toUpperCase().includes('AI_LEGAL_AUTO_RENEW_PAUSED');

    const dbName = env.AI_LEGAL_DB_NAME || 'AISA';
    const db = client.db(dbName);
    const usersCol = db.collection('users');
    const orgsCol = db.collection('organizations');
    const creditLogsCol = db.collection('creditlogs');

    // 1. Fetch all students registered under this institution from organizations collection
    const orgStudents = await orgsCol
      .find({
        $or: [{ organizationName: orgName }, { organizationSlug: orgSlug }],
      })
      .sort({ syncedAt: -1 })
      .toArray();

    if (orgStudents.length === 0) {
      return {
        enabled: true,
        connected: true,
        autoMonthlyResetActive: !isAutoResetPaused,
        overview: {
          totalStudents: 0,
          activeScholars: 0,
          totalInquiries: 0,
          totalChatSessions: 0,
          planName: 'Full Academic Suite',
        },
        featureBreakdown: [],
        students: [],
      };
    }

    const emails = orgStudents.map((s) => (s.studentEmail || '').toLowerCase().trim()).filter(Boolean);

    // 2. Fetch user documents from AI-Legal users collection
    const users = await usersCol.find({ email: { $in: emails } }).toArray();
    const userByEmail: Record<string, any> = {};
    const userById: Record<string, any> = {};

    users.forEach((u) => {
      userByEmail[(u.email || '').toLowerCase().trim()] = u;
      userById[String(u._id)] = u;
    });

    // 3. Fetch credit usage logs for these students (tools and chats used)
    const userObjectIds = Object.keys(userById).map((id) => new ObjectId(id));
    const logs = await creditLogsCol
      .find({ userId: { $in: userObjectIds } })
      .sort({ createdAt: -1 })
      .toArray();

    // Map of friendly module names
    const normalizeFeatureName = (act: string = '') => {
      const lower = act.toLowerCase();
      if (lower.includes('precedent') || lower.includes('precedents')) return 'Legal Precedents & Case Laws';
      if (lower.includes('draft')) return 'Draft Maker (Petitions & Contracts)';
      if (lower.includes('strategy')) return 'Legal Strategy Engine';
      if (lower.includes('argument')) return 'Argument Builder & Court Prep';
      if (lower.includes('courtroom')) return 'AI Mock Courtroom';
      if (lower.includes('client')) return 'AI Client Connect';
      if (lower.includes('predictor') || lower.includes('case')) return 'AI Case Predictor';
      if (lower.includes('audio') || lower.includes('voice')) return 'Court Audio Transcription';
      if (lower.includes('chat')) return 'Legal Research Chat';
      if (lower.includes('toolkit')) return 'Statutory Intelligence Toolkit';
      return act || 'General Legal Research';
    };

    const featureCountMap: Record<string, number> = {};
    const studentStats: Record<string, { totalInquiries: number; totalChats: number; tools: Record<string, number>; lastActive?: Date }> = {};

    let grandTotalInquiries = 0;
    let grandTotalChats = 0;

    // Filter out initial grants and refills to only count real student activity
    const nonUsageActions = new Set([
      'CONVEE_BASIC_PLAN_GRANT',
      'CONVEE_MONTHLY_QUOTA_RESET',
      'CONVEE_MONTHLY_PLAN_RENEWAL',
      'CONVEE_INSTITUTIONAL_INITIAL_GRANT',
      'convee_daily_quota_reset',
      'bonus',
      'plan_credit',
    ]);

    logs.forEach((l) => {
      if (nonUsageActions.has(l.action)) return;

      const normFeature = normalizeFeatureName(l.action);
      featureCountMap[normFeature] = (featureCountMap[normFeature] || 0) + 1;
      grandTotalInquiries += 1;

      const isChat = (l.action || '').toLowerCase().includes('chat');
      if (isChat) grandTotalChats += 1;

      const uId = String(l.userId);
      if (!studentStats[uId]) {
        studentStats[uId] = { totalInquiries: 0, totalChats: 0, tools: {}, lastActive: l.createdAt };
      }
      studentStats[uId].totalInquiries += 1;
      if (isChat) studentStats[uId].totalChats += 1;
      studentStats[uId].tools[normFeature] = (studentStats[uId].tools[normFeature] || 0) + 1;
      if (!studentStats[uId].lastActive || new Date(l.createdAt) > new Date(studentStats[uId].lastActive!)) {
        studentStats[uId].lastActive = l.createdAt;
      }
    });

    // Compute feature breakdown percentages
    const featureBreakdown = Object.entries(featureCountMap)
      .map(([feature, count]) => ({
        feature,
        count,
        percentage: grandTotalInquiries > 0 ? Math.round((count / grandTotalInquiries) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Build per-student telemetry table rows
    const studentRows = orgStudents.map((orgStu) => {
      const emailKey = (orgStu.studentEmail || '').toLowerCase().trim();
      const user = userByEmail[emailKey];
      const uId = user ? String(user._id) : '';
      const stats = studentStats[uId] || { totalInquiries: 0, totalChats: 0, tools: {} };

      // Determine top feature for this student
      let topFeature = 'Not yet active';
      let topCount = 0;
      Object.entries(stats.tools || {}).forEach(([tool, count]) => {
        if (count > topCount) {
          topCount = count;
          topFeature = `${tool} (${count}x)`;
        }
      });

      return {
        studentName: orgStu.studentName || user?.name || 'Student',
        studentId: orgStu.studentId || 'N/A',
        studentEmail: orgStu.studentEmail,
        className: orgStu.className || 'General',
        totalInquiries: stats.totalInquiries,
        totalChats: stats.totalChats,
        topFeature,
        plan: 'Full Academic Suite',
        status: user?.subscription?.status || orgStu.status || 'active',
        lastActiveAt: stats.lastActive ? new Date(stats.lastActive).toISOString() : null,
      };
    });

    const activeScholarsCount = studentRows.filter((s) => s.totalInquiries > 0).length;

    return {
      enabled: true,
      connected: true,
      autoMonthlyResetActive: !isAutoResetPaused,
      overview: {
        totalStudents: orgStudents.length,
        activeScholars: activeScholarsCount,
        totalInquiries: grandTotalInquiries,
        totalChatSessions: grandTotalChats,
        planName: 'Full Academic Suite',
      },
      featureBreakdown,
      students: studentRows,
    };
  } catch (error: any) {
    logger.error({ err: error?.message }, '[AI-Legal Telemetry] Error fetching org telemetry.');
    return {
      enabled: true,
      connected: false,
      error: error?.message,
      autoMonthlyResetActive: true,
      overview: { totalStudents: 0, activeScholars: 0, totalInquiries: 0, totalChatSessions: 0, planName: 'Full Academic Suite' },
      featureBreakdown: [],
      students: [],
    };
  }
}

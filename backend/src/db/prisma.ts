import { PrismaClient } from '../generated/client';
import { env } from '../config/env';

let dbUrl = env.DATABASE_URL || process.env.DATABASE_URL || '';
if (dbUrl) {
  if (dbUrl.includes('connection_limit=')) {
    dbUrl = dbUrl.replace(/connection_limit=\d+/, 'connection_limit=5');
  } else {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=30';
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: ['error', 'warn'],
});

let ensured = false;
export async function ensureProjectTeamTable() {
  if (ensured) return;
  ensured = true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProjectTeam" (
        "projectId" TEXT NOT NULL,
        "teamId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProjectTeam_pkey" PRIMARY KEY ("projectId", "teamId")
      );
    `);
  } catch (e) {
    // ignore - table may already exist
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TaskAssignee" ADD COLUMN IF NOT EXISTS "requestedDueDate" TIMESTAMP(3);
    `);
  } catch (e) {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectTeam" DROP CONSTRAINT IF EXISTS "ProjectTeam_projectId_fkey";
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch (e) {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectTeam" DROP CONSTRAINT IF EXISTS "ProjectTeam_teamId_fkey";
    `);
  } catch (e) {
    // ignore
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TallyTombstone" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orgId" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "voucherNumber" TEXT,
        "remoteId" TEXT,
        "tallySyncStatus" TEXT NOT NULL DEFAULT 'PENDING_TALLY_DELETE',
        "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TallyTombstone_orgId_idx" ON "TallyTombstone"("orgId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TallyTombstone_remoteId_idx" ON "TallyTombstone"("remoteId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TallyTombstone_voucherNumber_idx" ON "TallyTombstone"("voucherNumber");`);
  } catch (e: any) {
    console.error('Error ensuring TallyTombstone table:', e.message);
  }
}

// Run asynchronously in background on startup
setTimeout(() => ensureProjectTeamTable().catch(() => {}), 1000);

export default prisma;

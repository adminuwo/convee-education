import { PrismaClient } from '@prisma/client';
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
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch (e) {
    // ignore
  }
}

// Run asynchronously in background on startup
setTimeout(() => ensureProjectTeamTable().catch(() => {}), 1000);

export default prisma;

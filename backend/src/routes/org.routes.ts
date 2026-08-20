import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import prisma from '../db/prisma';
import { authenticate, attachOrg } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { hashPassword } from '../utils/password';
import { isEmailConfigured, sendVerificationEmail, verifyEmailDomain, sendInviteCredentialsEmail } from '../utils/email';
import { uploadBufferToGcs } from '../services/gcs.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPEG, WebP, SVG, GIF) are allowed for organization logo'));
    }
  },
});

const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many invitations sent from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const CreateOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user!.id, isActive: true },
      include: { organization: true },
    });
    res.json(memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logoUrl: m.organization.logoUrl,
      role: m.role,
    })));
  } catch (e) { next(e); }
});

router.post('/', validate(CreateOrgSchema), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    let { slug } = req.body;
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
    const org = await prisma.organization.create({
      data: { name, slug, description, ownerId: req.user!.id },
    });
    await prisma.membership.create({ data: { userId: req.user!.id, orgId: org.id, role: 'DIRECTOR' } });
    const g = await prisma.channel.create({ data: { orgId: org.id, name: 'general', type: 'PUBLIC', createdById: req.user!.id } });
    await prisma.channelMember.create({ data: { channelId: g.id, userId: req.user!.id, isAdmin: true } });
    res.status(201).json(org);
  } catch (e) { next(e); }
});

router.get('/:orgId', async (req, res, next) => {
  try {
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true },
    });
    if (!membership) return res.status(403).json({ error: 'Not a member' });
    const org = await prisma.organization.findUnique({
      where: { id: req.params.orgId },
      include: {
        _count: { select: { memberships: true, channels: true, tasks: true, meetings: true } },
      },
    });
    res.json({ ...org, myRole: membership.role });
  } catch (e) { next(e); }
});

// Update Organization Settings (Strictly Director / Owner Only)
router.patch('/:orgId', async (req, res, next) => {
  try {
    const orgId = req.params.orgId as string;
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!membership || (membership.role !== 'DIRECTOR' && membership.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Only Directors can update organization settings or logo.' });
    }
    const { name, description, logoUrl } = req.body;
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Organization name cannot be empty' });
    }
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${orgId}`).emit('org:updated', org);
    }

    res.json({ success: true, org });
  } catch (e) { next(e); }
});

// Dedicated Director-only Logo Upload endpoint (Supports multipart file & direct URL/Base64)
router.post('/:orgId/logo', logoUpload.single('logo'), async (req, res, next) => {
  try {
    const orgId = req.params.orgId as string;
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!membership || (membership.role !== 'DIRECTOR' && membership.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Only Directors can change or upload the institution logo.' });
    }

    let finalLogoUrl = req.body?.logoUrl;
    const file = (req as any).file;

    if (file) {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const uid = Math.random().toString(36).substring(2, 10);
      const gcsKey = `orgs/${orgId}/branding/logo-${Date.now()}-${uid}${ext}`;
      try {
        const uploadResult = await uploadBufferToGcs(file.buffer, gcsKey, file.mimetype);
        finalLogoUrl = uploadResult.signedUrl || uploadResult.publicUrl;
      } catch (gcsErr: any) {
        logger.warn(`GCS upload fallback to base64 data URI for org logo: ${gcsErr?.message}`);
        finalLogoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      }
    }

    if (!finalLogoUrl) {
      return res.status(400).json({ error: 'No logo file or image URL provided.' });
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl: finalLogoUrl },
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${orgId}`).emit('org:updated', org);
    }

    res.json({ success: true, logoUrl: finalLogoUrl, org });
  } catch (e) { next(e); }
});

// Dedicated Director-only Logo Removal endpoint
router.delete('/:orgId/logo', async (req, res, next) => {
  try {
    const orgId = req.params.orgId as string;
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    if (!membership || (membership.role !== 'DIRECTOR' && membership.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Only Directors can remove the institution logo.' });
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl: null },
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${orgId}`).emit('org:updated', org);
    }

    res.json({ success: true, message: 'Institution logo removed successfully.', org });
  } catch (e) { next(e); }
});

// Departments
router.get('/:orgId/departments', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const [departments, teamChannels, orgMemberships] = await Promise.all([
      prisma.department.findMany({
        where: { orgId: req.params.orgId, deletedAt: null },
        include: {
          teams: {
            where: { deletedAt: null },
            include: {
              memberships: {
                where: { isActive: true },
                include: {
                  user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
                },
              },
              _count: { select: { memberships: true, projects: true } },
            },
          },
          _count: { select: { memberships: true, teams: true } },
        },
      }),
      prisma.channel.findMany({
        where: { orgId: req.params.orgId, type: 'TEAM', deletedAt: null },
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
          },
        },
      }),
      prisma.membership.findMany({
        where: { orgId: req.params.orgId, isActive: true },
        select: { id: true, userId: true, departmentId: true, teamId: true },
      }),
    ]);

    const headIds = departments.map((d) => d.headId).filter(Boolean) as string[];
    const headUsers = headIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: headIds } },
      select: { id: true, fullName: true, email: true, avatarUrl: true },
    }) : [];
    const headUserMap = new Map(headUsers.map((u) => [u.id, u]));

    const channelMap = new Map(teamChannels.map((c) => [c.name.toLowerCase(), c.members]));

    const result = departments.map((d) => {
      const deptUserIds = new Set<string>();

      const teams = (d.teams || []).map((t) => {
        const chName = `team-${t.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const chMembers = channelMap.get(chName) || [];

        const teamUserMap = new Map<string, any>();

        (t.memberships || []).forEach((mem) => {
          const uId = mem.user?.id || mem.userId;
          if (uId) teamUserMap.set(uId, mem);
        });

        chMembers.forEach((cm) => {
          if (cm.user?.id && !teamUserMap.has(cm.user.id)) {
            teamUserMap.set(cm.user.id, {
              id: `cm-${cm.id}`,
              userId: cm.user.id,
              user: cm.user,
              role: 'MEMBER',
              isActive: true,
            });
          }
        });

        const mergedTeamMemberships = Array.from(teamUserMap.values());
        mergedTeamMemberships.forEach((m) => {
          const uId = m.user?.id || m.userId;
          if (uId) deptUserIds.add(uId);
        });

        return {
          ...t,
          memberships: mergedTeamMemberships,
          _count: {
            ...t._count,
            memberships: mergedTeamMemberships.length,
          },
        };
      });

      orgMemberships.forEach((mem) => {
        if (mem.departmentId === d.id && mem.userId) {
          deptUserIds.add(mem.userId);
        }
      });

      return {
        ...d,
        teams,
        headUser: d.headId ? headUserMap.get(d.headId) || null : null,
        _count: {
          ...d._count,
          memberships: deptUserIds.size,
        },
      };
    });

    res.json(result);
  } catch (e) { next(e); }
});

router.patch('/:orgId/departments/:deptId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN'].includes(m.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { name, headId } = req.body;
    const cleanHeadId = (!headId || headId === 'unassigned') ? null : headId;
    const updated = await prisma.department.update({
      where: { id: req.params.deptId },
      data: {
        ...(name ? { name } : {}),
        ...(headId !== undefined ? { headId: cleanHeadId } : {}),
      },
    });

    if (cleanHeadId) {
      await prisma.membership.updateMany({
        where: { userId: cleanHeadId, orgId: req.params.orgId, isActive: true },
        data: { departmentId: req.params.deptId, role: 'HOD' as any },
      });
    }

    const io = req.app.locals.io;
    if (io) {
      io.emit('department:updated', { id: updated.id, orgId: req.params.orgId, headId: cleanHeadId });
      if (cleanHeadId) {
        io.emit('membership:updated', { userId: cleanHeadId, orgId: req.params.orgId, role: 'HOD', departmentId: req.params.deptId });
      }
    }

    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/:orgId/departments', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const dept = await prisma.department.create({ data: { name, orgId: req.params.orgId } });
    res.status(201).json(dept);
  } catch (e) { next(e); }
});

// Delete School Wing (Department)
router.delete('/:orgId/departments/:deptId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const dept = await prisma.department.findFirst({ where: { id: req.params.deptId, orgId: req.params.orgId } });
    if (!dept) return res.status(404).json({ error: 'School Wing not found' });

    const now = new Date();
    await prisma.$transaction([
      prisma.department.update({ where: { id: dept.id }, data: { deletedAt: now } }),
      prisma.team.updateMany({ where: { departmentId: dept.id }, data: { deletedAt: now } }),
    ]);

    res.json({ ok: true, message: 'School Wing deleted successfully' });
  } catch (e) { next(e); }
});

// Delete Class & Section (Team)
router.delete('/:orgId/teams/:teamId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
    if (!team) return res.status(404).json({ error: 'Class & Section not found' });

    const now = new Date();
    await prisma.team.update({ where: { id: team.id }, data: { deletedAt: now } });

    const chName = `team-${team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    await prisma.channel.updateMany({
      where: { orgId: req.params.orgId, type: 'TEAM', name: chName, deletedAt: null },
      data: { deletedAt: now },
    });

    res.json({ ok: true, message: 'Class & Section deleted successfully' });
  } catch (e) { next(e); }
});

async function syncTeamChannel(orgId: string, teamId: string, io: any) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { memberships: { where: { isActive: true } } },
    });
    if (!team) return;

    const chName = `team-${team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    let ch = await prisma.channel.findFirst({
      where: { orgId, type: 'TEAM', name: chName, deletedAt: null },
    });

    if (!ch) {
      ch = await prisma.channel.create({
        data: {
          orgId,
          name: chName,
          description: `Official channel for team ${team.name}`,
          type: 'TEAM',
          createdById: team.managerId || null,
        },
      });
    }

    const uIds = new Set<string>();
    if (team.managerId && team.managerId !== 'unassigned') uIds.add(team.managerId);
    team.memberships.forEach((m) => { if (m.userId) uIds.add(m.userId); });

    for (const uid of Array.from(uIds)) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: uid } },
        create: { channelId: ch.id, userId: uid, isAdmin: uid === team.managerId },
        update: {},
      }).catch(() => { });
    }

    if (io) {
      const fullChannel = await prisma.channel.findUnique({
        where: { id: ch.id },
        include: {
          members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
          _count: { select: { messages: true } },
        },
      });
      io.emit('channel:created', fullChannel);
    }
  } catch (err) { }
}

async function syncProjectChannel(orgId: string, projectId: string, io: any) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        memberships: { where: { isActive: true } },
        team: { include: { memberships: { where: { isActive: true } } } },
      },
    });
    if (!project) return;

    let ch = await prisma.channel.findFirst({
      where: { orgId, type: 'PROJECT', projectId: project.id, deletedAt: null },
    });

    if (!ch) {
      const chName = `project-${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      ch = await prisma.channel.create({
        data: {
          orgId,
          name: chName,
          description: `Official channel for project ${project.name}`,
          type: 'PROJECT',
          projectId: project.id,
        },
      });
    }

    const pUserIds = new Set<string>();
    (project.memberships || []).forEach((m) => { if (m.userId) pUserIds.add(m.userId); });
    if (project.team?.managerId && project.team.managerId !== 'unassigned') pUserIds.add(project.team.managerId);
    (project.team?.memberships || []).forEach((tm) => { if (tm.userId) pUserIds.add(tm.userId); });

    for (const uid of Array.from(pUserIds)) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: uid } },
        create: { channelId: ch.id, userId: uid },
        update: {},
      }).catch(() => { });
    }

    if (io) {
      const fullChannel = await prisma.channel.findUnique({
        where: { id: ch.id },
        include: {
          members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
          _count: { select: { messages: true } },
        },
      });
      io.emit('channel:created', fullChannel);
      io.emit('project:created', { id: project.id, name: project.name, orgId });
      io.emit('project:updated', { id: project.id, name: project.name, orgId });
    }
  } catch (err) { }
}

async function postSystemAnnouncement(orgId: string, content: string, io: any, senderId?: string) {
  try {
    let channel = await prisma.channel.findFirst({
      where: { orgId, type: 'ANNOUNCEMENT', deletedAt: null },
    });
    if (!channel) {
      channel = await prisma.channel.findFirst({
        where: { orgId, name: 'general', deletedAt: null },
      });
    }
    if (!channel) return;

    let authorId = senderId;
    if (!authorId) {
      const owner = await prisma.membership.findFirst({ where: { orgId, role: 'OWNER' } });
      authorId = owner?.userId;
    }
    if (!authorId) return;

    const msg = await prisma.message.create({
      data: {
        channelId: channel.id,
        senderId: authorId,
        content,
        type: 'SYSTEM',
      },
      include: { sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });

    if (io) {
      io.to(`channel:${channel.id}`).emit('message:new', msg);
    }
  } catch (err) {
    // ignore
  }
}

router.post('/:orgId/departments/:deptId/teams', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const { name, managerId } = req.body;
    const team = await prisma.team.create({ data: { name, departmentId: req.params.deptId, managerId } });
    await syncTeamChannel(req.params.orgId, team.id, req.app.locals.io);
    await postSystemAnnouncement(req.params.orgId, `📢 **New Team Created**: **${team.name}** team has been formed! 🎉`, req.app.locals.io, req.user!.id);
    res.status(201).json(team);
  } catch (e) { next(e); }
});

// Get single team details
router.get('/:orgId/teams/:teamId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        department: true,
        memberships: {
          where: { isActive: true },
          include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true } } },
        },
        projects: {
          where: { deletedAt: null },
          include: { _count: { select: { tasks: true, memberships: true } } },
        },
        _count: { select: { memberships: true, projects: true } },
      },
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    let managerUser: any = null;
    if (team.managerId && team.managerId !== 'unassigned') {
      managerUser = await prisma.user.findUnique({
        where: { id: team.managerId },
        select: { id: true, email: true, fullName: true, avatarUrl: true },
      });
    }

    const teamMemberships = await getMembershipsForTeams([team.id], req.params.orgId);
    res.json({ ...team, memberships: teamMemberships, managerUser });
  } catch (e) { next(e); }
});

// Update team details (name, managerId)
router.patch('/:orgId/teams/:teamId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
    if (!team) return res.status(404).json({ error: 'Class section not found' });

    const isFullAdmin = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'].includes(m.role);
    if (!isFullAdmin && ['DEAN', 'HOD'].includes(m.role)) {
      const dept = await prisma.department.findUnique({ where: { id: team.departmentId } });
      const isDeptHead = dept?.headId === req.user!.id;
      const isInSameDept = m.departmentId === team.departmentId;
      if (!isDeptHead && !isInSameDept) {
        return res.status(403).json({ error: 'You can only assign Class Teachers within your assigned Department / Wing' });
      }
    }

    const { name, managerId } = req.body;
    const cleanManagerId = (!managerId || managerId === 'unassigned') ? null : managerId;
    const updated = await prisma.team.update({
      where: { id: req.params.teamId },
      data: {
        ...(name ? { name } : {}),
        ...(managerId !== undefined ? { managerId: cleanManagerId } : {}),
      },
    });
    await syncTeamChannel(req.params.orgId, req.params.teamId, req.app.locals.io);
    res.json(updated);
  } catch (e) { next(e); }
});

async function saveTeamMembers(teamId: string, userIds: string[]) {
  for (const uId of userIds) {
    if (!uId) continue;
    await prisma.membership.updateMany({
      where: { userId: uId, isActive: true },
      data: { teamId },
    }).catch(() => { });
  }
}

async function removeTeamMemberSql(teamId: string, membershipId: string) {
  try {
    await prisma.membership.update({
      where: { id: membershipId },
      data: { teamId: null },
    }).catch(() => { });
  } catch (e) { }
}

async function getMembershipsForTeams(teamIds: string[], orgId: string) {
  if (teamIds.length === 0) return [];
  try {
    return await prisma.membership.findMany({
      where: { teamId: { in: teamIds }, orgId, isActive: true },
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true } } },
    });
  } catch (e) {
    return [];
  }
}

// Add member(s) to team
router.post('/:orgId/teams/:teamId/members', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { userId, userIds } = req.body;
    const targetUserIds: string[] = Array.isArray(userIds) && userIds.length > 0 ? userIds : (userId ? [userId] : []);
    if (targetUserIds.length === 0) return res.status(400).json({ error: 'User ID(s) required' });

    const team = await prisma.team.findUnique({ where: { id: req.params.teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    await saveTeamMembers(team.id, targetUserIds);
    await prisma.membership.updateMany({
      where: { userId: { in: targetUserIds }, orgId: req.params.orgId, isActive: true },
      data: { teamId: team.id, departmentId: team.departmentId },
    });
    await syncTeamChannel(req.params.orgId, team.id, req.app.locals.io);

    res.json({ ok: true, message: 'Members added to team' });
  } catch (e) { next(e); }
});

// Remove member from team
router.delete('/:orgId/teams/:teamId/members/:membershipId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await removeTeamMemberSql(req.params.teamId, req.params.membershipId);
    await prisma.membership.update({
      where: { id: req.params.membershipId },
      data: { teamId: null },
    }).catch(() => { });
    await syncTeamChannel(req.params.orgId, req.params.teamId, req.app.locals.io);

    res.json({ ok: true, message: 'Member removed from team' });
  } catch (e) { next(e); }
});

async function saveProjectTeams(projectId: string, teamIds: string[]) {
  for (const tId of teamIds) {
    if (!tId) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ProjectTeam" ("projectId", "teamId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      projectId, tId
    ).catch(() => { });
  }
}

async function getProjectTeams(projectId: string) {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT pt."teamId", t.name, t."departmentId", d.name as "departmentName"
       FROM "ProjectTeam" pt
       JOIN "Team" t ON t.id = pt."teamId"
       LEFT JOIN "Department" d ON d.id = t."departmentId"
       WHERE pt."projectId" = $1 AND t."deletedAt" IS NULL`,
      projectId
    );
    return rows.map((r) => ({
      id: r.teamId,
      name: r.name,
      departmentId: r.departmentId,
      department: { id: r.departmentId, name: r.departmentName },
    }));
  } catch (e) {
    return [];
  }
}

router.post('/:orgId/teams/:teamId/projects', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const { name, description, teamIds } = req.body;
    const selectedTeamIds: string[] = Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : [req.params.teamId];

    const project = await prisma.project.create({
      data: {
        name,
        description,
        teamId: req.params.teamId,
      },
    });

    await saveProjectTeams(project.id, selectedTeamIds);
    await syncProjectChannel(req.params.orgId, project.id, req.app.locals.io);
    await postSystemAnnouncement(req.params.orgId, `📢 **New Project Launched**: **${project.name}** project is now active! 🚀`, req.app.locals.io, req.user!.id);
    res.status(201).json(project);
  } catch (e) { next(e); }
});

// Create project directly for org (with multiple teams)
router.post('/:orgId/projects', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const { name, description, teamId, teamIds } = req.body;
    const selectedTeamIds: string[] = Array.isArray(teamIds) && teamIds.length > 0 ? teamIds : (teamId ? [teamId] : []);
    const primaryTeamId = selectedTeamIds[0] || teamId || null;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        teamId: primaryTeamId,
      },
    });

    await saveProjectTeams(project.id, selectedTeamIds);
    await syncProjectChannel(req.params.orgId, project.id, req.app.locals.io);
    await postSystemAnnouncement(req.params.orgId, `📢 **New Project Launched**: **${project.name}** project is now active! 🚀`, req.app.locals.io, req.user!.id);
    res.status(201).json(project);
  } catch (e) { next(e); }
});

// List projects in org (across teams)
router.get('/:orgId/projects', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const isExecutive = ['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN'].includes(m.role);
    const userTeamId = m.teamId || '';
    const userId = req.user!.id;

    const whereClause: any = {
      deletedAt: null,
      OR: [
        { team: { department: { orgId: req.params.orgId } } },
        { teams: { some: { team: { department: { orgId: req.params.orgId } } } } },
      ],
    };

    if (!isExecutive) {
      whereClause.AND = [
        {
          OR: [
            ...(userTeamId ? [{ teamId: userTeamId }, { teams: { some: { teamId: userTeamId } } }] : []),
            { memberships: { some: { userId } } },
          ],
        },
      ];
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        team: { include: { department: true } },
        teams: { include: { team: { include: { department: true } } } },
        _count: { select: { tasks: true, memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const projectList = projects.map((p) => {
      const teamMap = new Map();
      if (p.team) teamMap.set(p.team.id, p.team);
      if (p.teams) p.teams.forEach((pt: any) => { if (pt.team) teamMap.set(pt.team.id, pt.team); });
      const allAssignedTeams = Array.from(teamMap.values()).map((t) => ({ team: t }));
      return {
        ...p,
        teams: allAssignedTeams,
      };
    });

    res.json(projectList);
  } catch (e) { next(e); }
});

// Get single project details
router.get('/:orgId/projects/:projectId', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        team: {
          include: {
            department: true,
            memberships: {
              where: { isActive: true },
              include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true } } },
            },
          },
        },
        memberships: {
          where: { isActive: true },
          include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true } } },
        },
        tasks: {
          where: { deletedAt: null },
          include: {
            assignees: { include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true } } } },
            createdBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tasks: true, memberships: true } },
      },
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const extraTeams = await getProjectTeams(project.id);
    const teamMap = new Map();
    if (project.team) teamMap.set(project.team.id, project.team);
    extraTeams.forEach((t) => teamMap.set(t.id, t));

    const allTeamIds = Array.from(teamMap.keys());
    const teamMemberships = await getMembershipsForTeams(allTeamIds, req.params.orgId);

    const teamsWithMembers = Array.from(teamMap.values()).map((t) => ({
      team: {
        ...t,
        memberships: teamMemberships.filter((mem) => mem.teamId === t.id),
      },
    }));

    res.json({
      ...project,
      teams: teamsWithMembers,
    });
  } catch (e) { next(e); }
});

// Add team to project
router.post('/:orgId/projects/:projectId/teams', async (req, res, next) => {
  try {
    const currentMember = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!currentMember || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'Team ID is required' });

    await saveProjectTeams(req.params.projectId, [teamId]);
    await syncProjectChannel(req.params.orgId, req.params.projectId, req.app.locals.io);
    res.json({ ok: true, message: 'Team added to project' });
  } catch (e) { next(e); }
});

// Remove team from project
router.delete('/:orgId/projects/:projectId/teams/:teamId', async (req, res, next) => {
  try {
    const currentMember = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!currentMember || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "ProjectTeam" WHERE "projectId" = $1 AND "teamId" = $2`,
      req.params.projectId, req.params.teamId
    ).catch(() => { });

    res.json({ ok: true, message: 'Team removed from project' });
  } catch (e) { next(e); }
});

// Assign member(s) to project
router.post('/:orgId/projects/:projectId/assign', async (req, res, next) => {
  try {
    const currentMember = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!currentMember || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { userId, userIds } = req.body;
    const targetUserIds: string[] = Array.isArray(userIds) && userIds.length > 0 ? userIds : (userId ? [userId] : []);
    if (targetUserIds.length === 0) return res.status(400).json({ error: 'User ID(s) required' });

    await prisma.membership.updateMany({
      where: { userId: { in: targetUserIds }, orgId: req.params.orgId, isActive: true },
      data: { projectId: req.params.projectId },
    });
    await syncProjectChannel(req.params.orgId, req.params.projectId, req.app.locals.io);

    res.json({ ok: true, message: 'Members assigned to project' });
  } catch (e) { next(e); }
});

// Remove member from project
router.delete('/:orgId/projects/:projectId/members/:membershipId', async (req, res, next) => {
  try {
    const currentMember = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!currentMember || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.membership.update({
      where: { id: req.params.membershipId },
      data: { projectId: null },
    });
    await syncProjectChannel(req.params.orgId, req.params.projectId, req.app.locals.io);

    res.json({ ok: true, message: 'Member removed from project' });
  } catch (e) { next(e); }
});

// Members list
router.get('/:orgId/members', async (req, res, next) => {
  try {
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });
    const members = await prisma.membership.findMany({
      where: { orgId: req.params.orgId, isActive: true },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true } },
        department: true,
        team: true,
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members);
  } catch (e) { next(e); }
});

// Accept or Decline org invitation
router.post('/invitations/:membershipId/respond', async (req, res, next) => {
  try {
    const { action } = req.body; // 'ACCEPT' | 'DECLINE'
    const { membershipId } = req.params;

    const mem = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { organization: true },
    });

    if (!mem) return res.status(404).json({ error: 'Invitation not found' });
    if (mem.userId !== req.user!.id) return res.status(403).json({ error: 'Not authorized to respond to this invitation' });

    if (action === 'ACCEPT') {
      await prisma.membership.update({
        where: { id: membershipId },
        data: { isActive: true },
      });

      // Add to general channel
      const genChannel = await prisma.channel.findFirst({
        where: { orgId: mem.orgId, name: 'general', deletedAt: null },
      });
      if (genChannel) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: genChannel.id, userId: req.user!.id } },
          create: { channelId: genChannel.id, userId: req.user!.id },
          update: {},
        }).catch(() => { });
      }

      res.json({ message: 'Invitation accepted successfully!', org: mem.organization });
    } else {
      await prisma.membership.delete({
        where: { id: membershipId },
      });
      res.json({ message: 'Invitation declined.' });
    }
  } catch (e) { next(e); }
});

// Invite member (auto-generates unique ID, bcrypt initial password, activates membership & sends credentials)
router.post('/:orgId/invite', inviteLimiter, async (req, res, next) => {
  try {
    const orgId = req.params.orgId as string;
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    const { email, fullName, role, departmentId, teamId } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const targetRole = role || 'TEACHER';
    const inviterRank = ROLE_RANKS[m.role] ?? -2;
    const targetRoleRank = ROLE_RANKS[targetRole] ?? -2;

    if (targetRoleRank >= inviterRank) {
      return res.status(403).json({ error: 'You cannot invite someone with a role equal to or higher than your own rank.' });
    }

    // Single Principal Check: Only 1 Principal allowed per institution
    if (targetRole === 'PRINCIPAL') {
      const existingPrincipal = await prisma.membership.findFirst({
        where: { orgId, role: 'PRINCIPAL' },
      });
      if (existingPrincipal) {
        return res.status(409).json({ error: 'This institution already has an assigned Principal. An institution can only have one Principal at a time.' });
      }
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Generate Role Prefix & Unique Faculty / User ID
    const prefixMap: Record<string, string> = {
      DIRECTOR: 'DIR',
      PRINCIPAL: 'PRN',
      DEAN: 'DEN',
      HOD: 'HOD',
      TEACHER: 'FAC',
      ACCOUNTANT: 'ACC',
      STUDENT: 'STU',
      PARENT: 'PAR',
    };
    const prefix = prefixMap[targetRole] || 'FAC';
    const uniqueSeq = Math.floor(1000 + Math.random() * 9000);
    const uniqueId = `${prefix}-2026-${uniqueSeq}`;

    // Auto-generate initial password & bcrypt hash
    const generatedPassword = `Convee#${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await hashPassword(generatedPassword);

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });

    if (existingUser) {
      // 1. Check if user is already a member of THIS organization
      const inThisOrg = existingUser.memberships.find((m) => m.orgId === orgId && m.isActive);
      if (inThisOrg) {
        return res.status(409).json({ error: 'This user is already registered with your organization.' });
      }

      // 2. Check if user is already a member of a DIFFERENT organization
      const inOtherOrg = existingUser.memberships.find((m) => m.orgId !== orgId && m.isActive);
      if (inOtherOrg) {
        return res.status(409).json({ error: 'This email is already a part of a different organization.' });
      }
    }

    let user;
    if (!existingUser) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: fullName || email.split('@')[0] || 'User',
          isVerified: true,
          passwordHash,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: fullName || existingUser.fullName,
          passwordHash,
          isVerified: true,
        },
      });
    }

    const existingMembership = existingUser?.memberships?.find((m) => m.orgId === orgId);
    let mem;
    if (existingMembership) {
      mem = await prisma.membership.update({
        where: { id: existingMembership.id },
        data: {
          isActive: true,
          role: targetRole as any,
          title: `${targetRole} [${uniqueId}]`,
          departmentId: departmentId || existingMembership.departmentId,
          teamId: teamId || existingMembership.teamId,
        },
      });
    } else {
      mem = await prisma.membership.create({
        data: {
          userId: user.id,
          orgId,
          role: targetRole as any,
          title: `${targetRole} [${uniqueId}]`,
          departmentId,
          teamId,
          isActive: true,
        },
      });
    }

    // Add to General Channel
    const genChannel = await prisma.channel.findFirst({
      where: { orgId, name: 'general', deletedAt: null },
    });
    if (genChannel) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: genChannel.id, userId: user.id } },
        create: { channelId: genChannel.id, userId: user.id },
        update: {},
      }).catch(() => { });
    }

    // Deliver email credentials
    await sendInviteCredentialsEmail(
      email,
      fullName || user.fullName,
      org.name,
      targetRole,
      uniqueId,
      generatedPassword
    ).catch((err) => console.error('Failed to send invite email:', err));

    res.status(201).json({
      membership: mem,
      user,
      generatedId: uniqueId,
      message: `Member created successfully! Login ID and password sent to ${email}.`,
    });
  } catch (e) { next(e); }
});

// List pending invitations for an org
router.get('/:orgId/pending-invitations', async (req, res, next) => {
  try {
    const orgId = req.params.orgId as string;
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const pending = await prisma.membership.findMany({
      where: { orgId, isActive: false },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        department: true,
        team: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json(pending);
  } catch (e) { next(e); }
});

// Revoke an invitation (deletes membership & deletes unverified user account if placeholder)
router.delete('/:orgId/invitations/:membershipId', async (req, res, next) => {
  try {
    const { orgId, membershipId } = req.params;
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m || !['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(m.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetMem = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: { include: { memberships: true } } },
    });

    if (!targetMem || targetMem.orgId !== orgId) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitedUser = targetMem.user;

    // Delete related notifications
    await prisma.notification.deleteMany({
      where: {
        userId: invitedUser.id,
        orgId,
      },
    }).catch(() => { });

    // Delete membership
    await prisma.membership.delete({
      where: { id: membershipId },
    });

    let userDeleted = false;

    // If user has no password set AND has no other memberships in any organization,
    // delete the user account completely from database!
    if (invitedUser && !invitedUser.passwordHash && invitedUser.memberships.length <= 1) {
      await prisma.user.delete({
        where: { id: invitedUser.id },
      }).catch(() => { });
      userDeleted = true;
    }

    res.json({
      success: true,
      userDeleted,
      message: userDeleted
        ? 'Invitation revoked and account placeholder removed from database.'
        : 'Invitation revoked successfully.',
    });
  } catch (e) { next(e); }
});
// Request workspace ownership transfer (Step 1: Check Target is Admin -> Step 2: Email Verification -> Notify)
router.post('/:orgId/transfer-request', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { targetEmail, verifyEmail } = req.body;

    if (!targetEmail || !verifyEmail) {
      return res.status(400).json({ error: 'Target email and verification email are required' });
    }

    const currentMember = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });

    if (!currentMember || !['OWNER', 'DIRECTOR'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Only the Director or Owner can initiate ownership transfer' });
    }

    // Verify sender email
    if (req.user!.email.toLowerCase() !== verifyEmail.trim().toLowerCase()) {
      return res.status(400).json({ error: 'Sender email verification failed. Re-typed email does not match your logged-in account.' });
    }

    // Find target user by email in this org
    const targetUser = await prisma.user.findFirst({
      where: { email: { equals: targetEmail.trim(), mode: 'insensitive' } },
    });

    if (!targetUser) {
      return res.status(404).json({ error: `No user found with email: ${targetEmail}` });
    }

    const targetMember = await prisma.membership.findFirst({
      where: { userId: targetUser.id, orgId, isActive: true },
    });

    if (!targetMember) {
      return res.status(404).json({ error: `User ${targetUser.email} is not a member of this organization.` });
    }

    // Target must have ADMIN role (or EXECUTIVE ADMIN)
    const isAdminRole = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(targetMember.role);
    if (!isAdminRole) {
      return res.status(400).json({ error: `User ${targetUser.email} has role "${targetMember.role}". Ownership can only be transferred to an ADMIN member.` });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Create Notification for Target Admin with Accept/Reject metadata
    const notification = await prisma.notification.create({
      data: {
        userId: targetUser.id,
        orgId: orgId,
        type: 'SYSTEM' as any,
        title: 'Workspace Ownership Transfer Request',
        body: `${currentMember.user.fullName || currentMember.user.email} (${currentMember.user.email}) has requested to transfer workspace ownership of "${org.name}" to you.`,
        metadata: {
          actionType: 'OWNERSHIP_TRANSFER_REQUEST',
          orgId: orgId,
          orgName: org.name,
          senderUserId: req.user!.id,
          senderName: currentMember.user.fullName || currentMember.user.email,
          senderEmail: currentMember.user.email,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          status: 'PENDING',
        },
      },
    });

    const io = req.app.locals.io;
    if (io) {
      io.emit('notification:new', notification);
    }

    res.json({ ok: true, message: `Ownership transfer request sent to ${targetUser.email}.` });
  } catch (e) { next(e); }
});

// Respond to ownership transfer request (Accept / Reject)
router.post('/:orgId/transfer-respond', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { notificationId, action } = req.body;

    if (!notificationId || !['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Notification ID and valid action (ACCEPT or REJECT) are required' });
    }

    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Notification request not found' });
    }

    const meta: any = notification.metadata || {};
    if (meta.actionType !== 'OWNERSHIP_TRANSFER_REQUEST' || meta.status !== 'PENDING') {
      return res.status(400).json({ error: 'This transfer request has already been processed or is invalid.' });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const responderName = currentUser?.fullName || currentUser?.email || req.user!.email;

    if (action === 'REJECT') {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          metadata: { ...meta, status: 'REJECTED' },
        },
      });

      const rejectNotif = await prisma.notification.create({
        data: {
          userId: meta.senderUserId,
          orgId: orgId,
          type: 'SYSTEM' as any,
          title: 'Ownership Transfer Rejected',
          body: `${responderName} rejected your workspace ownership transfer request.`,
          metadata: { actionType: 'OWNERSHIP_TRANSFER_RESPONSE', status: 'REJECTED' },
        },
      });

      const io = req.app.locals.io;
      if (io) io.emit('notification:new', rejectNotif);

      return res.json({ ok: true, message: 'Transfer request rejected.' });
    }

    // Action === ACCEPT: Execute Ownership & Role Shift
    const targetMember = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId, isActive: true },
    });
    const senderMember = await prisma.membership.findFirst({
      where: { userId: meta.senderUserId, orgId, isActive: true },
    });

    if (!targetMember || !senderMember) {
      return res.status(400).json({ error: 'Unable to locate members for transfer execution' });
    }

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: orgId },
        data: { ownerId: targetMember.userId },
      }),
      prisma.membership.update({
        where: { id: targetMember.id },
        data: { role: 'DIRECTOR' },
      }),
      prisma.membership.update({
        where: { id: senderMember.id },
        data: { role: 'ADMIN' },
      }),
      prisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          metadata: { ...meta, status: 'ACCEPTED' },
        },
      }),
    ]);

    await prisma.notification.createMany({
      data: [
        {
          userId: meta.senderUserId,
          orgId: orgId,
          type: 'SYSTEM' as any,
          title: 'Ownership Transferred',
          body: `${responderName} accepted ownership transfer. You are now assigned to the ADMIN role.`,
          metadata: { actionType: 'OWNERSHIP_TRANSFER_RESPONSE', status: 'ACCEPTED' },
        },
        {
          userId: targetMember.userId,
          orgId: orgId,
          type: 'SYSTEM' as any,
          title: 'You are now the Director',
          body: `You have successfully accepted workspace ownership of "${org.name}". Your role is now DIRECTOR.`,
          metadata: { actionType: 'OWNERSHIP_TRANSFER_RESPONSE', status: 'ACCEPTED' },
        },
      ],
    });

    const io = req.app.locals.io;
    if (io) {
      io.emit('membership:updated', { orgId });
      io.emit('department:updated', { orgId });
    }

    res.json({ ok: true, message: 'Ownership transferred successfully! You are now the Director.' });
  } catch (e) { next(e); }
});

const ROLE_RANKS: Record<string, number> = {
  OWNER: 6,
  DIRECTOR: 6,
  PRINCIPAL: 5,
  DEAN: 4,
  HOD: 4,
  TEACHER: 2,
  ACCOUNTANT: 2,
  STUDENT: 1,
};

// Update member role
router.patch('/:orgId/members/:membershipId', async (req, res, next) => {
  try {
    const currentMember = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!currentMember || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD'].includes(currentMember.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const target = await prisma.membership.findUnique({ where: { id: req.params.membershipId } });
    if (!target) return res.status(404).json({ error: 'Member not found' });

    const { role, departmentId, teamId } = req.body;
    const updateData: any = {};

    // Allow updating departmentId and teamId (e.g. section/class assignment for students or staff)
    if (departmentId !== undefined) {
      updateData.departmentId = (!departmentId || departmentId === 'unassigned') ? null : departmentId;
    }
    if (teamId !== undefined) {
      updateData.teamId = (!teamId || teamId === 'unassigned') ? null : teamId;
      if (updateData.teamId && target.role === 'STUDENT') {
        const teamObj = await prisma.team.findUnique({ where: { id: updateData.teamId } });
        if (teamObj) {
          updateData.title = `Student - ${teamObj.name}`;
        }
      }
    }

    // Role change logic (if role is explicitly changing)
    if (role && role !== target.role) {
      const validRoles = ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. STUDENT, OWNER, or DIRECTOR roles cannot be assigned directly.' });
      }

      // 1. Cannot change own role
      if (target.userId === req.user!.id) {
        return res.status(400).json({ error: 'You cannot change your own role.' });
      }

      // 2. STUDENT role is fixed
      if (target.role === 'STUDENT') {
        return res.status(400).json({ error: 'STUDENT role is fixed and cannot be changed.' });
      }

      // Single Principal Check: Only 1 Principal allowed per institution
      if (role === 'PRINCIPAL') {
        const existingPrincipal = await prisma.membership.findFirst({
          where: { orgId: req.params.orgId, role: 'PRINCIPAL', id: { not: req.params.membershipId } },
        });
        if (existingPrincipal) {
          return res.status(409).json({ error: 'This institution already has an assigned Principal. An institution can only have one Principal at a time.' });
        }
      }

      const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });
      if (target.role === 'OWNER' || target.role === 'DIRECTOR' || target.userId === org?.ownerId) {
        return res.status(400).json({ error: 'Cannot change owner or director role directly.' });
      }

      const callerRank = ROLE_RANKS[currentMember.role] ?? -2;
      const targetCurrentRank = ROLE_RANKS[target.role] ?? -2;
      const newRoleRank = ROLE_RANKS[role] ?? -2;

      // Can only change roles of members strictly below caller's rank
      if (targetCurrentRank >= callerRank) {
        return res.status(403).json({ error: 'You can only modify roles for members below your rank.' });
      }

      // Cannot assign a role equal to or higher than caller's rank
      if (newRoleRank >= callerRank) {
        return res.status(403).json({ error: 'You cannot assign a role equal to or higher than your own rank.' });
      }

      const prefixMap: Record<string, string> = {
        DIRECTOR: 'DIR',
        PRINCIPAL: 'PRN',
        DEAN: 'DEN',
        HOD: 'HOD',
        TEACHER: 'FAC',
        ACCOUNTANT: 'ACC',
        STUDENT: 'STU',
        PARENT: 'PAR',
      };
      const prefix = prefixMap[role] || 'FAC';
      const seqMatch = target.title?.match(/\d{4}/)?.[0] || Math.floor(1000 + Math.random() * 9000);
      updateData.role = role;
      updateData.title = `${role} [${prefix}-2026-${seqMatch}]`;
    }

    const updated = await prisma.membership.update({
      where: { id: req.params.membershipId },
      data: updateData,
      include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true, status: true, lastSeenAt: true } } },
    });

    const io = req.app.locals.io;
    if (io) {
      io.emit('membership:updated', { id: updated.id, userId: updated.userId, orgId: req.params.orgId, role: updated.role, teamId: updated.teamId });
    }

    res.json(updated);
  } catch (e) { next(e); }
});

// Remove member from org
router.delete('/:orgId/members/:membershipId', async (req, res, next) => {
  try {
    const currentMember = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true } });
    if (!currentMember) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const target = await prisma.membership.findUnique({ where: { id: req.params.membershipId } });
    if (!target) {
      return res.json({ ok: true, message: 'Member already removed' });
    }
    if (target.userId === req.user!.id) return res.status(400).json({ error: 'Cannot remove yourself' });

    const org = await prisma.organization.findUnique({ where: { id: req.params.orgId } });
    if (target.role === 'OWNER' || target.userId === org?.ownerId) {
      return res.status(400).json({ error: 'Cannot remove the organization owner' });
    }

    const callerRank = ROLE_RANKS[currentMember.role] ?? -2;
    const targetRank = ROLE_RANKS[target.role] ?? -2;

    if (targetRank >= callerRank) {
      return res.status(403).json({ error: 'You can only remove members with a role below your rank.' });
    }

    const targetUserId = target.userId;

    // If removing a STUDENT, clean up linked parent accounts & links
    if (target.role === 'STUDENT') {
      const parentLinks = await prisma.parentStudentLink.findMany({
        where: { studentUserId: targetUserId, orgId: req.params.orgId },
      });

      const parentUserIds = parentLinks.map((l) => l.parentUserId);

      // Remove parent-student link records
      await prisma.parentStudentLink.deleteMany({
        where: { studentUserId: targetUserId, orgId: req.params.orgId },
      }).catch(() => { });

      // For each parent, if they have no other children linked in the system, remove their membership & user account
      for (const pUserId of parentUserIds) {
        const remainingLinks = await prisma.parentStudentLink.count({ where: { parentUserId: pUserId } });
        if (remainingLinks === 0) {
          const parentMems = await prisma.membership.findMany({ where: { userId: pUserId, orgId: req.params.orgId } });
          for (const pm of parentMems) {
            await prisma.membership.delete({ where: { id: pm.id } }).catch(() => { });
          }

          const parentRemainingMems = await prisma.membership.count({ where: { userId: pUserId } });
          if (parentRemainingMems === 0) {
            await prisma.user.delete({ where: { id: pUserId } }).catch(() => { });
          }
        }
      }
    }

    await prisma.membership.delete({ where: { id: req.params.membershipId } });

    // If user has no other organization memberships, remove User record completely from DB
    const remainingMemberships = await prisma.membership.count({ where: { userId: targetUserId } });
    if (remainingMemberships === 0) {
      await prisma.user.delete({ where: { id: targetUserId } }).catch(() => { });
    }

    res.json({ ok: true, message: 'Member and associated links removed successfully from database' });
  } catch (e) { next(e); }
});

// Helper: Generate secure temp password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const symbols = '!@#$%&*';
  let pass = '';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pass += symbols.charAt(Math.floor(Math.random() * symbols.length));
  pass += Math.floor(Math.random() * 90 + 10);
  return pass;
}

// Helper: Create single student account, membership, channel & project assignments
async function generateStudentAccount({
  orgId,
  fullName,
  admissionNo,
  departmentId,
  teamId,
  departmentName,
  className,
  studentEmail,
  parentEmail,
  parentFullName,
}: {
  orgId: string;
  fullName: string;
  admissionNo: string;
  departmentId?: string;
  teamId?: string;
  departmentName?: string;
  className?: string;
  studentEmail?: string;
  parentEmail?: string;
  parentFullName?: string;
}) {
  const cleanName = fullName.trim();
  const cleanAdm = admissionNo.trim().toUpperCase();

  let finalDeptId = departmentId;
  let finalTeamId = teamId;
  let deptName = departmentName || '';
  let teamName = className || '';

  // 1. Department/Wing Lookup (Exact, Contains, or Synonym)
  if (departmentName && !finalDeptId) {
    const rawDept = departmentName.trim();
    let d = await prisma.department.findFirst({
      where: { orgId, name: { mode: 'insensitive', equals: rawDept } },
    });
    if (!d) {
      d = await prisma.department.findFirst({
        where: { orgId, name: { mode: 'insensitive', contains: rawDept } },
      });
    }
    if (!d) {
      const lowerD = rawDept.toLowerCase();
      let keyword = '';
      if (lowerD.includes('junior') || lowerD.includes('primary')) keyword = 'Primary';
      else if (lowerD.includes('middle')) keyword = 'Middle';
      else if (lowerD.includes('senior') || lowerD.includes('high')) keyword = 'High';
      else if (lowerD.includes('kindergarten') || lowerD.includes('kg')) keyword = 'Kindergarten';

      if (keyword) {
        d = await prisma.department.findFirst({
          where: { orgId, name: { mode: 'insensitive', contains: keyword } },
        });
      }
    }
    if (d) {
      finalDeptId = d.id;
      deptName = d.name;
    }
  }

  // 2. Class/Team Lookup (Exact, Contains, or Grade Number + Section Letter Matching)
  if (className && !finalTeamId) {
    const rawClass = className.trim();
    let t = await prisma.team.findFirst({
      where: { department: { orgId }, name: { mode: 'insensitive', equals: rawClass } },
      include: { department: true },
    });
    if (!t) {
      t = await prisma.team.findFirst({
        where: { department: { orgId }, name: { mode: 'insensitive', contains: rawClass } },
        include: { department: true },
      });
    }
    if (!t) {
      const numMatch = rawClass.match(/\d+/);
      const gradeNum = numMatch ? numMatch[0] : '';
      const secMatch = rawClass.match(/[-_\s]([a-zA-Z])\b/);
      const secLetter = secMatch ? secMatch[1].toUpperCase() : '';

      const allTeams = await prisma.team.findMany({
        where: { department: { orgId } },
        include: { department: true },
      });

      if (gradeNum) {
        t = allTeams.find((team) => {
          const tName = team.name;
          const hasNum = tName.includes(gradeNum);
          const hasSec = secLetter ? tName.toUpperCase().includes(secLetter) : true;
          return hasNum && hasSec;
        }) || allTeams.find((team) => team.name.includes(gradeNum)) || null;
      }
    }

    if (t) {
      finalTeamId = t.id;
      teamName = t.name;
      if (!finalDeptId) {
        finalDeptId = t.departmentId;
        deptName = t.department?.name || '';
      }
    }
  }

  // Fallback: If no class matched, assign to first active class team in department/org
  if (!finalTeamId && finalDeptId) {
    const defaultTeam = await prisma.team.findFirst({ where: { departmentId: finalDeptId } });
    if (defaultTeam) {
      finalTeamId = defaultTeam.id;
      teamName = defaultTeam.name;
    }
  } else if (!finalTeamId && !finalDeptId) {
    const defaultTeam = await prisma.team.findFirst({
      where: { department: { orgId } },
      include: { department: true },
    });
    if (defaultTeam) {
      finalTeamId = defaultTeam.id;
      teamName = defaultTeam.name;
      finalDeptId = defaultTeam.departmentId;
      deptName = defaultTeam.department?.name || '';
    }
  }

  // Check uniqueness of Admission Number within the Organization
  if (cleanAdm) {
    const admSlug = cleanAdm.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingStudent = await prisma.membership.findFirst({
      where: {
        orgId,
        role: 'STUDENT',
        OR: [
          { title: { contains: cleanAdm, mode: 'insensitive' } },
          { user: { email: { contains: `.${admSlug}@`, mode: 'insensitive' } } },
        ],
      },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });

    if (existingStudent) {
      throw new Error(`Admission Number "${cleanAdm}" has already been assigned. Duplicate admission numbers are not allowed.`);
    }
  }

  // Generate Clean Unique Student ID & Parent ID (e.g. STU-2026-001 & PAR-2026-001)
  const currentYear = new Date().getFullYear();
  let admSuffix = cleanAdm ? cleanAdm.replace(/^ADM[-_\s]*/i, '').trim() : '';
  if (admSuffix.startsWith(`${currentYear}-`)) {
    admSuffix = admSuffix.slice(5);
  } else if (admSuffix.startsWith(`${currentYear}`)) {
    admSuffix = admSuffix.slice(4);
  }
  admSuffix = admSuffix.replace(/[^A-Z0-9]/gi, '');
  const randomCode = Math.floor(1000 + Math.random() * 9000);
  if (!admSuffix) admSuffix = String(randomCode);

  const studentId = `STU-${currentYear}-${admSuffix}`;
  const parentId = `PAR-${currentYear}-${admSuffix}`;
  const email = studentId;

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Create or Update User for Student
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        fullName: cleanName,
        passwordHash,
        isVerified: true,
        systemRole: 'USER',
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { fullName: cleanName, passwordHash },
    });
  }

  // Create Membership as STUDENT
  const membership = await prisma.membership.create({
    data: {
      orgId,
      userId: user.id,
      role: 'STUDENT',
      departmentId: finalDeptId || null,
      teamId: finalTeamId || null,
      title: `Student ID: ${studentId}${cleanAdm ? ` | Adm: ${cleanAdm}` : ''}`,
    },
  });

  // ALWAYS create parent user & link with Parent ID
  const pEmailToUse = parentId;
  const pName = parentFullName?.trim() || `Parent of ${cleanName}`;
  const parentTempPassword = generateTempPassword();
  const parentPasswordHash = await hashPassword(parentTempPassword);

  let parentUser = await prisma.user.findUnique({ where: { email: pEmailToUse } });

  if (!parentUser) {
    parentUser = await prisma.user.create({
      data: {
        email: pEmailToUse,
        fullName: pName,
        passwordHash: parentPasswordHash,
        isVerified: true,
        systemRole: 'USER',
      },
    });
  } else {
    await prisma.user.update({
      where: { id: parentUser.id },
      data: { fullName: pName, passwordHash: parentPasswordHash },
    });
  }

  // Create or update parent membership as PARENT
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: parentUser.id, orgId } },
    create: { userId: parentUser.id, orgId, role: 'PARENT', title: `Parent ID: ${parentId}${cleanAdm ? ` | Adm: ${cleanAdm}` : ''}`, isActive: true },
    update: { role: 'PARENT', title: `Parent ID: ${parentId}${cleanAdm ? ` | Adm: ${cleanAdm}` : ''}`, isActive: true },
  });

  // Link Parent & Student
  await prisma.parentStudentLink.upsert({
    where: {
      orgId_parentUserId_studentUserId: {
        orgId,
        parentUserId: parentUser.id,
        studentUserId: user.id,
      },
    },
    create: { orgId, parentUserId: parentUser.id, studentUserId: user.id },
    update: {},
  });

  // Auto-add student to default org channels (#general, #announcements)
  const defaultChannels = await prisma.channel.findMany({
    where: { orgId, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
    select: { id: true },
  });
  for (const dc of defaultChannels) {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: dc.id, userId: user.id } },
      create: { channelId: dc.id, userId: user.id },
      update: {},
    }).catch(() => { });
  }

  // Auto-add student to class team channel if teamName specified
  if (teamName) {
    const chanName = `team-${teamName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const classChannel = await prisma.channel.findFirst({
      where: { orgId, type: 'TEAM', name: { mode: 'insensitive', equals: chanName } },
    });
    if (classChannel) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: classChannel.id, userId: user.id } },
        create: { channelId: classChannel.id, userId: user.id },
        update: {},
      }).catch(() => { });
    }
  }

  // Auto-add student to active class projects if finalTeamId specified
  if (finalTeamId) {
    const classProjects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [{ teamId: finalTeamId }, { teams: { some: { teamId: finalTeamId } } }],
      },
      select: { id: true },
    });
    const projIds = classProjects.map((p) => p.id);
    if (projIds.length > 0) {
      const projChannels = await prisma.channel.findMany({
        where: { orgId, projectId: { in: projIds } },
        select: { id: true },
      });
      for (const pc of projChannels) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: pc.id, userId: user.id } },
          create: { channelId: pc.id, userId: user.id },
          update: {},
        }).catch(() => { });
      }
    }
  }

  return {
    userId: user.id,
    membershipId: membership.id,
    fullName: cleanName,
    admissionNo: cleanAdm || 'N/A',
    studentId,
    email: studentId,
    tempPassword,
    departmentName: deptName || 'General',
    className: teamName || 'Unassigned',
    parentId,
    parent: {
      id: parentUser.id,
      parentId,
      fullName: pName,
      email: parentId,
      tempPassword: parentTempPassword,
    },
    parentEmail: parentId,
    parentPassword: parentTempPassword,
    parentName: pName,
  };
}

// Single Student ID & Account Generator (Admin Only)
router.post('/:orgId/students/generate-single', async (req, res, next) => {
  try {
    const callerMember = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true },
    });
    if (!callerMember || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN'].includes(callerMember.role)) {
      return res.status(403).json({ error: 'Only Admins, Directors, Principals, and Deans can access the Student ID Generator.' });
    }

    const { admissionNo, fullName, departmentId, teamId, departmentName, className, parentFullName } = req.body;
    if (!admissionNo || !admissionNo.trim()) {
      return res.status(400).json({ error: 'Student Admission Number is required.' });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Student Full Name is required.' });
    }

    const studentData = await generateStudentAccount({
      orgId: req.params.orgId,
      fullName,
      admissionNo: admissionNo || '',
      departmentId,
      teamId,
      departmentName,
      className,
      parentFullName,
    });

    const io = req.app.locals.io;
    if (io) {
      io.emit('membership:updated', { orgId: req.params.orgId });
      io.emit('department:updated', { orgId: req.params.orgId });
    }

    res.status(201).json(studentData);
  } catch (e: any) {
    if (e?.message && typeof e.message === 'string') {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

// Mass Student ID & Account Generator (Admin Only - Bulk CSV)
router.post('/:orgId/students/generate-mass', async (req, res, next) => {
  try {
    const callerMember = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId: req.params.orgId, isActive: true },
    });
    if (!callerMember || !['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN'].includes(callerMember.role)) {
      return res.status(403).json({ error: 'Only Admins, Directors, Principals, and Deans can access the Mass Student ID Generator.' });
    }

    const { students = [] } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'No student rows provided for mass generation.' });
    }

    const results: any[] = [];
    for (const row of students) {
      if (!row.fullName || !row.fullName.trim()) continue;
      try {
        const generated = await generateStudentAccount({
          orgId: req.params.orgId,
          fullName: row.fullName,
          admissionNo: row.admissionNo || row.admissionId || '',
          departmentName: row.departmentName || row.wing || '',
          className: row.className || row.section || '',
          parentFullName: row.parentFullName || row.parentName || row.parent_name || '',
        });
        results.push(generated);
      } catch (err) {
        // Skip failed individual rows and continue
      }
    }

    const io = req.app.locals.io;
    if (io) {
      io.emit('membership:updated', { orgId: req.params.orgId });
      io.emit('department:updated', { orgId: req.params.orgId });
    }

    res.status(201).json({ count: results.length, students: results });
  } catch (e) { next(e); }
});

export default router;


import { Router } from 'express';
import axios from 'axios';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

async function callLLM(sessionKey: string, systemPrompt: string, userMessage: string, provider?: string, model?: string) {
  try {
    const resp = await axios.post(`${env.LLM_BRIDGE_URL}/chat`, {
      session_key: sessionKey,
      system_message: systemPrompt,
      user_message: userMessage,
      provider: provider || env.DEFAULT_LLM_PROVIDER,
      model: model || env.DEFAULT_LLM_MODEL,
    }, { timeout: 60000 });
    return { text: resp.data?.text || (typeof resp.data === 'string' ? resp.data : '') };
  } catch (e: any) {
    logger.error('channel callLLM error:', e?.response?.data || e?.message);
    return { text: 'Sorry, I ran into an error reading the class study materials.' };
  }
}

const lastEnsuredMap = new Map<string, number>();

async function ensureTeamAndProjectChannels(orgId: string) {
  const lastRun = lastEnsuredMap.get(orgId) || 0;
  if (Date.now() - lastRun < 600000) return; // 10 minutes cache
  lastEnsuredMap.set(orgId, Date.now());

  try {
    const [teams, projects, existingChannels] = await Promise.all([
      prisma.team.findMany({
        where: { department: { orgId }, deletedAt: null },
        include: { memberships: { where: { isActive: true } } },
      }),
      prisma.project.findMany({
        where: { deletedAt: null, team: { department: { orgId } } },
        include: {
          memberships: { where: { isActive: true } },
          team: { include: { memberships: { where: { isActive: true } } } },
        },
      }),
      prisma.channel.findMany({
        where: { orgId, type: { in: ['TEAM', 'PROJECT'] }, deletedAt: null },
        select: { id: true, name: true, type: true, projectId: true },
      }),
    ]);

    const channelNameMap = new Map(existingChannels.map((c) => [c.name.toLowerCase(), c]));
    const projectChannelMap = new Map(existingChannels.filter((c) => c.projectId).map((c) => [c.projectId, c]));

    for (const t of teams) {
      const chName = `team-${t.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      let ch = channelNameMap.get(chName);

      if (!ch) {
        try {
          const created = await prisma.channel.create({
            data: {
              orgId,
              name: chName,
              description: `Official channel for team ${t.name}`,
              type: 'TEAM',
              createdById: t.managerId || null,
            },
          });
          ch = created;
          channelNameMap.set(chName, created as any);
        } catch (e) {
          continue;
        }
      }

      const uIds = new Set<string>();
      if (t.managerId && t.managerId !== 'unassigned') uIds.add(t.managerId);
      t.memberships.forEach((m) => { if (m.userId) uIds.add(m.userId); });

      const validUsers = await prisma.user.findMany({
        where: { id: { in: Array.from(uIds) } },
        select: { id: true },
      });
      const validUserSet = new Set(validUsers.map((u) => u.id));

      const memberData = Array.from(uIds)
        .filter((uid) => validUserSet.has(uid))
        .map((uid) => ({
          channelId: ch!.id,
          userId: uid,
          isAdmin: uid === t.managerId,
        }));

      if (memberData.length > 0) {
        await prisma.channelMember.createMany({
          data: memberData,
          skipDuplicates: true,
        }).catch(() => {});
      }
    }

    for (const p of projects) {
      let ch = projectChannelMap.get(p.id);

      if (!ch) {
        const chName = `project-${p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        try {
          const created = await prisma.channel.create({
            data: {
              orgId,
              name: chName,
              description: `Official channel for project ${p.name}`,
              type: 'PROJECT',
              projectId: p.id,
            },
          });
          ch = created;
          projectChannelMap.set(p.id, created as any);
        } catch (e) {
          continue;
        }
      }

      const pUserIds = new Set<string>();
      (p.memberships || []).forEach((m) => { if (m.userId) pUserIds.add(m.userId); });
      if (p.team?.managerId && p.team.managerId !== 'unassigned') pUserIds.add(p.team.managerId);
      (p.team?.memberships || []).forEach((tm) => { if (tm.userId) pUserIds.add(tm.userId); });

      const validPUsers = await prisma.user.findMany({
        where: { id: { in: Array.from(pUserIds) } },
        select: { id: true },
      });
      const validPUserSet = new Set(validPUsers.map((u) => u.id));

      const pMemberData = Array.from(pUserIds)
        .filter((uid) => validPUserSet.has(uid))
        .map((uid) => ({
          channelId: ch!.id,
          userId: uid,
        }));

      if (pMemberData.length > 0) {
        await prisma.channelMember.createMany({
          data: pMemberData,
          skipDuplicates: true,
        }).catch(() => {});
      }
    }
  } catch (err) {
    // ignore
  }
}

// List channels the user has access to (org-scoped)
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const membership = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!membership) return res.status(403).json({ error: 'Not a member' });

    // Sync team and project channels asynchronously in background
    ensureTeamAndProjectChannels(orgId).catch(() => {});

    const isOrgAdmin = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'DIRECTOR'].includes(membership.role);
    const isStudent = membership.role === 'STUDENT';

    let channels = await prisma.channel.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: isOrgAdmin
          ? [
              { type: 'PUBLIC' },
              { type: 'ANNOUNCEMENT' },
              { type: 'DEPARTMENT' },
              { type: 'TEAM' },
              { type: 'PROJECT' },
              { members: { some: { userId: req.user!.id } } },
            ]
          : isStudent
          ? [
              { type: 'PUBLIC' },
              { type: 'ANNOUNCEMENT' },
              { members: { some: { userId: req.user!.id } } },
            ]
          : [
              { type: 'PUBLIC' },
              { type: 'ANNOUNCEMENT' },
              { type: 'DEPARTMENT' },
              { members: { some: { userId: req.user!.id } } },
            ],
      },
      include: {
        _count: { select: { members: true, messages: true } },
        members: {
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    if (channels.length === 0) {
      const gen = await prisma.channel.create({ data: { orgId, name: 'general', type: 'PUBLIC', createdById: req.user!.id, description: 'Company-wide announcements' } });
      const rand = await prisma.channel.create({ data: { orgId, name: 'random', type: 'PUBLIC', createdById: req.user!.id, description: 'Non-work chatter' } });
      await prisma.channelMember.createMany({
        data: [
          { channelId: gen.id, userId: req.user!.id, isAdmin: true },
          { channelId: rand.id, userId: req.user!.id, isAdmin: true },
        ],
      });
      await prisma.message.create({ data: { channelId: gen.id, senderId: req.user!.id, content: 'Welcome to the organization! 👋' } });

      channels = await prisma.channel.findMany({
        where: {
          orgId,
          deletedAt: null,
          OR: isOrgAdmin
            ? [
                { type: 'PUBLIC' },
                { type: 'ANNOUNCEMENT' },
                { type: 'DEPARTMENT' },
                { type: 'TEAM' },
                { type: 'PROJECT' },
                { members: { some: { userId: req.user!.id } } },
              ]
            : [
                { type: 'PUBLIC' },
                { type: 'ANNOUNCEMENT' },
                { type: 'DEPARTMENT' },
                { members: { some: { userId: req.user!.id } } },
              ],
        },
        include: {
          _count: { select: { members: true, messages: true } },
          members: {
            include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } },
          },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    }

    const channelsWithUnread: any[] = [];
    for (const c of channels) {
      const myMember = c.members.find((m) => m.userId === req.user!.id);
      const lastReadAt = myMember?.lastReadAt || new Date(0);
      const unreadCount = await prisma.message.count({
        where: {
          channelId: c.id,
          createdAt: { gt: lastReadAt },
          senderId: { not: req.user!.id },
          isDeleted: false,
        },
      });
      channelsWithUnread.push({ ...c, unreadCount });
    }

    res.json(channelsWithUnread);
  } catch (e) { next(e); }
});

export async function canUserAccessChannel(userId: string, channel: { id: string; orgId: string; type: string }) {
  const membership = await prisma.membership.findFirst({ where: { userId, orgId: channel.orgId, isActive: true } });
  if (!membership) return false;
  const isOrgAdmin = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'DIRECTOR'].includes(membership.role);
  if (isOrgAdmin) return true;
  if (['PUBLIC', 'ANNOUNCEMENT', 'DEPARTMENT'].includes(channel.type)) return true;
  const cm = await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId: channel.id, userId } } });
  return !!cm;
}

// Mark channel as read
router.post('/:channelId/read', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const now = new Date();
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId: req.user!.id } },
      create: { channelId, userId: req.user!.id, lastReadAt: now },
      update: { lastReadAt: now },
    });
    res.json({ ok: true, readAt: now });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { orgId, name, description, type, memberIds } = req.body;
    const membership = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!membership) return res.status(403).json({ error: 'Not a member' });
    const channel = await prisma.channel.create({
      data: { orgId, name, description, type: type || 'PUBLIC', createdById: req.user!.id },
    });
    const membersToAdd = new Set<string>([req.user!.id, ...(memberIds || [])]);
    for (const uid of Array.from(membersToAdd)) {
      await prisma.channelMember.create({
        data: { channelId: channel.id, userId: uid, isAdmin: uid === req.user!.id },
      });
    }
    const fullChannel = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
        _count: { select: { messages: true } },
      },
    });
    const io = req.app.locals.io;
    if (io) {
      io.emit('channel:created', fullChannel);
    }
    res.status(201).json(fullChannel);
  } catch (e) { next(e); }
});

// Direct message channel between two users
router.post('/dm', async (req, res, next) => {
  try {
    const { orgId, targetUserId } = req.body;
    if (!orgId || !targetUserId) return res.status(400).json({ error: 'orgId and targetUserId required' });
    if (targetUserId === req.user!.id) return res.status(400).json({ error: 'Cannot DM yourself' });
    const existing = await prisma.channel.findFirst({
      where: {
        orgId,
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: req.user!.id } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
        _count: { select: { messages: true } },
      },
    });
    if (existing) return res.json(existing);
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) return res.status(404).json({ error: 'Target user not found' });
    const channel = await prisma.channel.create({
      data: {
        orgId,
        name: `dm-${req.user!.id.slice(0,4)}-${targetUserId.slice(0,4)}`,
        type: 'DIRECT',
        createdById: req.user!.id,
      },
    });
    await prisma.channelMember.createMany({
      data: [
        { channelId: channel.id, userId: req.user!.id },
        { channelId: channel.id, userId: targetUserId },
      ],
    });
    const fullChannel = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
        _count: { select: { messages: true } },
      },
    });
    const io = req.app.locals.io;
    if (io) {
      io.to(`user:${targetUserId}`).to(`user:${req.user!.id}`).emit('channel:created', fullChannel);
    }
    res.status(201).json(fullChannel);
  } catch (e) { next(e); }
});

router.post('/:channelId/join', async (req, res, next) => {
  try {
    const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: channel.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not an org member' });
    if (channel.type === 'PRIVATE') return res.status(403).json({ error: 'Cannot self-join private channel' });
    const existing = await prisma.channelMember.findUnique({ where: { channelId_userId: { channelId: channel.id, userId: req.user!.id } } });
    if (existing) return res.json(existing);
    const cm = await prisma.channelMember.create({ data: { channelId: channel.id, userId: req.user!.id } });
    res.json(cm);
  } catch (e) { next(e); }
});

router.post('/:channelId/leave', async (req, res, next) => {
  try {
    await prisma.channelMember.deleteMany({ where: { channelId: req.params.channelId, userId: req.user!.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Add member(s) to channel
router.post('/:channelId/members', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const { userId, userIds } = req.body;
    const targetUserIds: string[] = Array.isArray(userIds) && userIds.length > 0 ? userIds : (userId ? [userId] : []);
    if (targetUserIds.length === 0) return res.status(400).json({ error: 'User ID(s) required' });

    for (const uid of targetUserIds) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId, userId: uid } },
        create: { channelId, userId: uid },
        update: {},
      }).catch(() => {});

      if (channel.type === 'TEAM') {
        const teamName = channel.name.replace(/^team-/, '').replace(/-/g, ' ');
        const team = await prisma.team.findFirst({
          where: { department: { orgId: channel.orgId }, name: { mode: 'insensitive', equals: teamName } },
        });
        if (team) {
          await prisma.membership.updateMany({
            where: { userId: uid, orgId: channel.orgId, isActive: true },
            data: { teamId: team.id },
          }).catch(() => {});
        }
      }
    }

    const updatedChannel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
        _count: { select: { messages: true } },
      },
    });

    const io = req.app.locals.io;
    if (io) {
      for (const uid of targetUserIds) {
        io.to(`user:${uid}`).emit('channel:created', updatedChannel);
      }
    }

    res.json(updatedChannel);
  } catch (e) { next(e); }
});

// Remove member from channel
router.delete('/:channelId/members/:targetUserId', async (req, res, next) => {
  try {
    const { channelId, targetUserId } = req.params;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    await prisma.channelMember.deleteMany({
      where: { channelId, userId: targetUserId },
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Delete channel (Owner/Admin or Creator only)
router.delete('/:channelId', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const m = await prisma.membership.findFirst({
      where: { userId: req.user!.id, orgId: channel.orgId, isActive: true },
    });
    if (!m) return res.status(403).json({ error: 'Not an org member' });

    const isOrgAdmin = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'DIRECTOR'].includes(m.role);
    const isCreator = channel.createdById === req.user!.id;

    if (!isOrgAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only Organization Owners/Admins can delete channels' });
    }

    if (channel.type === 'TEAM' || channel.type === 'PROJECT') {
      return res.status(400).json({ error: 'Team and Project channels cannot be deleted as they are linked to teams and projects' });
    }

    await prisma.channel.update({
      where: { id: channelId },
      data: { deletedAt: new Date() },
    });

    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${channel.orgId}`).emit('channel:deleted', { channelId });
    }

    res.json({ ok: true, id: channelId });
  } catch (e) { next(e); }
});

router.get('/:channelId/messages', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const cursor = req.query.cursor as string | undefined;
    const parentId = req.query.parentId as string | undefined;
    const messages = await prisma.message.findMany({
      where: { channelId, isDeleted: false, parentId: parentId || null },
      include: {
        sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        reactions: true,
        _count: { select: { replies: true } },
        attachments: { include: { file: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    res.json(messages.reverse());
  } catch (e) { next(e); }
});

async function processMessageMentions(
  channel: { id: string; orgId: string; name: string },
  message: { id: string; content: string },
  sender: { id: string; fullName: string; email: string } | null | undefined,
  io: any
) {
  if (!sender || !message.content || !message.content.includes('@')) return;

  const content = message.content;
  const taggedUserIds = new Set<string>();
  const notificationsToCreate: Array<{
    userId: string;
    orgId: string;
    type: any;
    title: string;
    body: string;
    linkUrl: string;
    metadata: any;
  }> = [];

  const addNotification = (userId: string, title: string, tagType: string) => {
    if (userId === sender.id || taggedUserIds.has(userId)) return;
    taggedUserIds.add(userId);
    notificationsToCreate.push({
      userId,
      orgId: channel.orgId,
      type: 'MENTION',
      title,
      body: `${sender.fullName}: ${content.slice(0, 120)}`,
      linkUrl: `/app/channels/${channel.id}`,
      metadata: { channelId: channel.id, messageId: message.id, tagType, senderId: sender.id },
    });
  };

  // 1. Tag @all, @channel, @here
  if (/@(all|channel|here)\b/i.test(content)) {
    const channelMembers = await prisma.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    });
    channelMembers.forEach((m) => {
      addNotification(m.userId, `Tagged @all in #${channel.name}`, 'channel');
    });
  }

  // 2. Extract all @mentions from content
  const mentionMatches = content.match(/@([a-zA-Z0-9._-]+)/g);
  if (!mentionMatches || mentionMatches.length === 0) return;

  // Pre-fetch org departments (with teams) and projects
  const [departments, projects, allUsersInOrg] = await Promise.all([
    prisma.department.findMany({
      where: { orgId: channel.orgId, deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: { memberships: { where: { isActive: true }, select: { userId: true } } },
        },
      },
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { team: { department: { orgId: channel.orgId } } },
          { memberships: { some: { orgId: channel.orgId } } },
        ],
      },
      include: {
        memberships: { where: { isActive: true }, select: { userId: true } },
        team: { include: { memberships: { where: { isActive: true }, select: { userId: true } } } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId: channel.orgId, isActive: true },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
  ]);

  const allTeams = departments.flatMap((d) => d.teams);

  for (const rawMatch of mentionMatches) {
    const handle = rawMatch.substring(1).toLowerCase();
    if (['all', 'channel', 'here', 'ai'].includes(handle)) continue;

    // A: Match @team or specific team names e.g. @backend, @frontend, @design, @qa
    if (handle === 'team') {
      allUsersInOrg.forEach((m) => {
        addNotification(m.userId, `Your team was tagged in #${channel.name}`, 'team');
      });
      continue;
    }

    const matchedTeam = allTeams.find((t) => {
      const cleanName = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanName.includes(handle) || handle.includes(cleanName);
    });

    if (matchedTeam) {
      matchedTeam.memberships.forEach((tm) => {
        addNotification(tm.userId, `Team @${matchedTeam.name} was tagged in #${channel.name}`, 'team');
      });
      continue;
    }

    // B: Match @project or specific project names e.g. @v2release, @mobileapp
    if (handle === 'project') {
      const channelMembers = await prisma.channelMember.findMany({
        where: { channelId: channel.id },
        select: { userId: true },
      });
      channelMembers.forEach((cm) => {
        addNotification(cm.userId, `Your project was tagged in #${channel.name}`, 'project');
      });
      continue;
    }

    const matchedProject = projects.find((p) => {
      const cleanName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanName.includes(handle) || handle.includes(cleanName);
    });

    if (matchedProject) {
      const pUserIds = new Set<string>();
      (matchedProject.memberships || []).forEach((m) => pUserIds.add(m.userId));
      (matchedProject.team?.memberships || []).forEach((tm) => pUserIds.add(tm.userId));
      pUserIds.forEach((uid) => {
        addNotification(uid, `Project @${matchedProject.name} was tagged in #${channel.name}`, 'project');
      });
      continue;
    }

    // C: Individual user mentions e.g. @sudhanshu, @priyapatel
    const matchedMember = allUsersInOrg.find((m) => {
      if (!m.user) return false;
      const userFn = m.user.fullName || '';
      const userEm = m.user.email || '';
      const fn = userFn.toLowerCase().replace(/\s+/g, '');
      const fnParts = userFn.toLowerCase().split(' ').filter(Boolean);
      const emHandle = userEm.toLowerCase().split('@')[0] || '';
      return (
        (fn && fn.includes(handle)) ||
        fnParts.some((p) => p === handle) ||
        (emHandle && (emHandle === handle || handle.includes(emHandle)))
      );
    });

    if (matchedMember && matchedMember.user) {
      addNotification(
        matchedMember.user.id,
        `You were tagged by ${sender?.fullName || 'Someone'} in #${channel.name}`,
        'user'
      );
    }
  }

  // Save to DB and push Socket.IO real-time notification
  for (const notifData of notificationsToCreate) {
    try {
      const created = await prisma.notification.create({ data: notifData });
      if (io) {
        io.to(`user:${notifData.userId}`).emit('notification:new', created);
      }
    } catch (err) {
      // ignore individual duplicate error
    }
  }
}

router.post('/:channelId/messages', async (req, res, next) => {
  try {
    const { content, type, parentId, metadata } = req.body;
    const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    if (channel.type === 'ANNOUNCEMENT') {
      const m = await prisma.membership.findFirst({
        where: { userId: req.user!.id, orgId: channel.orgId, isActive: true },
      });
      const isOrgAdmin = m && ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'DIRECTOR'].includes(m.role);
      const isTeamManager = await prisma.team.findFirst({
        where: { managerId: req.user!.id, department: { orgId: channel.orgId } },
      });
      if (!isOrgAdmin && !isTeamManager) {
        return res.status(403).json({ error: 'Only Owners, Admins, Principals, Deans, and HODs can post in Announcement channels' });
      }
    }

    // AI Moderation Safety Filter: Block inappropriate content before posting
    const INAPPROPRIATE_PATTERN = /\b(fuck|bitch|bastard|asshole|dick|pussy|shit|cunt|whore|slut|nigger|faggot|kys|stfu)\b/i;
    if (content && INAPPROPRIATE_PATTERN.test(content)) {
      return res.status(400).json({ error: 'Message blocked by AI Moderation: Contains inappropriate content.' });
    }

    const msg = await prisma.message.create({
      data: {
        channelId: channel.id,
        senderId: req.user!.id,
        content,
        type: type || 'TEXT',
        parentId,
        metadata,
      },
      include: { sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });
    // Broadcast message via socket.io to channel room
    const io = req.app.locals.io;
    if (io) {
      io.to(`channel:${channel.id}`).emit('message:new', msg);
    }

    // Process mentions & notify tagged users/teams/projects
    processMessageMentions(channel, msg, msg.sender, io).catch(() => {});

    // Per-class study material AI assistant trigger (@AI tag)
    if (content && (/@ai\b/i.test(content))) {
      (async () => {
        try {
          const promptText = content.replace(/@ai\b/gi, '').trim() || 'Hello! How can you help me with this class?';

          const orgFiles = await prisma.fileAsset.findMany({
            where: { orgId: channel.orgId },
            include: { uploader: { select: { fullName: true } } },
            take: 30,
          });

          const classFiles = orgFiles.filter((f) => (f.metadata as any)?.channelId === channel.id);

          const studyMaterialsSummary = classFiles.length
            ? classFiles
                .map((f) => {
                  const text = (f.metadata as any)?.textContent || '';
                  return `• Study Material: "${f.originalName}" (Uploaded by ${f.uploader?.fullName || 'Teacher'})
  ${text ? `  Content Preview:\n${text.slice(0, 4000)}` : '  (Document/Media file uploaded for this class)'}`;
                })
                .join('\n\n')
            : 'No class study materials uploaded yet.';

          const systemPrompt = `You are an AI Subject & Class Assistant for the channel #${channel.name}.

CLASS STUDY MATERIALS & DOCUMENTS UPLOADED FOR #${channel.name}:
${studyMaterialsSummary}

YOUR MISSION:
1. Answer student and teacher questions directly using the class study materials listed above whenever applicable.
2. If your answer uses information from the uploaded class study materials, YOU MUST append a citation tag at the very end of your response in this exact format:
   [Source Document: Filename]
3. Write cleanly without using raw Markdown header symbols like ### or ##. Use bold text, bullet points, or numbered lists for readability.
4. Be professional, step-by-step, encouraging, and clear.`;

          const aiResp = await callLLM(`channel-${channel.id}`, systemPrompt, promptText);

          if (aiResp?.text) {
            const aiMsg = await prisma.message.create({
              data: {
                channelId: channel.id,
                senderId: req.user!.id,
                content: aiResp.text,
                type: 'AI',
                parentId: parentId || null,
              },
              include: { sender: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
            });

            if (io) {
              io.to(`channel:${channel.id}`).emit('message:new', aiMsg);
            }
          }
        } catch (err) {
          logger.error('Channel AI response error:', err);
        }
      })();
    }

    res.status(201).json(msg);
  } catch (e) { next(e); }
});

router.post('/:channelId/messages/:messageId/react', async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const existing = await prisma.reaction.findUnique({
      where: { messageId_userId_emoji: { messageId: req.params.messageId, userId: req.user!.id, emoji } },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      const io = req.app.locals.io;
      if (io) {
        io.to(`channel:${channelId}`).emit('reaction:removed', { messageId: req.params.messageId, userId: req.user!.id, emoji });
      }
      return res.json({ ok: true, removed: true });
    }
    const r = await prisma.reaction.create({
      data: { messageId: req.params.messageId, userId: req.user!.id, emoji },
    });
    const io = req.app.locals.io;
    if (io) {
      io.to(`channel:${channelId}`).emit('reaction:added', r);
    }
    res.json(r);
  } catch (e) { next(e); }
});

router.patch('/:channelId/messages/:messageId', async (req, res, next) => {
  try {
    const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.senderId !== req.user!.id) return res.status(403).json({ error: 'Not your message' });
    const updated = await prisma.message.update({
      where: { id: msg.id },
      data: { content: req.body.content, isEdited: true },
    });
    const io = req.app.locals.io;
    if (io) {
      io.to(`channel:${msg.channelId}`).emit('message:updated', updated);
    }
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:channelId/messages/:messageId', async (req, res, next) => {
  try {
    const msg = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: { sender: { include: { memberships: true } } },
    });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
    const currentMember = channel
      ? await prisma.membership.findFirst({
          where: { userId: req.user!.id, orgId: channel.orgId, isActive: true },
        })
      : null;

    const isSender = msg.senderId === req.user!.id;
    const isAI = msg.type === 'AI' || msg.sender?.email === 'ai@system';
    const senderRole = msg.sender?.memberships?.find((m) => m.orgId === channel?.orgId)?.role;
    const isStudentMsg = senderRole === 'STUDENT' || !senderRole;
    const isFaculty = currentMember && ['DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentMember.role);

    const canDelete =
      isSender ||
      (isFaculty && (isStudentMsg || isAI || currentMember.role === 'DIRECTOR' || currentMember.role === 'PRINCIPAL'));

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
    }

    const updated = await prisma.message.update({ where: { id: msg.id }, data: { isDeleted: true, content: '[deleted]' } });
    const io = req.app.locals.io;
    if (io) {
      io.to(`channel:${msg.channelId}`).emit('message:deleted', { id: msg.id });
    }
    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/:channelId/messages/:messageId/pin', async (req, res, next) => {
  try {
    const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const pin = await prisma.pinnedMessage.upsert({
      where: { messageId: msg.id },
      create: { messageId: msg.id, channelId: msg.channelId, pinnedById: req.user!.id },
      update: { pinnedById: req.user!.id, pinnedAt: new Date() },
    });
    res.json(pin);
  } catch (e) { next(e); }
});

router.get('/:channelId/pinned', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const pins = await prisma.pinnedMessage.findMany({
      where: { channelId },
      include: { message: { include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } } } },
      orderBy: { pinnedAt: 'desc' },
    });
    res.json(pins);
  } catch (e) { next(e); }
});

// Search messages (Postgres ILIKE for MVP)
router.get('/:channelId/search', async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const q = (req.query.q as string) || '';
    const results = await prisma.message.findMany({
      where: {
        channelId,
        isDeleted: false,
        content: { contains: q, mode: 'insensitive' },
      },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(results);
  } catch (e) { next(e); }
});

router.get('/:channelId', async (req, res, next) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.channelId },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true, status: true } } } },
        _count: { select: { messages: true } },
      },
    });
    if (!channel) return res.status(404).json({ error: 'Not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    res.json(channel);
  } catch (e) { next(e); }
});

export default router;

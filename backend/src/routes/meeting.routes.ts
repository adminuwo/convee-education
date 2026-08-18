import { Router } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import axios from 'axios';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const orgId = req.query.orgId as string;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const meetings = await prisma.meeting.findMany({
      where: {
        orgId,
        OR: [
          { createdById: req.user!.id },
          { attendees: { some: { userId: req.user!.id } } },
        ],
      },
      include: {
        attendees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true, email: true } } } },
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 100,
    });

    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const filtered = meetings.filter((m) => {
      if (m.status === 'CANCELLED') {
        const cancelledTime = m.updatedAt ? new Date(m.updatedAt) : new Date(m.startTime);
        return cancelledTime >= oneHourAgo;
      }
      const end = m.endTime ? new Date(m.endTime) : new Date(m.startTime);
      return end >= oneDayAgo;
    });

    res.json(filtered);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { orgId, title, description, startTime, endTime, location, meetingUrl, attendeeIds = [], departmentIds = [], teamIds = [], agenda } = req.body;
    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    if (m.role === 'STUDENT') {
      return res.status(403).json({ error: 'Students are not authorized to create meetings. Only faculty and administration can schedule meetings.' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();
    const nowWithBuffer = new Date(now.getTime() - 60000); // 1-min clock skew buffer

    if (start < nowWithBuffer) {
      return res.status(400).json({ error: 'Meeting start time cannot be in the past. Please select a future date and time.' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'Meeting end time must be after the start time.' });
    }

    // Resolve user IDs belonging to selected departments and class sections (teams)
    let groupUserIds: string[] = [];
    if ((Array.isArray(departmentIds) && departmentIds.length > 0) || (Array.isArray(teamIds) && teamIds.length > 0)) {
      const groupMemberships = await prisma.membership.findMany({
        where: {
          orgId,
          isActive: true,
          OR: [
            ...(departmentIds.length > 0 ? [{ departmentId: { in: departmentIds } }] : []),
            ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
          ],
        },
        select: { userId: true },
      });
      groupUserIds = groupMemberships.map((gm) => gm.userId);
    }

    // Combine individual faculty, department members, class section members, and meeting creator
    const uniqueAttendees = Array.from(new Set([...attendeeIds, ...groupUserIds, req.user!.id]));

    const meeting = await prisma.meeting.create({
      data: {
        orgId,
        createdById: req.user!.id,
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        meetingUrl,
        agenda,
        attendees: {
          create: uniqueAttendees.map((id: string) => ({ userId: id })),
        },
      },
      include: { attendees: { include: { user: true } } },
    });
    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${orgId}`).emit('meeting:updated', { meetingId: meeting.id, type: 'CREATED' });
    }
    for (const a of meeting.attendees) {
      if (a.userId !== req.user!.id) {
        await prisma.notification.create({
          data: { userId: a.userId, orgId, type: 'MEETING_INVITE', title: 'Meeting invitation', body: title, linkUrl: `/app/meetings?meetingId=${meeting.id}`, metadata: { meetingId: meeting.id } },
        });
        if (io) io.to(`user:${a.userId}`).emit('notification:new', { type: 'MEETING_INVITE', meetingId: meeting.id, title });
      }
    }
    res.status(201).json(meeting);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        attendees: { include: { user: true } },
        createdBy: true,
        attachments: { include: { file: true } },
      },
    });
    if (!meeting) return res.status(404).json({ error: 'Not found' });

    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: meeting.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const isAttendeeOrCreator = meeting.createdById === req.user!.id || meeting.attendees.some(a => a.userId === req.user!.id);

    if (!isAttendeeOrCreator) {
      return res.status(403).json({ error: 'Access denied. You are not an attendee of this meeting.' });
    }

    res.json(meeting);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: { attendees: true },
    });
    if (!existing) return res.status(404).json({ error: 'Meeting not found' });

    const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, orgId: existing.orgId, isActive: true } });
    if (!m) return res.status(403).json({ error: 'Not a member' });

    const isOrganizer = existing.createdById === req.user!.id || ['OWNER', 'ADMIN'].includes(m.role);

    const { title, description, notes, status, agenda, startTime, endTime } = req.body;

    // Reschedule or Cancel attempt requires organizer permissions
    const isRescheduling = startTime !== undefined || endTime !== undefined;
    const isCancelling = status === 'CANCELLED';

    if ((isRescheduling || isCancelling) && !isOrganizer) {
      return res.status(403).json({ error: 'Only the meeting organizer or an admin can reschedule or cancel this meeting.' });
    }

    const updated = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(agenda !== undefined ? { agenda } : {}),
        ...(startTime !== undefined ? { startTime: new Date(startTime) } : {}),
        ...(endTime !== undefined ? { endTime: new Date(endTime) } : {}),
      },
      include: { attendees: { include: { user: true } }, createdBy: true },
    });

    // Send notifications to attendees if meeting was cancelled or rescheduled
    if (isCancelling || isRescheduling) {
      const notifType = isCancelling ? 'MEETING_CANCELLED' : 'MEETING_RESCHEDULED';
      const notifTitle = isCancelling ? '❌ Meeting Cancelled' : '📅 Meeting Rescheduled';
      const notifBody = isCancelling
        ? `The meeting "${updated.title}" was cancelled by the organizer.`
        : `The meeting "${updated.title}" was rescheduled.`;

      for (const a of updated.attendees) {
        if (a.userId !== req.user!.id) {
          await prisma.notification.create({
            data: {
              userId: a.userId,
              orgId: updated.orgId,
              type: 'MEETING_INVITE',
              title: notifTitle,
              body: notifBody,
              linkUrl: `/app/meetings?meetingId=${updated.id}`,
              metadata: { meetingId: updated.id, action: notifType },
            },
          }).catch(() => {});

          const io = req.app.locals.io;
          if (io) {
            io.to(`user:${a.userId}`).emit('notification:new', {
              type: notifType,
              meetingId: updated.id,
              title: notifTitle,
              body: notifBody,
            });
          }
        }
      }
    }

    const io = req.app.locals.io;
    if (io) {
      io.to(`org:${updated.orgId}`).emit('meeting:updated', { meetingId: updated.id, type: 'UPDATED' });
    }

    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/:id/summarize', async (req, res, next) => {
  try {
    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) return res.status(404).json({ error: 'Not found' });

    const hasNotes = meeting.notes && meeting.notes.trim().length >= 5;
    const hasAgenda = meeting.agenda && meeting.agenda.trim().length >= 5;

    if (!hasNotes && !hasAgenda) {
      const emptyNotice = 'No meeting notes or agenda were provided for this meeting. Please type meeting notes above, click "Save notes", and try AI summarize again.';
      await prisma.meeting.update({ where: { id: meeting.id }, data: { aiSummary: emptyNotice } });
      return res.json({ summary: emptyNotice });
    }

    const content = `Meeting Title: ${meeting.title}\n\nAgenda:\n${meeting.agenda || 'None'}\n\nMeeting Notes:\n${meeting.notes || 'None'}`;
    const sys = 'You are an AI executive assistant. Summarize the meeting based ONLY on the provided meeting notes and agenda. If the notes are sparse, keep the summary brief. Do NOT fabricate or make up details not present in the notes. Format in clean markdown with sections: 1) Summary, 2) Key Decisions, 3) Action Items.';

    const resp = await axios.post(`${env.LLM_BRIDGE_URL}/chat`, {
      session_key: `meeting-${meeting.id}-${Date.now()}`,
      system_message: sys,
      user_message: content,
      provider: env.FACULTY_LLM_PROVIDER || 'openai',
      model: env.FACULTY_LLM_MODEL || 'gpt-4o-mini',
    }, { timeout: 60000 });

    const summary = resp.data.text;
    await prisma.meeting.update({ where: { id: meeting.id }, data: { aiSummary: summary } });
    res.json({ summary });
  } catch (e) { next(e); }
});

export default router;

import { Router } from 'express';
import axios from 'axios';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import { logger } from '../utils/logger';

import { canUserAccessChannel } from './channel.routes';

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
    logger.error('callLLM error:', e?.response?.data || e?.message);
    throw e;
  }
}

router.post('/chat', async (req, res, next) => {
  try {
    const { message, sessionKey, systemPrompt, provider, model } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const key = sessionKey || `user-${req.user!.id}-default`;
    let convo = await prisma.aIConversation.findFirst({ where: { sessionKey: key } }).catch(() => null);
    if (!convo) {
      convo = await prisma.aIConversation.create({
        data: { userId: req.user!.id, sessionKey: key, title: 'New Conversation' },
      }).catch(async () => {
        return (await prisma.aIConversation.findFirst({ where: { sessionKey: key } }).catch(() => null)) as any;
      });
    }
    if (convo) {
      await prisma.aIMessage.create({ data: { conversationId: convo.id, role: 'user', content: message } }).catch(() => {});
    }

    // Fetch full user profile for name
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const studentName = currentUser?.fullName || req.user!.email || 'Student';

    // Fetch user membership & role for personalized context
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user!.id, isActive: true },
      include: { department: true, team: true },
    });

    let sys = systemPrompt;

    if (!sys) {
      if (membership?.role === 'STUDENT') {
        // Fetch active tasks/homework for student
        const userTasks = await prisma.task.findMany({
          where: {
            OR: [
              { assignees: { some: { userId: req.user!.id } } },
              { createdById: req.user!.id },
            ],
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { dueDate: 'asc' },
          take: 15,
        });

        // Fetch active projects for student's class
        const userProjects = await prisma.project.findMany({
          where: {
            deletedAt: null,
            ...(membership.teamId
              ? { OR: [{ teamId: membership.teamId }, { teams: { some: { teamId: membership.teamId } } }] }
              : {}),
          },
          select: { name: true, description: true },
          take: 10,
        });

        // Fetch recent announcements for student's org
        const recentAnnouncements = membership?.orgId ? await prisma.message.findMany({
          where: {
            channel: { orgId: membership.orgId, type: { in: ['ANNOUNCEMENT', 'PUBLIC'] }, deletedAt: null },
            isDeleted: false,
          },
          include: { sender: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }) : [];

        const className = membership.team?.name || 'Class Section';
        const wingName = membership.department?.name || 'School Wing';

        const taskSummary = userTasks.length
          ? userTasks.map(t => `- Task: "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}`).join('\n')
          : 'No pending homework tasks currently recorded.';

        const projectSummary = userProjects.length
          ? userProjects.map(p => `- Project: "${p.name}" (${p.description || 'No description'})`).join('\n')
          : 'No active class projects currently recorded.';

        const announcementSummary = recentAnnouncements.length
          ? recentAnnouncements.map(m => `- [${new Date(m.createdAt).toLocaleDateString()}] ${m.sender?.fullName || 'School Admin'}: "${m.content}"`).join('\n')
          : 'No recent announcements posted.';

              } else if (membership?.role === 'PARENT' || req.user!.email?.includes('parent')) {
        const parentName = currentUser?.fullName || req.user!.email || 'Parent / Guardian';

        // Fetch linked children for this parent
        const links = await prisma.parentStudentLink.findMany({
          where: { parentUserId: req.user!.id },
        });

        const studentUserIds = Array.from(new Set(links.map((l) => l.studentUserId)));

        // If no direct link, fallback to finding any student in org for demo/test mode
        let studentMemberships = await prisma.membership.findMany({
          where: {
            userId: { in: studentUserIds },
            ...(membership?.orgId ? { orgId: membership.orgId } : {}),
          },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            team: { select: { id: true, name: true, managerId: true } },
            department: { select: { id: true, name: true, headId: true } },
          },
        });

        if (studentMemberships.length === 0 && membership?.orgId) {
          studentMemberships = await prisma.membership.findMany({
            where: { orgId: membership.orgId, role: 'STUDENT', isActive: true },
            take: 1,
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              team: { select: { id: true, name: true, managerId: true } },
              department: { select: { id: true, name: true, headId: true } },
            },
          });
        }

        let childrenDetailsSummary = 'No linked student accounts found.';
        let facultyContactsSummary = 'No faculty contact details found.';
        let homeworkDetailsSummary = 'No homework records available.';
        let attendanceSummaryText = 'No attendance logs recorded.';

        if (studentMemberships.length > 0) {
          const firstStudent = studentMemberships[0];
          const studentId = firstStudent.userId;
          const studentFullName = firstStudent.user?.fullName || 'Student';

          // Class Teacher
          let classTeacherUser: any = null;
          if (firstStudent.team?.managerId) {
            classTeacherUser = await prisma.user.findUnique({
              where: { id: firstStudent.team.managerId },
              select: { id: true, fullName: true, email: true },
            });
          }

          // HOD (Head of Department)
          let hodUser: any = null;
          if (firstStudent.department?.headId) {
            hodUser = await prisma.user.findUnique({
              where: { id: firstStudent.department.headId },
              select: { id: true, fullName: true, email: true },
            });
          }
          if (!hodUser && firstStudent.departmentId) {
            const hodMem = await prisma.membership.findFirst({
              where: { departmentId: firstStudent.departmentId, role: { in: ['HOD', 'DEAN'] }, isActive: true },
              include: { user: { select: { id: true, fullName: true, email: true } } },
            });
            if (hodMem?.user) hodUser = hodMem.user;
          }

          // Attendance stats (past 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const attRecords = await prisma.attendanceRecord.findMany({
            where: { studentId, date: { gte: thirtyDaysAgo } },
          });
          const totalAtt = attRecords.length;
          const presentAtt = attRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED').length;
          const attPercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

          // Homework & Submissions
          const tasks = await prisma.task.findMany({
            where: { deletedAt: null, assignees: { some: { userId: studentId } } },
            include: { createdBy: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' },
            take: 15,
          });

          const submissions = await prisma.homeworkSubmission.findMany({
            where: { studentId },
          });
          const subMap = new Map(submissions.map((s) => [s.taskId, s]));

          childrenDetailsSummary = `- Student Name: ${studentFullName}
- Class / Section: ${firstStudent.team?.name || 'Class Section'}
- School Wing / Department: ${firstStudent.department?.name || 'School Wing'}`;

          attendanceSummaryText = `- Attendance Rate: ${attPercentage}% (${presentAtt}/${totalAtt} classes present in last 30 days)
- Attendance Status: ${attPercentage < 75 ? '⚠️ WARNING: Low Attendance (< 75%)' : '✅ Good Standing'}`;

          facultyContactsSummary = `- Class Teacher: ${classTeacherUser ? `${classTeacherUser.fullName} (ID: ${classTeacherUser.id}, Email: ${classTeacherUser.email})` : 'Unassigned'}
- Head of Department (HOD): ${hodUser ? `${hodUser.fullName} (ID: ${hodUser.id}, Email: ${hodUser.email})` : 'Unassigned'}`;

          homeworkDetailsSummary = tasks.length
            ? tasks.map((t) => {
                const sub = subMap.get(t.id);
                const gradeStr = sub?.gradeScore !== undefined && sub?.gradeScore !== null ? `${sub.gradeScore}/${sub.gradeMax || 100}` : 'Not graded yet';
                const feedbackStr = sub?.feedbackNotes ? `Feedback: "${sub.feedbackNotes}"` : 'No teacher feedback notes yet';
                return `- Assignment: "${t.title}" | Status: ${t.status} | Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'} | Grade: ${gradeStr} | ${feedbackStr}`;
              }).join('\n')
            : 'No homework tasks currently logged.';
        }

        sys = `You are an AI Parent Academic Assistant for ${parentName}.

STUDENT ACADEMIC & PROGRESS PROFILE:
${childrenDetailsSummary}

ATTENDANCE SUMMARY:
${attendanceSummaryText}

HOMEWORK ASSIGNMENTS, GRADES & FEEDBACK:
${homeworkDetailsSummary}

FACULTY CONTACTS:
${facultyContactsSummary}

YOUR MISSION & CAPABILITIES:
1. CHILD PROGRESS & HOMEWORK MONITORING:
   - Provide clear, supportive updates on the student's attendance, completed/pending homework, grades, and teacher feedback.
   - Reassure and guide the parent on areas where the student is excelling or needs extra attention.

2. HOMEWORK HELP & PARENT GUIDANCE:
   - When the parent asks for help explaining a homework assignment or topic to their child, break down concepts into clear, simple, step-by-step explanations so the parent can comfortably guide their student.

3. CONTACTING CLASS TEACHER & HOD (HEAD OF DEPARTMENT):
   - When the parent asks to contact, write to, or message their child's Class Teacher or Head of Department (HOD), draft a polite, professional, and clear message.
   - AT THE END OF YOUR RESPONSE, always include a JSON action block so the user interface can display a 1-click "Send Message to Teacher / HOD" button:
   \`\`\`json
   {
     "action": "contact_faculty",
     "recipientId": "[Class Teacher or HOD User ID]",
     "recipientName": "[Class Teacher or HOD Full Name]",
     "recipientRole": "Class Teacher" or "Head of Department (HOD)",
     "draftMessage": "[Exact draft message to send]"
   }
   \`\`\`
   - If the teacher or HOD ID is not explicitly available, use "class_teacher" or "hod" as recipientId fallback.`;
      } else {
        const staffName = currentUser?.fullName || req.user!.email || 'Staff Member';
        const roleName = membership?.role || 'Staff';
        const orgId = membership?.orgId;

        // Fetch class sections and departments in scope
        let scopedTeams: any[] = [];
        let departmentName = membership?.department?.name || '';
        let teamName = membership?.team?.name || '';

        if (orgId) {
          if (['DIRECTOR', 'PRINCIPAL', 'ADMIN'].includes(roleName)) {
            scopedTeams = await prisma.team.findMany({
              where: { deletedAt: null, department: { orgId } },
              include: { department: { select: { name: true } } },
            });
          } else if (['DEAN', 'HOD'].includes(roleName) && membership?.departmentId) {
            scopedTeams = await prisma.team.findMany({
              where: { deletedAt: null, departmentId: membership.departmentId },
              include: { department: { select: { name: true } } },
            });
          } else {
            // Teacher: Teams managed by teacher or assigned to teacher
            scopedTeams = await prisma.team.findMany({
              where: {
                deletedAt: null,
                department: { orgId },
                OR: [
                  { managerId: req.user!.id },
                  { memberships: { some: { userId: req.user!.id } } },
                ],
              },
              include: { department: { select: { name: true } } },
            });
          }
        }

        const classSectionsSummary = scopedTeams.length
          ? scopedTeams.map((t) => `- Class: "${t.name}" (${t.department?.name || 'Wing'}) | ID: ${t.id}`).join('\n')
          : 'No specific class sections assigned.';

        // Fetch all active & recent homework assignments in org
        const homeworkTasks = orgId
          ? await prisma.task.findMany({
              where: {
                orgId,
                deletedAt: null,
              },
              include: {
                assignees: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true } },
                  },
                },
                createdBy: { select: { id: true, fullName: true } },
                checklist: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 25,
            })
          : [];

        const homeworkOnly = homeworkTasks.filter((t) => Boolean((t.metadata as any)?.isHomework));

        const homeworkSubmissionSummary = homeworkOnly.length
          ? homeworkOnly
              .map((t) => {
                const targetClasses = (t.metadata as any)?.targetClassNames?.join(', ') || 'Class Section';
                const totalStudents = t.assignees.length;

                const submittedStudents = t.assignees.filter((a) => t.status === 'REVIEW' || t.status === 'COMPLETED' || (a as any).status === 'SUBMITTED' || (a as any).status === 'COMPLETED');
                const pendingStudents = t.assignees.filter((a) => !submittedStudents.includes(a));

                const submittedNames = submittedStudents.map((a) => a.user?.fullName || a.user?.email || 'Student').join(', ');
                const pendingNames = pendingStudents.map((a) => a.user?.fullName || a.user?.email || 'Student').join(', ');

                const percent = totalStudents > 0 ? Math.round((submittedStudents.length / totalStudents) * 100) : 0;

                return `• Homework Title: "${t.title}"
  - Target Classes: ${targetClasses}
  - Overall Status: ${t.status} | Due Date: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'}
  - Submission Progress: ${submittedStudents.length} of ${totalStudents} Students Submitted (${percent}%)
  - SUBMITTED STUDENTS: ${submittedNames || 'None yet'}
  - NOT SUBMITTED / PENDING STUDENTS: ${pendingNames || 'None (All submitted!)'}`;
              })
              .join('\n\n')
          : 'No homework assignments recorded yet.';

        sys = `You are an AI Academic & Homework Management Assistant for ${staffName} (${roleName}).

INSTITUTIONAL SCOPE & CONTEXT:
- Staff Name: ${staffName}
- Academic Role: ${roleName}
- School Wing / Department: ${departmentName || 'N/A'}
- Assigned Class / Section: ${teamName || 'N/A'}

CLASS SECTIONS IN YOUR SCOPE:
${classSectionsSummary}

ACTIVE & RECENT HOMEWORK ASSIGNMENTS WITH STUDENT SUBMISSION STATUSES:
${homeworkSubmissionSummary}

YOUR MISSION & CAPABILITIES:
1. HOMEWORK SUBMISSION STATUS TRACKING:
   - When asked "Who submitted homework?", "Who has not submitted?", "Check homework submissions", or "Submission report", consult the HOMEWORK SUBMISSION STATUSES listed above.
   - Clearly list student names under "Submitted" vs "Not Submitted / Pending".
   - Provide exact numbers and submission percentages.

2. CREATING HOMEWORK ASSIGNMENTS FOR CLASSES & DEPARTMENTS:
   - When asked to create, draft, or assign homework for a class section or department, generate a comprehensive homework assignment proposal.
   - Include: Title, Clear Instructions, Priority, Suggested Due Date, Target Class Section, and Checklist Items.
   - AT THE END OF YOUR RESPONSE, always include a JSON action block in the exact format below so the interface renders a 1-click "Assign Homework Now" button for the teacher:
   \`\`\`json
   {
     "action": "create_homework",
     "title": "[Homework Title]",
     "description": "[Detailed Instructions]",
     "priority": "HIGH",
     "dueDate": "[YYYY-MM-DD]",
     "targetClassTeamIds": ["${scopedTeams[0]?.id || ''}"],
     "targetClassNames": ["${scopedTeams[0]?.name || 'Grade 10 - Sec A'}"],
     "checklist": ["Item 1", "Item 2"]
   }
   \`\`\`

3. GENERAL ACADEMIC & ADMINISTRATIVE SUPPORT:
   - Assist with lesson plans, department updates, student progress tracking, and administrative workflows. Keep responses professional, clear, and actionable.`;
      }
    }

    const { text } = await callLLM(key, sys, message, provider, model);

    let finalTitle = convo?.title;
    if (convo) {
      await prisma.aIMessage.create({ data: { conversationId: convo.id, role: 'assistant', content: text || '' } }).catch(() => {});

      // Auto-title conversation if untitled
      if (!convo.title || convo.title === 'New Conversation' || convo.title === 'Untitled' || convo.title === 'Conversation') {
        finalTitle = message.length > 30 ? message.slice(0, 30) + '…' : message;
        await prisma.aIConversation.update({
          where: { id: convo.id },
          data: { title: finalTitle, updatedAt: new Date() },
        }).catch(() => {});
      } else {
        await prisma.aIConversation.update({
          where: { id: convo.id },
          data: { updatedAt: new Date() },
        }).catch(() => {});
      }
    }

    res.json({ response: text || '', sessionKey: key, title: finalTitle });
  } catch (e: any) {
    logger.error('AI chat error:', e?.response?.data || e?.message);
    next(e);
  }
});

// Create new chat session
router.post('/conversations', async (req, res, next) => {
  try {
    const { title } = req.body;
    const sessionKey = `ai-${req.user!.id}-${Date.now()}`;
    const convo = await prisma.aIConversation.create({
      data: {
        userId: req.user!.id,
        sessionKey,
        title: title || 'New Conversation',
      },
    });
    res.json(convo);
  } catch (e) { next(e); }
});

router.get('/conversations', async (req, res, next) => {
  try {
    const convos = await prisma.aIConversation.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json(convos);
  } catch (e) { next(e); }
});

router.get('/conversations/:sessionKey/messages', async (req, res, next) => {
  try {
    const convo = await prisma.aIConversation.findFirst({
      where: { sessionKey: req.params.sessionKey, userId: req.user!.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo) return res.json({ messages: [] });
    res.json({ messages: convo.messages });
  } catch (e) { next(e); }
});

// Delete chat session
router.delete('/conversations/:sessionKey', async (req, res, next) => {
  try {
    await prisma.aIConversation.deleteMany({
      where: { sessionKey: req.params.sessionKey, userId: req.user!.id },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Summarize channel messages
router.post('/summarize-channel', async (req, res, next) => {
  try {
    const { channelId, lookbackHours } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
    const since = new Date(Date.now() - (lookbackHours || 24) * 3600 * 1000);
    const messages = await prisma.message.findMany({
      where: { channelId, createdAt: { gte: since }, isDeleted: false },
      include: { sender: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    const transcript = messages.map(m => `${m.sender?.fullName || 'Unknown'}: ${m.content}`).join('\n');
    const sys = 'You are an expert meeting/chat summarizer. Produce a concise summary with: 1) Key topics discussed, 2) Decisions made, 3) Open questions, 4) Action items (with owners if mentioned). Use markdown.';
    const { text } = await callLLM(`summary-${channelId}-${Date.now()}`, sys, transcript || 'No messages in the last window.');
    res.json({ summary: text || 'No summary available.', messageCount: messages.length });
  } catch (e: any) {
    logger.error('summarize error', e?.message);
    next(e);
  }
});

// Generate AI draft message according to chat context
router.post('/draft-reply', async (req, res, next) => {
  try {
    const { channelId, userPrompt } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId required' });
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { fullName: true, email: true },
    });
    const senderName = currentUser?.fullName || currentUser?.email || 'User';

    // Fetch user's assigned tasks to know completed vs pending status
    const userTasks = await prisma.task.findMany({
      where: {
        orgId: channel.orgId,
        deletedAt: null,
        assignees: { some: { userId: req.user!.id } },
      },
      select: { title: true, status: true },
      take: 20,
    });

    const taskSummary = userTasks.length > 0
      ? userTasks.map(t => `- [${t.status}] ${t.title}`).join('\n')
      : 'No active assigned tasks recorded.';

    const messages = await prisma.message.findMany({
      where: { channelId, isDeleted: false },
      include: { sender: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    messages.reverse();
    const transcript = messages.map(m => `${m.sender?.fullName || m.sender?.email || 'User'}: ${m.content}`).join('\n');

    const lastMsg = messages[messages.length - 1];
    const lastSenderName = lastMsg?.sender?.fullName || lastMsg?.sender?.email || '';
    const isCurrentSenderLast = lastSenderName === senderName;

    const sys = `You are a smart AI collaboration assistant. You are generating a chat message draft ON BEHALF OF user "${senderName}".

CRITICAL PERSPECTIVE RULES:
1. STRICT SENDER PERSPECTIVE: You MUST write ONLY from the perspective of "${senderName}". Never write as the receiver or swap roles.
2. DO NOT REPLY TO YOUR OWN MESSAGES AS RECEIVER:
   ${isCurrentSenderLast ? `NOTE: "${senderName}" was the LAST person to speak in the chat (message: "${lastMsg?.content}"). Do NOT draft a message asking "${senderName}" to clarify or fulfill their own request as if "${senderName}" received it. Instead, draft a polite follow-up or additional detail from "${senderName}" to the recipient(s).` : `NOTE: The latest message was sent by "${lastSenderName}". Draft a direct response from "${senderName}" to "${lastSenderName}".`}
3. TARGETED FOCUS: Focus ONLY on requests or conversation context relevant to "${senderName}".
4. DO NOT ANSWER FOR OTHERS: Do NOT accept or acknowledge tasks assigned to other team members.
5. CONCISE & NATURAL: Keep the draft concise (1-2 sentences), professional, and natural.
6. FORMAT: Return ONLY the raw draft text. No quotes, intro explanations, or markdown wrappers.`;

    const userMsg = userPrompt && typeof userPrompt === 'string' && userPrompt.trim().length > 0
      ? `Recent Chat History:\n${transcript}\n\nUser ${senderName}'s explicit instruction for this draft: ${userPrompt}`
      : `Recent Chat History:\n${transcript}\n\nDraft a direct 1-2 sentence message from ${senderName} to send in this chat.`;

    const { text } = await callLLM(`draft-${channelId}-${Date.now()}`, sys, userMsg);
    res.json({ draft: text?.trim() || '' });
  } catch (e: any) {
    logger.error('draft-reply error:', e?.message);
    next(e);
  }
});

// Generate tasks from a thread/messages
router.post('/generate-tasks', async (req, res, next) => {
  try {
    const { channelId, sinceMessageId, orgId, projectId: reqProjectId } = req.body;
    if (!channelId || !orgId) return res.status(400).json({ error: 'channelId and orgId required' });

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const hasAccess = await canUserAccessChannel(req.user!.id, channel);
    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
    const targetProjectId = reqProjectId || channel?.projectId || null;

    const where: any = { channelId, isDeleted: false };
    if (sinceMessageId) {
      const s = await prisma.message.findUnique({ where: { id: sinceMessageId } });
      if (s) where.createdAt = { gte: s.createdAt };
    }
    const messages = await prisma.message.findMany({
      where,
      include: { sender: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const transcript = messages.map(m => `${m.sender?.fullName || m.sender?.email || 'Unknown'}: ${m.content}`).join('\n');
    const sys = `Extract actionable tasks from the following chat. Return STRICT JSON array of tasks, no prose. Each task: {"title": string, "description": string, "priority": "LOW|MEDIUM|HIGH|URGENT", "suggestedAssignee": string|null}. Max 6 tasks.`;
    const { text } = await callLLM(`tasks-${channelId}-${Date.now()}`, sys, transcript || 'No content');

    let tasks: any[] = [];
    if (text && typeof text === 'string') {
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        tasks = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch { tasks = []; }
    }

    const orgMembers = await prisma.membership.findMany({
      where: { orgId, isActive: true },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });

    if (req.body.persist === true) {
      const created: any[] = [];
      for (const t of tasks.slice(0, 6)) {
        const c = await prisma.task.create({
          data: {
            orgId,
            projectId: targetProjectId,
            title: t.title || 'Untitled',
            description: t.description || '',
            priority: (t.priority || 'MEDIUM') as any,
            createdById: req.user!.id,
            aiGenerated: true,
          },
        });

        if (t.suggestedAssignee && typeof t.suggestedAssignee === 'string' && t.suggestedAssignee.trim().length > 0) {
          const needle = t.suggestedAssignee.toLowerCase().trim();
          if (needle.length > 0) {
            const match = orgMembers.find((m) => {
              const name = (m.user?.fullName || '').toLowerCase();
              const email = (m.user?.email || '').toLowerCase();
              return (name && (name.includes(needle) || needle.includes(name))) || (email && email.includes(needle));
            });
            if (match && match.userId) {
              await prisma.taskAssignee.create({
                data: { taskId: c.id, userId: match.userId },
              }).catch((err) => logger.error('TaskAssignee creation failed:', err));
            }
          }
        }

        const fullTask = await prisma.task.findUnique({
          where: { id: c.id },
          include: {
            assignees: { include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } } },
            createdBy: { select: { id: true, fullName: true, email: true } },
          },
        });
        created.push(fullTask || c);
      }
      return res.json({ tasks, created });
    }

    // Attach resolved assignee IDs to suggestions for preview modal
    const enrichedTasks = tasks.map((t) => {
      let resolvedUserId: string | null = null;
      if (t.suggestedAssignee && typeof t.suggestedAssignee === 'string' && t.suggestedAssignee.trim().length > 0) {
        const needle = t.suggestedAssignee.toLowerCase().trim();
        if (needle.length > 0) {
          const match = orgMembers.find((m) => {
            const name = (m.user?.fullName || '').toLowerCase();
            const email = (m.user?.email || '').toLowerCase();
            return (name && (name.includes(needle) || needle.includes(name))) || (email && email.includes(needle));
          });
          if (match) resolvedUserId = match.userId;
        }
      }
      return { ...t, resolvedUserId };
    });

    res.json({ tasks: enrichedTasks });
  } catch (e) { next(e); }
});

// Sprint planning suggestion
router.post('/sprint-plan', async (req, res, next) => {
  try {
    const { orgId, goal, durationDays } = req.body;
    const backlog = await prisma.task.findMany({
      where: { orgId, status: 'TODO', deletedAt: null },
      take: 30,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { assignees: { include: { user: true } } },
    });
    const backlogText = backlog.map(t => `- [${t.priority}] ${t.title}: ${t.description?.slice(0, 100) || ''}`).join('\n');
    const sys = 'You are an agile coach. Suggest a sprint plan based on backlog and goal. Return sections: Sprint Goal, Committed Items, Rationale, Risks. Markdown.';
    const user = `Goal: ${goal || 'General progress'}\nDuration: ${durationDays || 14} days\nBacklog:\n${backlogText}`;
    const { text } = await callLLM(`sprint-${orgId}-${Date.now()}`, sys, user);
    res.json({ plan: text || 'No plan generated.' });
  } catch (e) { next(e); }
});

// AI Exam & Quiz Question Bank Generator
router.post('/generate-quiz', async (req, res, next) => {
  try {
    const { notes, subject, numQuestions } = req.body;
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return res.status(400).json({ error: 'Lesson notes or topic required to generate quiz.' });
    }

    const sys = `You are an expert Educational Quiz & Exam Question Bank Generator. 
Generate a comprehensive, high-quality Exam Question Bank based on the provided lesson notes or subject topic.
Format your output cleanly in Markdown with two distinct sections:
1. MULTIPLE CHOICE QUESTIONS (MCQs) (3-5 questions with options A, B, C, D)
2. SHORT ANSWER & CONCEPTUAL QUESTIONS (2-3 questions)
3. ANSWER KEY & RUBRIC NOTES at the very end.`;

    const userPrompt = `Subject/Topic: ${subject || 'General Academic Studies'}\nTarget Question Count: ${numQuestions || 5}\n\nLesson Notes / Content:\n${notes}`;

    const { text } = await callLLM(`quiz-${Date.now()}`, sys, userPrompt);
    res.json({ quiz: text || 'Failed to generate quiz.' });
  } catch (e: any) {
    logger.error('generate-quiz error:', e?.message);
    next(e);
  }
});

// Executive Daily Briefing for Directors, Principals & Deans
router.post('/daily-briefing', async (req, res, next) => {
  try {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });

    const [org, tasks, announcements] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.task.findMany({
        where: { orgId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      prisma.message.findMany({
        where: { channel: { orgId, type: 'ANNOUNCEMENT' } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { sender: { select: { fullName: true } } },
      }),
    ]);

    const taskSummary = tasks.map(t => `- ${t.title} (${t.priority} priority, status: ${t.status})`).join('\n');
    const annSummary = announcements.map(a => `- ${a.sender?.fullName || 'Admin'}: "${a.content}"`).join('\n');

    const sys = `You are an Executive AI Assistant for the Director and Principal of an educational institution.
Generate a concise, professional 1-PARAGRAPH Executive Briefing summarizing today's campus status, active tasks, and recent announcements. Focus on key highlights.`;

    const prompt = `Institution: ${org?.name || 'Academic Institution'}
Active Tasks:
${taskSummary || 'No active tasks.'}

Recent Campus Announcements:
${annSummary || 'No recent announcements.'}`;

    const { text } = await callLLM(`briefing-${orgId}-${Date.now()}`, sys, prompt);
    res.json({ briefing: text || 'Daily briefing currently unavailable.' });
  } catch (e: any) {
    logger.error('daily-briefing error:', e?.message);
    next(e);
  }
});

export default router;

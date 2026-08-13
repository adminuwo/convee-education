import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { aiApi, taskApi, channelApi, parentApi, financeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Zap, ListTodo, FileText, MessageSquareText, Plus, Trash2, PanelLeft, Clock, GraduationCap, BookOpen, Check, UserCheck, Mail, RefreshCw, Landmark, DollarSign, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import FormattedMarkdown from '@/components/FormattedMarkdown';

const QUICK_PROMPTS = [
  { icon: MessageSquareText, label: 'Summarize channel', prompt: 'Summarize the last 24 hours of activity in my current workspace.' },
  { icon: ListTodo, label: 'Extract action items', prompt: 'Extract action items from my recent conversations and list them with owners.' },
  { icon: FileText, label: 'Draft an update', prompt: 'Draft a weekly status update for my team based on my recent tasks and progress.' },
  { icon: Zap, label: 'Sprint planning', prompt: 'Suggest a 2-week sprint plan based on my open backlog items.' },
];

const STUDENT_PROMPTS = [
  { icon: ListTodo, label: 'Pending Homework & Tasks', prompt: 'What homework and tasks do I have due for my class?' },
  { icon: Zap, label: 'Class Projects Overview', prompt: 'Summarize my active class projects and their goals.' },
  { icon: Sparkles, label: 'Homework & Study Help', prompt: 'Can you help me understand a complex topic step-by-step for my studies?' },
  { icon: MessageSquareText, label: 'Grade Announcements', prompt: 'What are the latest announcements for my grade and school wing?' },
];

const PARENT_PROMPTS = [
  { icon: ListTodo, label: "Child's Progress & Homework 📊", prompt: "Summarize my child's current academic progress, attendance rate, and pending homework assignments." },
  { icon: MessageSquareText, label: 'Contact Class Teacher ✉️', prompt: 'Draft a polite message to my child\'s Class Teacher regarding their recent homework performance and attendance.' },
  { icon: GraduationCap, label: 'Contact Head of Department (HOD) 🏛️', prompt: 'Draft a message to the Head of Department (HOD) to discuss my child\'s overall academic progress and support.' },
  { icon: Sparkles, label: 'Help Child With Homework 💡', prompt: 'My child needs help understanding their homework assignment. Can you break down the concept step-by-step so I can guide them?' },
];

const ACCOUNTANT_PROMPTS = [
  { icon: FileText, label: 'Fee Collection & Dues Analysis 📊', prompt: 'Give me a summary of total student fees collected, pending balances, and overdue accounts for this term.' },
  { icon: Sparkles, label: 'Faculty Payroll Summary 💼', prompt: 'Show me the disbursed faculty payroll breakdown and total net salary payout for this month.' },
  { icon: RefreshCw, label: 'Sync Pending Ledgers with Tally 🔄', prompt: 'Sync all staged student fee ledgers and payroll vouchers with Tally Prime (incremental sync).' },
  { icon: ListTodo, label: 'Financial Health & Revenue Report 📈', prompt: 'Analyze financial metrics, ledger sync statuses, and overall net balance for Demo International Academy.' },
];

const TEACHER_PROMPTS = [
  { icon: GraduationCap, label: 'Generate Quiz / Question Bank 📝', prompt: 'Generate an Exam Question Bank (5 MCQs + 3 Short Answer Questions with answer key) from the topic: Photosynthesis & Cell Respiration.' },
  { icon: ListTodo, label: 'Check Homework Submissions', prompt: 'Who has submitted their homework and who has not submitted yet for my class?' },
  { icon: BookOpen, label: 'Create Class Homework', prompt: 'Create a new science homework assignment for Grade 10 Sec A on Quadratic Equations due next Monday with instructions and checklist.' },
  { icon: Sparkles, label: 'Class Submission Analytics', prompt: 'Give me a full breakdown of homework submission rates across my class sections and department.' },
  { icon: MessageSquareText, label: 'Draft Class Announcement', prompt: 'Draft an announcement for my class students about upcoming homework due dates.' },
];

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

export default function AIPage() {
  const navigate = useNavigate();
  const { user, currentOrg } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeSessionKey, setActiveSessionKey] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef();

  const isStudent = currentOrg?.role === 'STUDENT';
  const isParent = currentOrg?.role === 'PARENT' || user?.email?.includes('parent');
  const isAccountant = currentOrg?.role === 'ACCOUNTANT' || user?.systemRole === 'ACCOUNTANT' || user?.email?.includes('accountant');
  const activePrompts = isStudent
    ? STUDENT_PROMPTS
    : isParent
    ? PARENT_PROMPTS
    : isAccountant
    ? ACCOUNTANT_PROMPTS
    : TEACHER_PROMPTS;

  const loadConversations = useCallback(async () => {
    try {
      const convos = await aiApi.conversations();
      const list = Array.isArray(convos) ? convos : [];
      setConversations(list);
      return list;
    } catch (e) {
      console.error('Failed to load AI conversations:', e);
      return [];
    }
  }, []);

  const loadMessagesForSession = useCallback(async (key) => {
    if (!key) return;
    try {
      const r = await aiApi.history(key);
      setMessages(Array.isArray(r.messages) ? r.messages : []);
    } catch (e) {
      setMessages([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      const list = await loadConversations();
      if (list.length > 0) {
        setActiveSessionKey(list[0].sessionKey);
        loadMessagesForSession(list[0].sessionKey);
      } else {
        const defaultKey = `ai-session-${user?.id}-${Date.now()}`;
        setActiveSessionKey(defaultKey);
      }
    })();
  }, [user?.id, loadConversations, loadMessagesForSession]);

  const handleSelectSession = (key) => {
    setActiveSessionKey(key);
    loadMessagesForSession(key);
  };

  const handleNewChat = async () => {
    try {
      const newConvo = await aiApi.createConversation('New Conversation');
      const key = newConvo?.sessionKey || `ai-session-${user?.id}-${Date.now()}`;
      setActiveSessionKey(key);
      setMessages([]);
      await loadConversations();
    } catch (e) {
      const fallbackKey = `ai-session-${user?.id}-${Date.now()}`;
      setActiveSessionKey(fallbackKey);
      setMessages([]);
    }
  };

  const [deletingKeys, setDeletingKeys] = useState(new Set());

  const handleDeleteSession = async (key, e) => {
    e.stopPropagation();
    if (deletingKeys.has(key)) return;

    setDeletingKeys((prev) => new Set(prev).add(key));

    const remaining = conversations.filter((c) => c.sessionKey !== key);
    setConversations(remaining);

    if (activeSessionKey === key) {
      if (remaining.length > 0) {
        setActiveSessionKey(remaining[0].sessionKey);
        loadMessagesForSession(remaining[0].sessionKey);
      } else {
        handleNewChat();
      }
    }

    try {
      await aiApi.deleteConversation(key);
      toast.success('Chat deleted');
    } catch (err) {
      loadConversations();
    } finally {
      setDeletingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: msg }]);
    setLoading(true);
    try {
      const currentKey = activeSessionKey || `ai-session-${user?.id}-${Date.now()}`;
      const r = await aiApi.chat(msg, currentKey);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: r.response }]);
      if (r.title) {
        setConversations((prev) =>
          prev.map((c) => (c.sessionKey === currentKey ? { ...c, title: r.title } : c))
        );
      }
      await loadConversations();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'AI failed');
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const [assignedProposalKeys, setAssignedProposalKeys] = useState(new Set());

  const handleExecuteAIHomework = async (proposal, proposalKey) => {
    try {
      // Safe Date parsing
      let parsedDueDate = null;
      if (proposal.dueDate) {
        const d = new Date(proposal.dueDate);
        if (!isNaN(d.getTime())) {
          parsedDueDate = d.toISOString();
        }
      }
      if (!parsedDueDate) {
        // Default due date to 7 days from now
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        parsedDueDate = nextWeek.toISOString();
      }

      // Class section resolution
      let targetTeamIds = (proposal.targetClassTeamIds || []).filter(Boolean);
      if (!targetTeamIds.length) {
        // Resolve from org departments
        const depts = await orgApi.departments(currentOrg.id).catch(() => []);
        const allTeams = [];
        (depts || []).forEach((d) => (d.teams || []).forEach((t) => allTeams.push(t)));

        if (proposal.targetClassNames?.length) {
          const matched = allTeams.filter((t) =>
            proposal.targetClassNames.some((cn) => t.name.toLowerCase().includes(cn.toLowerCase()))
          );
          targetTeamIds = matched.map((m) => m.id);
        }

        if (!targetTeamIds.length && allTeams.length > 0) {
          // Fallback to first available class team or teacher's managed team
          const managed = allTeams.find((t) => t.managerId === user?.id);
          targetTeamIds = [managed ? managed.id : allTeams[0].id];
        }
      }

      const payload = {
        orgId: currentOrg.id,
        title: proposal.title,
        description: proposal.description || '',
        priority: proposal.priority || 'HIGH',
        dueDate: parsedDueDate,
        isHomework: true,
        classTeamIds: targetTeamIds,
        checklist: proposal.checklist || [],
      };

      await taskApi.create(payload);
      setAssignedProposalKeys((prev) => new Set(prev).add(proposalKey));
      toast.success('Homework assigned to class students! 📚');
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to assign homework');
    }
  };

  const handleSendFacultyMessage = async (contactProposal) => {
    try {
      let targetUserId = contactProposal.recipientId;
      if (!targetUserId || targetUserId === 'class_teacher' || targetUserId === 'hod') {
        const children = await parentApi.getMyChildren().catch(() => []);
        if (children.length > 0) {
          const studentId = children[0].userId || children[0].user?.id;
          const report = await parentApi.getChildReport(studentId, currentOrg?.id).catch(() => null);
          if (targetUserId === 'hod' && report?.hodUser?.id) {
            targetUserId = report.hodUser.id;
          } else if (report?.classTeacher?.id) {
            targetUserId = report.classTeacher.id;
          }
        }
      }

      if (!targetUserId || targetUserId.includes(' ')) {
        toast.error('Faculty contact not found');
        return;
      }

      const dmCh = await channelApi.dm(currentOrg.id, targetUserId);
      if (contactProposal.draftMessage) {
      await channelApi.sendMessage(dmCh.id, { content: contactProposal.draftMessage });
      toast.success(`Draft sent to ${contactProposal.recipientName || contactProposal.recipientRole || 'Faculty'}! 💬`);
    }
    navigate(`/app/channels/${dmCh.id}`);
  } catch (e) {
    toast.error('Failed to message faculty member');
  }
};

const handleExecuteTallySync = async () => {
  try {
    toast.loading('Syncing pending ledgers with Tally Prime...');
    const savedComp = localStorage.getItem('tally_selected_company') || '';
    const res = await financeApi.syncTally({
      force: false,
      source: 'AI Assistant Incremental Sync',
      tallyCompanyName: savedComp,
    });
    toast.dismiss();
    toast.success(res.message || 'Incremental Tally sync complete!');
  } catch (e) {
    toast.dismiss();
    toast.error('Failed to sync with Tally');
  }
};

const renderAIMessageContent = (msgObj) => {
  const content = msgObj.content;
  const jsonMatch = content.match(/```json\s*(\{[\s\S]*?"action"\s*:\s*"create_homework"[\s\S]*?\})\s*```/);
  const contactMatch = content.match(/```json\s*(\{[\s\S]*?"action"\s*:\s*"contact_faculty"[\s\S]*?\})\s*```/);
  const tallyMatch = content.match(/```json\s*(\{[\s\S]*?"action"\s*:\s*"sync_tally"[\s\S]*?\})\s*```/);
  
  let proposal = null;
  let contactProposal = null;
  let tallyProposal = null;
  let textOnly = content;

  if (jsonMatch) {
    try {
      proposal = JSON.parse(jsonMatch[1]);
      textOnly = content.replace(jsonMatch[0], '').trim();
    } catch (e) {}
  } else if (contactMatch) {
    try {
      contactProposal = JSON.parse(contactMatch[1]);
      textOnly = content.replace(contactMatch[0], '').trim();
    } catch (e) {}
  } else if (tallyMatch) {
    try {
      tallyProposal = JSON.parse(tallyMatch[1]);
      textOnly = content.replace(tallyMatch[0], '').trim();
    } catch (e) {}
  }

  const proposalKey = msgObj.id || proposal?.title || 'prop-key';
  const isAlreadyAssigned = assignedProposalKeys.has(proposalKey);

  return (
    <div className="space-y-3">
      {textOnly && <FormattedMarkdown content={textOnly} />}

      {proposal && (
        <Card className="border border-blue-500/30 bg-blue-500/10 p-3.5 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-blue-400">
            <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> AI Generated Homework Proposal</span>
            {proposal.priority && <Badge variant="outline" className="text-[10px] bg-blue-500/20 text-blue-300">{proposal.priority}</Badge>}
          </div>
          <div className="font-semibold text-sm text-foreground">{proposal.title}</div>
          {proposal.targetClassNames && (
            <div className="text-[11px] text-muted-foreground">Target Class: <span className="font-semibold text-foreground">{proposal.targetClassNames.join(', ')}</span></div>
          )}
          {proposal.dueDate && (
            <div className="text-[11px] text-muted-foreground">Suggested Due Date: <span className="font-semibold text-foreground">{proposal.dueDate}</span></div>
          )}
          {proposal.description && (
            <p className="text-muted-foreground line-clamp-2">{proposal.description}</p>
          )}
          <Button
            size="sm"
            disabled={isAlreadyAssigned}
            onClick={() => handleExecuteAIHomework(proposal, proposalKey)}
            className={`w-full h-8 font-bold text-xs shadow-md mt-1 transition-all ${
              isAlreadyAssigned
                ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border opacity-70'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isAlreadyAssigned ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Assigned
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Assign Homework Now
              </>
            )}
          </Button>
        </Card>
      )}

      {contactProposal && (
        <Card className="border border-purple-500/30 bg-purple-500/10 p-3.5 rounded-xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between font-bold text-purple-400">
            <span className="flex items-center gap-1.5"><MessageSquareText className="h-4 w-4" /> Message Draft for {contactProposal.recipientRole || 'Faculty'}</span>
            <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-300">Ready to Send</Badge>
          </div>
          <div className="font-semibold text-sm text-foreground">{contactProposal.recipientName || contactProposal.recipientRole}</div>
          {contactProposal.draftMessage && (
            <div className="p-2.5 rounded-lg bg-background/80 border border-border text-foreground text-xs whitespace-pre-wrap max-h-36 overflow-y-auto">
              {contactProposal.draftMessage}
            </div>
          )}
          <Button
            size="sm"
            onClick={() => handleSendFacultyMessage(contactProposal)}
            className="w-full h-8 font-bold text-xs shadow-md mt-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <MessageSquareText className="h-3.5 w-3.5 mr-1.5" /> Send Direct Message to {contactProposal.recipientRole || 'Faculty'}
          </Button>
        </Card>
      )}

      {tallyProposal && (
        <Card className="border border-emerald-500/30 bg-emerald-500/10 p-3.5 rounded-xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between font-bold text-emerald-400">
            <span className="flex items-center gap-1.5"><RefreshCw className="h-4 w-4" /> Incremental Tally Sync Requested</span>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-300">Port 9000 Active</Badge>
          </div>
          <p className="text-muted-foreground text-xs">Push all staged fee ledgers and payroll vouchers live to Tally Prime.</p>
          <Button
            size="sm"
            onClick={handleExecuteTallySync}
            className="w-full h-8 font-bold text-xs shadow-md mt-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync Pending Ledgers with Tally
          </Button>
        </Card>
      )}
    </div>
  );
};

return (
  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col overflow-hidden" data-testid="ai-page">
    {/* Top Header */}
    <div className="border-b border-border px-4 py-2.5 flex items-center justify-between bg-card/50">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen((v) => !v)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title={sidebarOpen ? 'Hide History' : 'Show History'}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-md flex items-center justify-center ${isStudent ? 'bg-emerald-500/15 text-emerald-500' : isParent ? 'bg-purple-500/15 text-purple-500' : isAccountant ? 'bg-blue-500/15 text-blue-500' : 'bg-accent/15 text-accent'}`}>
            {isStudent ? <GraduationCap className="h-4.5 w-4.5" /> : isParent ? <UserCheck className="h-4.5 w-4.5" /> : isAccountant ? <Landmark className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5" />}
          </div>
          <div>
            <div className="font-display font-semibold text-sm leading-tight">
              {isStudent ? 'Academic AI Study Buddy' : isParent ? 'Parent AI Academic Assistant' : isAccountant ? 'AI Financial & Accounting Assistant' : 'AI Campus & Homework Assistant'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isStudent ? 'Your 24/7 personal tutor for homework, class tasks, and projects' : isParent ? "Monitor your child's progress & homework, and connect with Teachers & HOD" : isAccountant ? 'Financial analysis, fee collection insights, payroll support & Tally synchronization' : 'Class homework creation & student submission tracking'}
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleNewChat} size="sm" className="gap-1.5 font-medium shadow-xs">
        <Plus className="h-4 w-4" /> New Chat
      </Button>
    </div>

    {/* Main Two-Column View */}
    <div className="flex-1 flex overflow-hidden">
      {/* Left History Sidebar */}
      {sidebarOpen && (
        <div className="w-64 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat History</span>
            <span className="text-[10px] text-muted-foreground font-normal">{conversations.length} sessions</span>
          </div>

          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {conversations.map((c) => {
                const isSelected = activeSessionKey === c.sessionKey;
                return (
                  <div
                    key={c.sessionKey}
                    onClick={() => handleSelectSession(c.sessionKey)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/30 text-foreground font-medium shadow-xs'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <MessageSquareText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'opacity-70'}`} />
                      <span className="truncate">{c.title || 'Conversation'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(c.sessionKey, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                      title="Delete chat session"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              {conversations.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No past sessions yet. Click "+ New Chat" to start!
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Right Active Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center">
                <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl ${isStudent ? 'bg-emerald-500/10 text-emerald-500' : isParent ? 'bg-purple-500/10 text-purple-500' : isAccountant ? 'bg-blue-500/10 text-blue-500' : 'bg-accent/10 text-accent'} mb-4`}>
                  {isStudent ? <GraduationCap className="h-8 w-8" /> : isParent ? <UserCheck className="h-8 w-8" /> : isAccountant ? <Landmark className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
                </div>
                <h2 className="font-display text-2xl font-semibold">
                  {isStudent ? `What shall we study today, ${user?.fullName?.split(' ')[0]}?` : `How can I help you today, ${user?.fullName?.split(' ')[0]}?`}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {isStudent
                    ? 'Ask me about your class tasks, homework, active projects, or any subject questions.'
                    : isParent
                    ? "Ask me about your child's attendance, grades, pending homework, or contact their teachers."
                    : isAccountant
                    ? 'Ask me to analyze fee collection rates, review pending dues, check faculty payroll, or sync ledgers with Tally Prime.'
                    : 'Ask me to create homework for your class, check who has submitted homework, or draft class updates.'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePrompts.map((q, i) => (
                  <button key={i} onClick={() => send(q.prompt)} className="text-left rounded-lg border border-border p-4 hover:border-accent transition-colors" data-testid={`ai-prompt-${i}`}>
                    <div className="flex items-center gap-2">
                      <q.icon className={`h-4 w-4 ${isStudent ? 'text-emerald-500' : isParent ? 'text-purple-500' : isAccountant ? 'text-blue-500' : 'text-accent'}`} />
                      <div className="font-medium">{q.label}</div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{q.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <Avatar className="h-8 w-8 mt-0.5"><AvatarFallback className="bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></AvatarFallback></Avatar>
                )}
                <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-primary-foreground whitespace-pre-wrap' : 'bg-secondary text-foreground'}`}>
                  {m.role === 'user' ? m.content : renderAIMessageContent(m)}
                </div>
                {m.role === 'user' && (
                  <Avatar className="h-8 w-8 mt-0.5"><AvatarFallback className="bg-primary/10 text-primary">{initials(user?.fullName)}</AvatarFallback></Avatar>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></AvatarFallback></Avatar>
                <div className="rounded-2xl bg-secondary px-4 py-3"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-3" data-testid="ai-composer">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-lg border border-border bg-secondary/40 focus-within:border-accent transition-colors">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="min-h-[54px] max-h-40 border-0 bg-transparent focus-visible:ring-0 resize-none text-sm"
                placeholder="Ask AI anything…"
                data-testid="ai-input"
              />
              <div className="flex justify-end p-1.5 border-t border-border">
                <Button size="sm" onClick={() => send()} disabled={!input.trim() || loading} data-testid="ai-send-btn"><Send className="h-4 w-4 mr-1" /> Send</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);
}

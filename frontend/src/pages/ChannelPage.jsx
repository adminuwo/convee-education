import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { channelApi, aiApi, userApi, orgApi, fileApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket, connectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, Lock, Volume2, Users, Search, Sparkles, Send, Paperclip, Smile, MoreHorizontal, Pin, Reply, Trash2, Pencil, Copy, ListTodo, X, Wand2, Loader2, AtSign, UserCheck, UserPlus, BookOpen, UploadCloud, Download, FileText, Image as ImageIcon, Film, FileArchive, Music } from 'lucide-react';
import { toast } from 'sonner';
import { Virtuoso } from 'react-virtuoso';
import { formatDistanceToNow, format } from 'date-fns';
import ConfirmModal from '@/components/ConfirmModal';

function bytes(b) { if (!b) return '0 B'; const k = 1024; const sizes = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b) / Math.log(k)); return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`; }
function fileIcon(mime) { if (mime?.startsWith('image/')) return ImageIcon; if (mime?.startsWith('video/')) return Film; if (mime?.startsWith('audio/')) return Music; if (mime?.includes('zip') || mime?.includes('compressed')) return FileArchive; return FileText; }

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🚀', '👀', '✅', '❗'];

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

function formatMessageContent(content) {
  if (!content) return '';
  const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('@')) {
      const tagLower = part.toLowerCase();
      const isSpecial = ['@all', '@channel', '@here', '@team', '@project', '@ai', '@aidraft'].includes(tagLower);
      return (
        <span
          key={idx}
          className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold border ${
            isSpecial
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-primary/15 border-primary/30 text-primary'
          }`}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// ... inside ChannelPage component ...
// systemTags update below

function MessageRow({ m, currentUserId, onReact, onEdit, onDelete, onPin, onReply, isThread }) {
  const [showActions, setShowActions] = useState(false);
  const isAI = m.type === 'AI' || m.sender?.email === 'ai@system';
  const isMe = m.senderId === currentUserId;
  const reactionsGrouped = useMemo(() => {
    const g = {};
    (m.reactions || []).forEach((r) => {
      if (!g[r.emoji]) g[r.emoji] = { count: 0, users: [], mine: false };
      g[r.emoji].count += 1;
      g[r.emoji].users.push(r.userId);
      if (r.userId === currentUserId) g[r.emoji].mine = true;
    });
    return g;
  }, [m.reactions, currentUserId]);

  return (
    <div
      className="group relative flex gap-3 px-4 py-2 hover:bg-muted/40 chat-bubble"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      data-testid={`message-${m.id}`}
    >
      <Avatar className="h-9 w-9 mt-0.5">
        <AvatarImage src={m.sender?.avatarUrl} />
        <AvatarFallback className={`text-xs ${isAI ? 'bg-accent/20 text-accent' : 'bg-primary/10 text-primary'}`}>
          {isAI ? <Sparkles className="h-4 w-4" /> : initials(m.sender?.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{isAI ? 'AI Assistant' : (m.sender?.fullName || 'Unknown')}</span>
          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</span>
          {m.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>
        <div className="text-sm mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
          {m.isDeleted ? <em className="text-muted-foreground">This message was deleted</em> : formatMessageContent(m.content)}
        </div>
        {Object.entries(reactionsGrouped).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionsGrouped).map(([emoji, info]) => (
              <button key={emoji} onClick={() => onReact(m.id, emoji)} className={`rounded-full border px-2 py-0.5 text-xs flex items-center gap-1 ${info.mine ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-border'}`}>
                <span>{emoji}</span><span className="tabular-nums">{info.count}</span>
              </button>
            ))}
          </div>
        )}
        {(m._count?.replies > 0 && !isThread) && (
          <button onClick={() => onReply(m)} className="mt-1 text-xs text-primary hover:underline flex items-center gap-1"><Reply className="h-3 w-3" /> {m._count.replies} repl{m._count.replies === 1 ? 'y' : 'ies'}</button>
        )}
      </div>
      {showActions && !m.isDeleted && (
        <div className="absolute right-4 top-0 -translate-y-1/2 flex items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-0.5 shadow-sm">
          <Popover>
            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Smile className="h-3.5 w-3.5" /></Button></PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="flex gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} className="hover:bg-muted rounded p-1 text-lg" onClick={() => onReact(m.id, e)}>{e}</button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {!isThread && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onReply(m)}><Reply className="h-3.5 w-3.5" /></Button>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPin(m)}><Pin className="h-3.5 w-3.5" /></Button>
          {isMe && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChannelPage() {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const { user, currentOrg } = useAuth();
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState({});
  const [threadFor, setThreadFor] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadText, setThreadText] = useState('');
  const [editing, setEditing] = useState(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinned, setPinned] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiTasksCreated, setAiTasksCreated] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [orgTeams, setOrgTeams] = useState([]);
  const [orgProjects, setOrgProjects] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [deleteMsgModal, setDeleteMsgModal] = useState({ open: false, msg: null });
  const [deleteChanModal, setDeleteChanModal] = useState(false);
  const [studyFiles, setStudyFiles] = useState([]);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const materialInputRef = useRef();
  const virtuosoRef = useRef();
  const typingTimeoutRef = useRef({});
  const textareaRef = useRef();

  const loadStudyFiles = useCallback(async () => {
    if (!channelId || !currentOrg?.id) return;
    try {
      const list = await fileApi.listByChannel(currentOrg.id, channelId);
      setStudyFiles(Array.isArray(list) ? list : []);
    } catch (e) {
      setStudyFiles([]);
    }
  }, [channelId, currentOrg?.id]);

  useEffect(() => {
    loadStudyFiles();
  }, [loadStudyFiles]);

  const handleUploadStudyMaterial = async (file) => {
    if (!file || !channelId || !currentOrg?.id) return;
    setUploadingMaterial(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('orgId', currentOrg.id);
      fd.append('channelId', channelId);
      fd.append('isStudyMaterial', 'true');
      await fileApi.upload(fd);
      toast.success('Study material uploaded for class!');
      loadStudyFiles();
    } catch (e) {
      toast.error('Failed to upload study material');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleDeleteStudyMaterial = async (fileId) => {
    try {
      await fileApi.delete(fileId);
      toast.success('Study material removed');
      loadStudyFiles();
    } catch (e) {
      toast.error('Failed to delete file');
    }
  };

  useEffect(() => {
    if (currentOrg?.id) {
      orgApi.members(currentOrg.id).then((m) => setOrgMembers(m || [])).catch(() => {});
      orgApi.departments(currentOrg.id).then((depts) => {
        const teams = (depts || []).flatMap((d) => d.teams || []);
        setOrgTeams(teams);
      }).catch(() => {});
      orgApi.projects(currentOrg.id).then((p) => setOrgProjects(p || [])).catch(() => {});
    }
  }, [currentOrg?.id]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);
    emitTyping();

    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const lastAt = textBefore.lastIndexOf('@');

    if (lastAt !== -1 && !/\s/.test(textBefore.slice(lastAt + 1))) {
      setMentionFilter(textBefore.slice(lastAt + 1));
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertTag = (tagText) => {
    const lastAt = text.lastIndexOf('@');
    const prefix = lastAt !== -1 ? text.slice(0, lastAt) : text;
    setText(`${prefix}@${tagText} `);
    setMentionOpen(false);
  };

  const mentionSuggestions = useMemo(() => {
    const systemTags = [
      { tag: 'all', label: 'Notify everyone in channel', category: 'System' },
      { tag: 'team', label: 'Notify all teams in org', category: 'System' },
      { tag: 'project', label: 'Notify project members', category: 'System' },
      { tag: 'AI', label: 'Ask AI Assistant (posts to chat)', category: 'AI' },
      { tag: 'AIDraft', label: 'Generate AI draft in input (does not post)', category: 'AI' },
    ];

    const teamTags = (orgTeams || []).map((t) => ({
      tag: t.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      label: `Team: ${t.name}`,
      category: 'Team',
    }));

    const projectTags = (orgProjects || []).map((p) => ({
      tag: p.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      label: `Project: ${p.name}`,
      category: 'Project',
    }));

    const memberTags = (orgMembers || []).map((m) => ({
      tag: m.user?.fullName?.toLowerCase().replace(/\s+/g, '') || m.user?.email?.split('@')[0] || 'user',
      label: m.user?.fullName || m.user?.email,
      category: m.role || 'Member',
      avatarUrl: m.user?.avatarUrl,
    }));

    const all = [...systemTags, ...teamTags, ...projectTags, ...memberTags];
    if (!mentionFilter) return all;
    return all.filter(
      (s) =>
        s.tag.toLowerCase().includes(mentionFilter.toLowerCase()) ||
        s.label.toLowerCase().includes(mentionFilter.toLowerCase())
    );
  }, [orgMembers, orgTeams, orgProjects, mentionFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ch, msgs] = await Promise.all([channelApi.get(channelId), channelApi.messages(channelId)]);
      setChannel(ch);
      setMessages(msgs);
      channelApi.markRead(channelId).catch(() => {});
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not load channel'); }
    finally { setLoading(false); }
  }, [channelId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let s = getSocket() || connectSocket();
    if (!s || !channelId) return;

    const joinChannel = () => {
      s.emit('channel:join', channelId);
    };

    if (s.connected) {
      joinChannel();
    } else {
      s.on('connect', joinChannel);
    }

    const onNew = (m) => {
      if (m.channelId === channelId) {
        channelApi.markRead(channelId).catch(() => {});
        if (m.parentId) {
          if (threadFor?.id === m.parentId) {
            setThreadMessages((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              return [...prev, m];
            });
          }
        } else {
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      }
    };

    const onUpdated = (m) => setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, ...m } : x));
    const onDeleted = ({ id }) => setMessages((prev) => prev.map((x) => x.id === id ? { ...x, isDeleted: true } : x));
    const onReactAdded = (r) => setMessages((prev) => prev.map((m) => m.id === r.messageId ? { ...m, reactions: [...(m.reactions || []).filter((x) => x.id !== r.id), r] } : m));
    const onReactRemoved = ({ messageId, userId, emoji }) => setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions: (m.reactions || []).filter((r) => !(r.userId === userId && r.emoji === emoji)) } : m));
    const onTypingStart = ({ channelId: c, userId }) => { if (c === channelId) setTyping((t) => ({ ...t, [userId]: Date.now() })); };
    const onTypingStop = ({ channelId: c, userId }) => { if (c === channelId) setTyping((t) => { const cp = { ...t }; delete cp[userId]; return cp; }); };

    s.on('message:new', onNew);
    s.on('message:updated', onUpdated);
    s.on('message:deleted', onDeleted);
    s.on('reaction:added', onReactAdded);
    s.on('reaction:removed', onReactRemoved);
    s.on('typing:start', onTypingStart);
    s.on('typing:stop', onTypingStop);

    return () => {
      s.off('connect', joinChannel);
      s.off('message:new', onNew);
      s.off('message:updated', onUpdated);
      s.off('message:deleted', onDeleted);
      s.off('reaction:added', onReactAdded);
      s.off('reaction:removed', onReactRemoved);
      s.off('typing:start', onTypingStart);
      s.off('typing:stop', onTypingStop);
      s.emit('channel:leave', channelId);
    };
  }, [channelId, threadFor?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'smooth' });
      }, 50);
    }
  }, [messages.length]);

  const [drafting, setDrafting] = useState(false);

  const doGenDraft = async (customPrompt) => {
    setDrafting(true);
    try {
      const promptToPass = typeof customPrompt === 'string' ? customPrompt : text;
      const r = await aiApi.draftReply(channelId, promptToPass);
      if (r.draft) {
        setText(r.draft);
        toast.success('AI draft generated in textbox!');
      } else {
        toast.error('Could not generate draft');
      }
    } catch {
      toast.error('AI draft generation failed');
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();

    // If user uses @aidraft tag, generate a draft in textbox instead of posting to channel
    if (/@aidraft\b/i.test(content)) {
      const customPrompt = content.replace(/@aidraft/gi, '').trim();
      await doGenDraft(customPrompt);
      return; // DO NOT POST TO CHANNEL
    }

    setText('');
    try {
      const newMsg = await channelApi.sendMessage(channelId, { content });
      if (newMsg && newMsg.id) {
        setMessages((prev) => {
          if (prev.some((x) => x.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' }), 50);
      }

      // If mentions @AI (and not @aidraft), trigger AI reply in chat
      if (/@ai\b/i.test(content)) {
        setAiLoading(true);
        try {
          const resp = await aiApi.chat(content.replace(/@ai/gi, '').trim() || 'Please help.', `channel-${channelId}`);
          const aiMsg = await channelApi.sendMessage(channelId, { content: resp.response, type: 'AI', metadata: { isAI: true } });
          if (aiMsg && aiMsg.id) {
            setMessages((prev) => {
              if (prev.some((x) => x.id === aiMsg.id)) return prev;
              return [...prev, aiMsg];
            });
            setTimeout(() => virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' }), 50);
          }
        } catch (e) { toast.error('AI failed to respond'); }
        finally { setAiLoading(false); }
      }
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed to send'); setText(content); }
  };

  const doReact = async (messageId, emoji) => {
    try { await channelApi.react(channelId, messageId, emoji); } catch { toast.error('Failed'); }
  };

  const doDelete = (m) => {
    setDeleteMsgModal({ open: true, msg: m });
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMsgModal.msg) return;
    try {
      await channelApi.deleteMessage(channelId, deleteMsgModal.msg.id);
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    }
  };

  const doPin = async (m) => {
    try { await channelApi.pin(channelId, m.id); toast.success('Pinned'); } catch { toast.error('Failed'); }
  };

  const openPinned = async () => { try { setPinned(await channelApi.pinned(channelId)); setPinnedOpen(true); } catch { } };

  const doSearch = async () => {
    if (!searchQ) return;
    try { setSearchResults(await channelApi.search(channelId, searchQ)); } catch { }
  };

  const openThread = async (m) => {
    setThreadFor(m);
    try {
      const parent = await channelApi.messages(channelId);
      // fetch replies
      const resp = await fetch(`${window.location.origin.includes('localhost') ? 'http://localhost:8001' : ''}/api/v1/channels/${channelId}/messages?parentId=${m.id}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      }).then(r => r.json());
      setThreadMessages(Array.isArray(resp) ? resp : []);
    } catch { setThreadMessages([]); }
  };

  const sendThread = async () => {
    if (!threadText.trim() || !threadFor) return;
    const content = threadText.trim();
    setThreadText('');
    await channelApi.sendMessage(channelId, { content, parentId: threadFor.id });
  };

  const doSummarize = async () => {
    setAiLoading(true);
    try { const r = await aiApi.summarizeChannel(channelId); setAiSummary(r.summary); } catch { toast.error('AI summarize failed'); } finally { setAiLoading(false); }
  };

  const doGenTasks = async () => {
    if (!currentOrg?.id) return;
    setAiLoading(true);
    try {
      const r = await aiApi.generateTasks(channelId, currentOrg.id, true);
      setAiTasksCreated(r.created || []);
      toast.success(`Created ${r.created?.length || 0} tasks from this channel`);
    } catch { toast.error('AI task gen failed'); } finally { setAiLoading(false); }
  };

  const emitTyping = () => {
    const s = getSocket();
    if (!s) return;
    s.emit('typing:start', { channelId });
    clearTimeout(typingTimeoutRef.current[user.id]);
    typingTimeoutRef.current[user.id] = setTimeout(() => s.emit('typing:stop', { channelId }), 2000);
  };

  const typingUsers = Object.keys(typing).filter((uid) => uid !== user?.id);

  const dmPartner = useMemo(() => {
    if (channel?.type !== 'DIRECT' || !channel?.members) return null;
    const other = channel.members.find((m) => m.userId !== user?.id);
    return other?.user || null;
  }, [channel, user?.id]);

  const [membersModalOpen, setMembersModalOpen] = useState(false);

  const openMembersModal = async () => {
    try {
      if (currentOrg?.id) {
        const m = await orgApi.members(currentOrg.id);
        setOrgMembers(m || []);
      }
      setMembersModalOpen(true);
    } catch { toast.error('Failed to load members'); }
  };

  const addMemberToChannel = async (userId) => {
    try {
      const updated = await channelApi.addMembers(channelId, [userId]);
      setChannel(updated || channel);
      toast.success('Member added to channel');
    } catch (e) { toast.error('Failed to add member'); }
  };

  const removeMemberFromChannel = async (userId) => {
    try {
      await channelApi.removeMember(channelId, userId);
      setChannel((prev) => ({
        ...prev,
        members: (prev?.members || []).filter((m) => m.userId !== userId),
      }));
      toast.success('Member removed from channel');
    } catch (e) { toast.error('Failed to remove member'); }
  };

  const isOrgAdmin = currentOrg && ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'DIRECTOR'].includes(currentOrg.role);
  const canDeleteChannel = isOrgAdmin || (channel?.createdById === user?.id);
  const isProtectedType = ['TEAM', 'PROJECT', 'DIRECT'].includes(channel?.type);

  const doDeleteChannel = () => {
    setDeleteChanModal(true);
  };

  const confirmDeleteChannel = async () => {
    try {
      await channelApi.deleteChannel(channelId);
      toast.success('Channel deleted');
      navigate('/app/home');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete channel');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 h-14">
        <div className="flex items-center gap-2 min-w-0">
          {channel?.type === 'PRIVATE' ? <Lock className="h-4 w-4" /> : channel?.type === 'ANNOUNCEMENT' ? <Volume2 className="h-4 w-4" /> : channel?.type === 'DIRECT' ? <Users className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
          <div className="font-semibold truncate">
            {channel?.type === 'DIRECT' ? (dmPartner?.fullName || channel?.name) : channel?.name}
          </div>
          <Badge variant="outline" className="text-[10px] uppercase">{channel?.type}</Badge>
          {channel?.type !== 'DIRECT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openMembersModal}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 ml-1"
              data-testid="channel-members-btn"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{channel?.members?.length || channel?._count?.members || 0} members</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setMaterialsOpen(true); loadStudyFiles(); }}
            className="gap-1.5 text-xs font-semibold bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
            title="Class Files & Study Knowledge Base"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Class Files
            {studyFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-300">
                {studyFiles.length}
              </Badge>
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} data-testid="channel-search-btn"><Search className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={openPinned} data-testid="channel-pinned-btn"><Pin className="h-4 w-4" /></Button>
          {canDeleteChannel && !isProtectedType && (
            <Button
              variant="ghost"
              size="icon"
              onClick={doDeleteChannel}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Delete channel"
              data-testid="delete-channel-btn"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1" data-testid="channel-ai-menu"><Sparkles className="h-4 w-4" /> AI</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={doGenDraft} data-testid="ai-gen-draft"><Wand2 className="h-4 w-4 mr-2" /> Draft message</DropdownMenuItem>
              <DropdownMenuItem onClick={doSummarize} data-testid="ai-summarize"><Sparkles className="h-4 w-4 mr-2" /> Summarize channel</DropdownMenuItem>
              <DropdownMenuItem onClick={doGenTasks} data-testid="ai-gen-tasks"><ListTodo className="h-4 w-4 mr-2" /> Generate tasks</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" data-testid="chat-message-list">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Users className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold mt-3">
              {channel?.type === 'DIRECT' ? `Direct message with ${dmPartner?.fullName || 'user'}` : `Welcome to #${channel?.name}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">This is the start of your direct conversation. Say hello or mention <span className="font-mono">@AI</span> to get help.</p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
            followOutput="auto"
            itemContent={(i, m) => (
              <MessageRow key={m.id || i} m={m} currentUserId={user?.id} onReact={doReact} onEdit={(mm) => setEditing(mm)} onDelete={doDelete} onPin={doPin} onReply={openThread} />
            )}
          />
        )}
      </div>

      {(typingUsers.length > 0 || aiLoading) && (
        <div className="px-4 py-1 text-xs text-muted-foreground">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          {aiLoading ? ' AI is thinking…' : ` ${typingUsers.length} typing…`}
        </div>
      )}

      {/* Composer */}
      {channel?.type === 'ANNOUNCEMENT' && !isOrgAdmin ? (
        <div className="border-t border-border p-4 text-center text-xs text-muted-foreground bg-muted/20 flex items-center justify-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <span>Only Directors, Admins, Principals, Deans, and HODs can post in Announcement channels.</span>
        </div>
      ) : (
        <div className="border-t border-border p-3 relative" data-testid="chat-composer">
          {mentionOpen && mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-2 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-1 flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5 text-primary" /> Tag user, team, or project
              </div>
              {mentionSuggestions.slice(0, 8).map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertTag(item.tag)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs hover:bg-accent text-left transition-colors group"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs border border-primary/20 shrink-0">
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt={item.label} className="h-full w-full rounded-full object-cover" />
                    ) : item.category === 'System' ? (
                      <AtSign className="h-3.5 w-3.5" />
                    ) : item.category === 'AI' ? (
                      <Sparkles className="h-3.5 w-3.5" />
                    ) : (
                      initials(item.label)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">@{item.tag}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">{item.category}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.label}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-secondary/40 focus-within:border-primary transition-colors">
            <Textarea
              ref={textareaRef}
              className="min-h-[52px] max-h-40 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
              placeholder={channel?.type === 'DIRECT' ? `Message ${dmPartner?.fullName || 'user'}…` : `Message #${channel?.name} — type @ to tag users, team, or project`}
              value={text}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setMentionOpen(false); send(); } }}
            data-testid="chat-input"
          />
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-border">
            <div className="text-xs text-muted-foreground">Enter to send · Shift+Enter for newline</div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={doGenDraft}
                disabled={drafting}
                className="gap-1.5 text-xs text-primary hover:bg-primary/10"
                data-testid="chat-ai-draft-btn"
              >
                {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {drafting ? 'Drafting…' : 'AI Draft'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setText((prev) => (prev.endsWith('@') ? prev : prev ? `${prev} @` : '@'));
                  setMentionFilter('');
                  setMentionOpen(true);
                  textareaRef.current?.focus();
                }}
                className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                title="Tag members, teams, or AI"
              >
                <AtSign className="h-3.5 w-3.5" /> @tag
              </Button>
              <Button size="sm" onClick={send} disabled={!text.trim()} data-testid="chat-send-btn"><Send className="h-4 w-4 mr-1" /> Send</Button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Class Study Materials Drawer */}
      <Sheet open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 pr-12 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-sm font-bold">
                <BookOpen className="h-4.5 w-4.5 text-blue-400" /> Class Study Materials
              </SheetTitle>
              {currentOrg?.role !== 'STUDENT' && (
                <div className="mr-4">
                  <input type="file" hidden ref={materialInputRef} onChange={(e) => handleUploadStudyMaterial(e.target.files?.[0])} />
                  <Button size="sm" onClick={() => materialInputRef.current?.click()} disabled={uploadingMaterial} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
                    <UploadCloud className="h-3.5 w-3.5 mr-1" /> {uploadingMaterial ? 'Uploading…' : 'Upload File'}
                  </Button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Materials uploaded here are specific to <span className="font-semibold text-foreground">#{channel?.name}</span> and automatically indexed by <span className="font-mono text-amber-400">@AI</span> when tagged in chat.
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-auto p-4 space-y-2">
            {studyFiles.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="text-xs font-semibold text-foreground">No Class Materials Yet</div>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Teachers can upload lecture notes, textbook chapters, guides, or study sheets for this class.
                </p>
              </div>
            )}

            {studyFiles.map((f) => {
              const Ic = fileIcon(f.mimeType);
              return (
                <div key={f.id} className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card/60 hover:bg-muted/30 transition-all">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <Ic className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate" title={f.originalName}>
                        {f.originalName}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span>{bytes(f.size)}</span>
                        <span>•</span>
                        <span>{f.uploader?.fullName || 'Teacher'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setText(`@AI Explain the key topics from study material "${f.originalName}"`);
                        setMaterialsOpen(false);
                        textareaRef.current?.focus();
                      }}
                      className="h-7 text-[10px] gap-1 text-amber-400 hover:bg-amber-500/10"
                      title="Ask AI about this file"
                    >
                      <Sparkles className="h-3 w-3" /> Ask AI
                    </Button>

                    <a href={fileApi.download(f.id)} download={f.originalName}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Download file">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>

                    {(f.uploaderId === user?.id || ['DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'ADMIN'].includes(currentOrg?.role)) && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteStudyMaterial(f.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Remove material">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Summary drawer */}
      <Sheet open={!!aiSummary} onOpenChange={(o) => !o && setAiSummary(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> AI Summary</SheetTitle></SheetHeader>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{aiSummary}</div>
        </SheetContent>
      </Sheet>

      {/* Thread drawer */}
      <Sheet open={!!threadFor} onOpenChange={(o) => !o && setThreadFor(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 border-b border-border"><SheetTitle>Thread</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-auto">
            {threadFor && <MessageRow m={threadFor} currentUserId={user?.id} onReact={doReact} onEdit={() => {}} onDelete={doDelete} onPin={doPin} onReply={() => {}} isThread />}
            <div className="h-px bg-border my-2" />
            {threadMessages.map((tm) => (
              <MessageRow key={tm.id} m={tm} currentUserId={user?.id} onReact={doReact} onEdit={() => {}} onDelete={doDelete} onPin={doPin} onReply={() => {}} isThread />
            ))}
          </div>
          <div className="border-t border-border p-3">
            <div className="rounded-lg border border-border bg-secondary/40">
              <Textarea className="min-h-[40px] border-0 bg-transparent focus-visible:ring-0 resize-none" placeholder="Reply to thread…" value={threadText} onChange={(e) => setThreadText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThread(); } }} />
              <div className="flex justify-end p-1.5 border-t border-border">
                <Button size="sm" onClick={sendThread} disabled={!threadText.trim()}><Send className="h-4 w-4 mr-1" />Reply</Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Pinned drawer */}
      <Sheet open={pinnedOpen} onOpenChange={setPinnedOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Pinned messages</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {pinned.length === 0 && <div className="text-sm text-muted-foreground">No pinned messages</div>}
            {pinned.map((p) => (
              <div key={p.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{p.message.sender?.fullName || 'Unknown'} · {formatDistanceToNow(new Date(p.message.createdAt), { addSuffix: true })}</div>
                <div className="text-sm whitespace-pre-wrap">{p.message.content}</div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Search #{channel?.name}</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="Search messages…" autoFocus />
            <Button onClick={doSearch}>Search</Button>
          </div>
          <div className="mt-2 max-h-96 overflow-auto space-y-2">
            {searchResults.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">{r.sender?.fullName} · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</div>
                {r.content}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Summary Dialog */}
      <Dialog open={!!aiSummary} onOpenChange={(o) => !o && setAiSummary(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" /> AI Channel Summary
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-h-96 overflow-auto whitespace-pre-wrap leading-relaxed">
            {aiSummary}
          </div>
          <DialogFooter>
            <Button onClick={() => setAiSummary(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generated Tasks Dialog */}
      <Dialog open={!!aiTasksCreated} onOpenChange={(o) => !o && setAiTasksCreated(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-accent" /> AI Generated Tasks
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-auto py-2">
            {(aiTasksCreated || []).map((t) => (
              <div key={t.id} className="p-3 rounded-lg border border-border bg-card space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{t.title}</div>
                  <Badge variant="outline" className="text-[10px] uppercase">{t.priority}</Badge>
                </div>
                {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                {t.assignees?.length > 0 && (
                  <div className="text-xs text-primary font-medium mt-1">
                    Assigned to: {t.assignees.map((a) => a.user?.fullName || a.user?.email).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setAiTasksCreated(null); navigate('/app/tasks'); }}>View All Tasks</Button>
            <Button onClick={() => setAiTasksCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit message</DialogTitle></DialogHeader>
          <Textarea value={editing?.content || ''} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="min-h-32" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={async () => { await channelApi.editMessage(channelId, editing.id, editing.content); setEditing(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Members Dialog */}
      <Dialog open={membersModalOpen} onOpenChange={setMembersModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Members of #{channel?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Current Members ({channel?.members?.length || 0})
              </h4>
              <div className="max-h-44 overflow-y-auto space-y-1.5 border rounded-md p-1.5">
                {(channel?.members || []).map((m) => (
                  <div key={m.userId} className="flex items-center justify-between px-2 py-1 rounded-md text-xs hover:bg-accent/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={m.user?.avatarUrl} />
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(m.user?.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.user?.fullName || m.user?.email || 'User'}</span>
                    </div>
                    {m.userId !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMemberFromChannel(m.userId)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Remove member"
                        data-testid={`remove-member-${m.userId}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Add Workspace Members
              </h4>
              <div className="max-h-44 overflow-y-auto space-y-1.5 border rounded-md p-1.5">
                {orgMembers
                  .filter((om) => !(channel?.members || []).some((cm) => cm.userId === om.userId))
                  .map((om) => (
                    <div key={om.userId || om.id} className="flex items-center justify-between px-2 py-1 rounded-md text-xs hover:bg-accent/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={om.user?.avatarUrl} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(om.user?.fullName)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{om.user?.fullName || om.user?.email}</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => addMemberToChannel(om.userId)}
                        className="h-6 px-2 text-[10px]"
                        data-testid={`add-channel-member-btn-${om.userId}`}
                      >
                        + Add
                      </Button>
                    </div>
                  ))}
                {orgMembers.filter((om) => !(channel?.members || []).some((cm) => cm.userId === om.userId)).length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">All workspace members are in this channel</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteMsgModal.open}
        onOpenChange={(open) => setDeleteMsgModal((prev) => ({ ...prev, open }))}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDeleteMessage}
      />

      <ConfirmModal
        open={deleteChanModal}
        onOpenChange={setDeleteChanModal}
        title={`Delete #${channel?.name || 'channel'}`}
        description={`Are you sure you want to delete #${channel?.name}? All messages and channel data will be permanently removed.`}
        confirmText="Delete Channel"
        variant="destructive"
        onConfirm={confirmDeleteChannel}
      />
    </div>
  );
}

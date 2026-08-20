import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { connectSocket, getSocket } from '@/lib/socket';
import { meetingApi, orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, Plus, Sparkles, Video, ExternalLink, X, ShieldAlert, CalendarSync, Ban, FileText, Building2, Users, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import FormattedMarkdown from '@/components/FormattedMarkdown';

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

export default function MeetingsPage() {
  const { currentOrg, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetMeetingId = searchParams.get('meetingId');

  const socket = connectSocket() || getSocket();
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!targetMeetingId) return;
    const match = meetings.find((m) => m.id === targetMeetingId);
    if (match) {
      if (match.status === 'CANCELLED') {
        toast.info(`Meeting Cancelled: "${match.title}"`, {
          description: 'This meeting was cancelled by the organizer.',
        });
        setSearchParams({}, { replace: true });
      } else {
        setDetail(match);
        setSearchParams({}, { replace: true });
      }
    } else if (meetings.length > 0) {
      meetingApi.get(targetMeetingId).then((m) => {
        if (m && m.status !== 'CANCELLED') {
          setDetail(m);
        } else {
          toast.info('Meeting Unavailable', {
            description: m?.status === 'CANCELLED' ? `"${m.title}" was cancelled.` : 'This meeting is no longer available.',
          });
        }
        setSearchParams({}, { replace: true });
      }).catch(() => {
        toast.info('Meeting Not Found', {
          description: 'The requested meeting could not be found or has ended.',
        });
        setSearchParams({}, { replace: true });
      });
    }
  }, [targetMeetingId, meetings, setSearchParams]);
  const jitsiContainerRef = useRef(null);
  const apiRef = useRef(null);

  const [departments, setDepartments] = useState([]);
  const [inviteTab, setInviteTab] = useState('faculty'); // 'faculty' | 'departments'
  const [facultySearch, setFacultySearch] = useState('');

  // Form state for scheduling
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    meetingType: 'INBUILT', // 'INBUILT' | 'EXTERNAL'
    meetingUrl: '',
    attendeeIds: [],
    departmentIds: [],
    teamIds: [],
    agenda: '',
  });

  // Reschedule dialog state
  const [rescheduleData, setRescheduleData] = useState(null); // meeting object
  const [rescheduleForm, setRescheduleForm] = useState({ startTime: '', endTime: '' });

  const [notes, setNotes] = useState('');
  const [summarizing, setSummarizing] = useState(false);

  // Active in-app video call state
  const [activeCall, setActiveCall] = useState(null); // { id, title, url, roomName, domain }
  const [showCallNotes, setShowCallNotes] = useState(false);
  const [callNotesText, setCallNotesText] = useState('');

  const saveCallNotesInActiveCall = async () => {
    if (!activeCall?.id) return;
    try {
      await meetingApi.update(activeCall.id, { notes: callNotesText });
      toast.success('Live notes saved');
      load();
    } catch {
      toast.error('Failed to save notes');
    }
  };

  const summarizeCallNotesInActiveCall = async () => {
    if (!activeCall?.id) return;
    setSummarizing(true);
    try {
      await saveCallNotesInActiveCall();
      const r = await meetingApi.summarize(activeCall.id);
      toast.success('AI Summary generated & saved');
    } catch {
      toast.error('Failed to summarize');
    } finally {
      setSummarizing(false);
    }
  };

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    try { setMeetings(await meetingApi.list(currentOrg.id)); } catch { }
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  // Real-time socket events + Tab focus listener + 30s fallback polling
  useEffect(() => {
    if (!currentOrg?.id) return;

    const handleMeetingEvent = () => {
      load();
    };

    if (socket) {
      socket.on('meeting:updated', handleMeetingEvent);
      socket.on('notification:new', handleMeetingEvent);
    }

    // Lightweight 30s fallback polling (socket handles instant 0ms updates)
    const interval = setInterval(load, 30000);

    // Refresh instantly when user switches back to the tab
    window.addEventListener('focus', load);

    return () => {
      if (socket) {
        socket.off('meeting:updated', handleMeetingEvent);
        socket.off('notification:new', handleMeetingEvent);
      }
      clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [socket, currentOrg?.id, load]);

  const loadDepartments = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      const d = await orgApi.departments(currentOrg.id);
      setDepartments(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error('Failed to load departments:', e);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (currentOrg?.id) {
      orgApi.members(currentOrg.id)
        .then((r) => setMembers(r.map(m => m.user)))
        .catch(() => {});

      loadDepartments();
    }
  }, [currentOrg?.id, loadDepartments]);

  const closeCall = useCallback(() => {
    if (apiRef.current) {
      try {
        apiRef.current.executeCommand('hangup');
        apiRef.current.dispose();
      } catch {}
      apiRef.current = null;
    }
    setActiveCall(null);
    toast.info('Call ended');
  }, []);

  // Load official Jitsi IFrame API & attach hangup/leave event handlers
  useEffect(() => {
    if (!activeCall || !jitsiContainerRef.current) return;

    let isDisposed = false;
    const domain = activeCall.domain || 'meet.element.io';
    const roomName = activeCall.roomName;

    const safeClose = () => {
      if (isDisposed) return;
      isDisposed = true;
      closeCall();
    };

    const loadScript = () => {
      return new Promise((resolve) => {
        if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
        const scriptId = 'jitsi-external-api-script';
        let script = document.getElementById(scriptId);
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = `https://${domain}/external_api.js`;
          script.async = true;
          script.onload = () => resolve(window.JitsiMeetExternalAPI);
          document.body.appendChild(script);
        } else {
          script.onload = () => resolve(window.JitsiMeetExternalAPI);
        }
      });
    };

    loadScript().then((JitsiAPI) => {
      if (isDisposed || !jitsiContainerRef.current || !JitsiAPI) return;

      try {
        const api = new JitsiAPI(domain, {
          roomName: roomName,
          parentNode: jitsiContainerRef.current,
          userInfo: { displayName: user?.fullName || 'Convee Member' },
          configOverwrite: {
            prejoinPageEnabled: false,
            enableClosePage: false,
            enableWelcomePage: false,
            requireDisplayName: false,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            subject: activeCall.title,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        });

        apiRef.current = api;

        api.addEventListener('videoConferenceLeft', safeClose);
        api.addEventListener('videoConferenceEnded', safeClose);
        api.addEventListener('readyToClose', safeClose);
        api.addEventListener('participantKicked', safeClose);
        api.addEventListener('endpointTextMessageReceived', safeClose);
        api.addEventListener('toolbarButtonClicked', (event) => {
          if (
            event?.key === 'hangup' ||
            event?.key === 'end-meeting' ||
            event?.key === 'leave-meeting' ||
            event?.id === 'hangup'
          ) {
            safeClose();
          }
        });
        api.addEventListener('suspendDetected', safeClose);
      } catch (err) {
        console.error('Failed to init Jitsi API:', err);
      }
    });

    const handleWindowMessage = (event) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { data = { text: event.data }; }
        }
        if (
          data?.event === 'videoConferenceLeft' ||
          data?.event === 'readyToClose' ||
          data?.event === 'toolbarButtonClicked' ||
          data?.type === 'hangup' ||
          data?.type === 'videoConferenceLeft' ||
          data?.name === 'videoConferenceLeft' ||
          data?.name === 'readyToClose' ||
          (typeof data === 'string' && (data.includes('hangup') || data.includes('videoConferenceLeft') || data.includes('readyToClose')))
        ) {
          safeClose();
        }
      } catch {}
    };
    window.addEventListener('message', handleWindowMessage);

    return () => {
      isDisposed = true;
      window.removeEventListener('message', handleWindowMessage);
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch {}
        apiRef.current = null;
      }
    };
  }, [activeCall, closeCall, user?.fullName]);

  const getMinDateTime = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const submit = async () => {
    try {
      const start = new Date(form.startTime);
      const end = new Date(form.endTime);
      const now = new Date();
      const nowWithBuffer = new Date(now.getTime() - 60000);

      if (start < nowWithBuffer) {
        toast.error('Meeting start time cannot be in the past. Please select a future date and time.');
        return;
      }
      if (end <= start) {
        toast.error('Meeting end time must be after the start time.');
        return;
      }

      let finalUrl = form.meetingUrl;
      if (form.meetingType === 'INBUILT') {
        const titleSlug = form.title.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 25) || 'meeting';
        const cleanOrgId = currentOrg.id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6);
        const randomHash = Math.random().toString(36).substring(2, 6);
        const roomName = `convee_${titleSlug}_${cleanOrgId}_${randomHash}`;
        const jitsiDomain = process.env.REACT_APP_JITSI_DOMAIN || 'meet.element.io';
        finalUrl = `https://${jitsiDomain}/${roomName}`;
      }

      await meetingApi.create({
        orgId: currentOrg.id,
        title: form.title,
        description: form.description,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        location: form.meetingType === 'INBUILT' ? 'In-Built Convee Video Call' : 'External Link',
        meetingUrl: finalUrl,
        attendeeIds: form.attendeeIds,
        departmentIds: form.departmentIds,
        teamIds: form.teamIds,
        agenda: form.agenda,
      });

      toast.success('Meeting scheduled');
      setOpenCreate(false);
      setForm({ title: '', description: '', startTime: '', endTime: '', meetingType: 'INBUILT', meetingUrl: '', attendeeIds: [], departmentIds: [], teamIds: [], agenda: '' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to schedule meeting');
    }
  };

  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const confirmCancelMeeting = async () => {
    if (!cancelConfirmId) return;
    const meetingId = cancelConfirmId;
    setCancelConfirmId(null);
    try {
      await meetingApi.update(meetingId, { status: 'CANCELLED' });
      toast.success('Meeting cancelled & attendees notified');
      if (detail?.id === meetingId) {
        setDetail((d) => (d ? { ...d, status: 'CANCELLED' } : null));
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to cancel meeting');
    }
  };

  const openReschedule = (m) => {
    setRescheduleData(m);
    setRescheduleForm({
      startTime: m.startTime ? new Date(m.startTime).toISOString().slice(0, 16) : '',
      endTime: m.endTime ? new Date(m.endTime).toISOString().slice(0, 16) : '',
    });
  };

  const saveReschedule = async () => {
    if (!rescheduleData) return;
    try {
      const start = new Date(rescheduleForm.startTime);
      const end = new Date(rescheduleForm.endTime);
      const now = new Date();
      const nowWithBuffer = new Date(now.getTime() - 60000);

      if (start < nowWithBuffer) {
        toast.error('Rescheduled meeting start time cannot be in the past. Please select a future date and time.');
        return;
      }
      if (end <= start) {
        toast.error('Rescheduled meeting end time must be after the start time.');
        return;
      }

      await meetingApi.update(rescheduleData.id, {
        startTime: rescheduleForm.startTime,
        endTime: rescheduleForm.endTime,
        status: 'SCHEDULED',
      });
      toast.success('Meeting rescheduled & attendees notified');
      setRescheduleData(null);
      if (detail?.id === rescheduleData.id) {
        setDetail(null);
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to reschedule meeting');
    }
  };

  const endMeeting = async (meetingId) => {
    try {
      await meetingApi.update(meetingId, { status: 'COMPLETED' });
      toast.success('Meeting ended & moved to Past');
      if (detail?.id === meetingId) setDetail(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to end meeting');
    }
  };

  const openDetail = async (m) => {
    try {
      const d = await meetingApi.get(m.id);
      setDetail(d);
      setNotes(d.notes || '');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to open meeting details');
    }
  };

  const saveNotes = async () => {
    if (!detail) return;
    try {
      await meetingApi.update(detail.id, { notes });
      toast.success('Notes saved');
      load();
    } catch {
      toast.error('Failed to save notes');
    }
  };

  const summarize = async () => {
    if (!detail) return;
    setSummarizing(true);
    try {
      const r = await meetingApi.summarize(detail.id);
      setDetail({ ...detail, aiSummary: r.summary });
      toast.success('AI summary ready');
    } catch {
      toast.error('Failed to summarize');
    } finally {
      setSummarizing(false);
    }
  };

  const startInAppCall = (meeting) => {
    if (!meeting.meetingUrl) return;

    // Always use unmoderated global server meet.element.io
    const domain = process.env.REACT_APP_JITSI_DOMAIN || 'meet.element.io';

    let rawRoom = 'meeting';
    try {
      const u = new URL(meeting.meetingUrl);
      rawRoom = u.pathname.replace(/^\//, '').split('#')[0];
    } catch {}

    let cleanRoom = rawRoom.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanRoom.startsWith('convee_')) {
      cleanRoom = `convee_${cleanRoom}_${meeting.id.replace(/[^a-z0-9]/gi, '').slice(0, 6)}`;
    }

    setCallNotesText(meeting.notes || '');
    setShowCallNotes(false);

    setActiveCall({
      id: meeting.id,
      title: meeting.title,
      url: `https://${domain}/${cleanRoom}`,
      domain: domain,
      roomName: cleanRoom,
    });
  };

  const isJitsiMeeting = (url) => !!(url && (url.includes('jit.si') || url.includes('8x8.vc') || url.includes('freifunk') || url.includes('element.io') || url.includes('meet.')));

  const now = new Date();
  const oneHourAgo = new Date(Date.now() - 3600000); // 1 hour ago
  const oneDayAgo = new Date(Date.now() - 24 * 3600000); // 24 hours ago

  // Active Meetings: Status is NOT CANCELLED and NOT COMPLETED.
  // Stays in Active if scheduled end time is in future OR if user is currently in active call for this meeting.
  const upcoming = meetings.filter((m) => {
    if (m.status === 'CANCELLED' || m.status === 'COMPLETED') return false;
    const end = m.endTime ? new Date(m.endTime) : new Date(m.startTime);
    const isCurrentlyInCall = activeCall?.id === m.id;
    return end >= now || isCurrentlyInCall;
  });

  // Past / Concluded Meetings: Status is COMPLETED OR scheduled end time passed (and not currently in call)
  const past = meetings.filter((m) => {
    if (m.status === 'CANCELLED') return false;
    if (m.status === 'COMPLETED') return true;
    const end = m.endTime ? new Date(m.endTime) : new Date(m.startTime);
    const isCurrentlyInCall = activeCall?.id === m.id;
    return end < now && !isCurrentlyInCall;
  });

  // Cancelled Meetings
  const cancelled = meetings.filter((m) => {
    if (m.status !== 'CANCELLED') return false;
    const cancelledTime = m.updatedAt ? new Date(m.updatedAt) : new Date(m.startTime);
    return cancelledTime >= oneHourAgo;
  });

  const isStudent = currentOrg?.role === 'STUDENT';

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="meetings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Meetings</h1>
          <p className="text-muted-foreground">Schedule in-app HD video calls or external meetings with attendees-only access.</p>
        </div>
        {!isStudent && (
          <Button onClick={() => { loadDepartments(); setOpenCreate(true); }} data-testid="new-meeting-btn">
            <Plus className="h-4 w-4 mr-1" /> New meeting
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active / Upcoming Meetings */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Active & Scheduled Meetings ({upcoming.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {upcoming.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No active or upcoming meetings assigned to you</div>}
              {upcoming.map((m) => {
                const isJitsi = isJitsiMeeting(m.meetingUrl);
                const isCancelled = m.status === 'CANCELLED';
                const isOrganizer = m.createdById === user?.id || ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentOrg?.role);

                const startTime = new Date(m.startTime);
                const endTime = m.endTime ? new Date(m.endTime) : null;
                const canJoinNow = now >= startTime; // Enabled ONLY if start time has arrived or passed
                const isOvertime = endTime && now > endTime;

                return (
                  <div key={m.id} className="p-4 hover:bg-muted/30 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button onClick={() => openDetail(m)} className={`text-left font-medium text-base hover:text-primary transition-colors ${isCancelled ? 'line-through opacity-70' : ''}`}>
                          {m.title}
                        </button>
                        {isCancelled && (
                          <span className="ml-2 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                            CANCELLED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isOvertime && (
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold bg-amber-500/10 text-amber-400 border-amber-500/30">
                            Overtime / Active
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${isJitsi ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                          {isJitsi ? 'In-Built Video' : 'External'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {format(startTime, 'PPPp')}
                        {endTime ? ` – ${format(endTime, 'p')}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex -space-x-2">
                        {m.attendees?.slice(0, 5).map((a) => (
                          <Avatar key={a.id} className="h-6 w-6 border-2 border-card">
                            <AvatarImage src={a.user?.avatarUrl} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(a.user?.fullName)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openDetail(m)}>Details</Button>

                        {isOrganizer && !isCancelled && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 text-xs px-2" title="Reschedule" onClick={() => openReschedule(m)}>
                              <CalendarSync className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10" title="End & Conclude Meeting" onClick={() => endMeeting(m.id)}>
                              End Meeting
                            </Button>
                            <Button size="sm" variant="destructive" className="h-8 text-xs px-2" title="Cancel Meeting" onClick={() => setCancelConfirmId(m.id)}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}

                        {!isCancelled && (
                          canJoinNow ? (
                            isJitsi ? (
                              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm" onClick={() => startInAppCall(m)}>
                                <Video className="h-3.5 w-3.5 mr-1" /> Join Call
                              </Button>
                            ) : (
                              m.meetingUrl && (
                                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                                  <a href={m.meetingUrl} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Join Link
                                  </a>
                                </Button>
                              )
                            )
                          ) : (
                            <Button
                              size="sm"
                              disabled
                              className="h-8 text-xs bg-purple-600/20 text-purple-300 opacity-60 cursor-not-allowed border border-purple-500/20"
                              title={`Starts at ${format(startTime, 'p')}`}
                            >
                              <Clock className="h-3.5 w-3.5 mr-1 text-purple-400" /> Starts at {format(startTime, 'p')}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Past Meetings */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Past ({past.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {past.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No past meetings</div>}
              {past.map((m) => (
                <button key={m.id} onClick={() => openDetail(m)} className="w-full text-left p-4 hover:bg-muted/50 transition-colors">
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2"><Clock className="h-3 w-3" /> {format(new Date(m.startTime), 'PPPp')}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancelled Meetings Section */}
      {cancelled.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-red-400 flex items-center gap-2">
              <Ban className="h-4 w-4" /> Cancelled Meetings ({cancelled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {cancelled.map((m) => (
                <button key={m.id} onClick={() => openDetail(m)} className="w-full text-left p-4 hover:bg-red-500/10 transition-colors flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-muted-foreground line-through">{m.title}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-red-400/70" /> {format(new Date(m.startTime), 'PPPp')}
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">
                    CANCELLED
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Meeting Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-xl">Schedule a meeting</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Meeting Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, meetingType: 'INBUILT' })}
                  className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                    form.meetingType === 'INBUILT'
                      ? 'border-purple-500 bg-purple-500/10 text-purple-300 font-medium'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Video className="h-5 w-5 text-purple-400" />
                  <div>
                    <div className="text-sm font-semibold">In-Built Video Call</div>
                    <div className="text-[11px] opacity-80">Jitsi HD Video call inside Convee</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, meetingType: 'EXTERNAL' })}
                  className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                    form.meetingType === 'EXTERNAL'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300 font-medium'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <ExternalLink className="h-5 w-5 text-blue-400" />
                  <div>
                    <div className="text-sm font-semibold">External Link</div>
                    <div className="text-[11px] opacity-80">Google Meet, Zoom, Teams URL</div>
                  </div>
                </button>
              </div>
            </div>

            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sprint planning / Architecture sync" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start *</Label><Input type="datetime-local" min={getMinDateTime()} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div><Label>End *</Label><Input type="datetime-local" min={form.startTime || getMinDateTime()} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            </div>

            {form.meetingType === 'EXTERNAL' && (
              <div>
                <Label>Meeting Link URL *</Label>
                <Input value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} placeholder="https://meet.google.com/abc-defg-hij" />
              </div>
            )}

            <div><Label>Agenda</Label><Textarea rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} placeholder="Key discussion points..." /></div>

            {/* Dual Invite Section: Faculty & Staff vs Departments & Class Sections */}
            <div className="space-y-2 border border-border/80 rounded-xl p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs text-foreground">Invite Attendees & Groups</Label>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>Selected:</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-semibold">
                    {form.attendeeIds.length} Faculty • {form.departmentIds.length} Depts • {form.teamIds.length} Classes
                  </Badge>
                </div>
              </div>

              {/* Tab Selector Buttons */}
              <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/80">
                <button
                  type="button"
                  onClick={() => setInviteTab('faculty')}
                  className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    inviteTab === 'faculty' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 text-purple-400" />
                  <span>Faculty & Staff ({form.attendeeIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteTab('departments')}
                  className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    inviteTab === 'departments' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Depts & Classes ({form.departmentIds.length + form.teamIds.length})</span>
                </button>
              </div>

              {/* TAB 1: Faculty / Staff Individual Selection */}
              {inviteTab === 'faculty' && (
                <div className="space-y-2 pt-1">
                  <Input
                    placeholder="Search faculty by name or email..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <div className="max-h-44 overflow-y-auto border border-border/80 rounded-lg p-2 space-y-1 bg-background">
                    {members
                      .filter((m) => {
                        if (!facultySearch.trim()) return true;
                        const q = facultySearch.toLowerCase();
                        return (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
                      })
                      .map((m) => (
                        <label key={m.id} className="flex items-center justify-between p-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={form.attendeeIds.includes(m.id) || m.id === user?.id}
                              disabled={m.id === user?.id}
                              onCheckedChange={(c) =>
                                setForm((f) => ({
                                  ...f,
                                  attendeeIds: c ? [...f.attendeeIds, m.id] : f.attendeeIds.filter((x) => x !== m.id),
                                }))
                              }
                            />
                            <span className="font-medium text-foreground">{m.fullName}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{m.id === user?.id ? '(You - Organizer)' : m.email}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 2: Departments & Class Sections Group Selection */}
              {inviteTab === 'departments' && (
                <div className="max-h-48 overflow-y-auto border border-border/80 rounded-lg p-2 space-y-2 bg-background pt-1">
                  {departments.map((dept) => {
                    const isDeptSelected = form.departmentIds.includes(dept.id);
                    const deptTeams = dept.teams || [];

                    return (
                      <div key={dept.id} className="border border-border/60 rounded-md p-2 bg-muted/10 space-y-1.5">
                        {/* Whole Department Checkbox */}
                        <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-md">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                            <Checkbox
                              checked={isDeptSelected}
                              onCheckedChange={(c) =>
                                setForm((f) => ({
                                  ...f,
                                  departmentIds: c ? [...f.departmentIds, dept.id] : f.departmentIds.filter((x) => x !== dept.id),
                                }))
                              }
                            />
                            <Building2 className="h-3.5 w-3.5 text-blue-400" />
                            <span>Entire Department: {dept.name}</span>
                          </label>
                          <Badge variant="outline" className="text-[10px]">
                            {isDeptSelected ? 'Whole Dept' : `${deptTeams.length} Classes`}
                          </Badge>
                        </div>

                        {/* Individual Class Sections */}
                        {deptTeams.length > 0 && (
                          <div className="pl-5 space-y-1 pt-0.5">
                            {deptTeams.map((team) => {
                              const isTeamSelected = form.teamIds.includes(team.id);

                              return (
                                <label key={team.id} className="flex items-center justify-between p-1 rounded hover:bg-muted/40 cursor-pointer text-xs">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={isDeptSelected || isTeamSelected}
                                      disabled={isDeptSelected}
                                      onCheckedChange={(c) =>
                                        setForm((f) => ({
                                          ...f,
                                          teamIds: c ? [...f.teamIds, team.id] : f.teamIds.filter((x) => x !== team.id),
                                        }))
                                      }
                                    />
                                    <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                                    <span>Class: {team.name}</span>
                                  </div>
                                  {isDeptSelected && <span className="text-[10px] text-muted-foreground italic">(Included via Dept)</span>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {departments.length === 0 && (
                    <div className="p-3 text-xs text-muted-foreground text-center">No departments found in organization</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={!form.title || !form.startTime || !form.endTime || (form.meetingType === 'EXTERNAL' && !form.meetingUrl)}
            >
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Meeting Dialog */}
      <Dialog open={!!rescheduleData} onOpenChange={(o) => !o && setRescheduleData(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <CalendarSync className="h-5 w-5 text-primary" /> Reschedule Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Rescheduling <strong className="text-foreground">{rescheduleData?.title}</strong>. All attendees will be notified of the updated time.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>New Start Time *</Label>
                <Input
                  type="datetime-local"
                  min={getMinDateTime()}
                  value={rescheduleForm.startTime}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label>New End Time *</Label>
                <Input
                  type="datetime-local"
                  min={rescheduleForm.startTime || getMinDateTime()}
                  value={rescheduleForm.endTime}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleData(null)}>Cancel</Button>
            <Button onClick={saveReschedule} disabled={!rescheduleForm.startTime || !rescheduleForm.endTime}>
              Save & Notify Attendees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Themed Confirmation Dialog for Cancel Meeting */}
      <Dialog open={!!cancelConfirmId} onOpenChange={(o) => !o && setCancelConfirmId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2 text-red-500">
              <Ban className="h-5 w-5" /> Cancel Meeting Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to cancel this meeting? All invited attendees will receive a cancellation notification.
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setCancelConfirmId(null)}>
              Keep Meeting
            </Button>
            <Button variant="destructive" onClick={confirmCancelMeeting}>
              Yes, Cancel Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <span>{detail?.title}</span>
              {detail?.status === 'CANCELLED' && (
                <Badge variant="destructive" className="text-xs">CANCELLED</Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {(() => {
              const isEnded = detail?.status === 'COMPLETED';
              const isCancelled = detail?.status === 'CANCELLED';
              const isOrganizer = detail?.createdById === user?.id || ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER'].includes(currentOrg?.role);

              const detailStart = detail?.startTime ? new Date(detail.startTime) : null;
              const canJoinDetail = detailStart && now >= detailStart;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>
                        {detail?.startTime && format(new Date(detail.startTime), 'PPPp')}
                        {detail?.endTime ? ` – ${format(new Date(detail.endTime), 'p')}` : ''}
                      </span>
                    </div>
                    {isCancelled ? (
                      <span className="text-xs text-red-400 font-medium">This meeting has been cancelled.</span>
                    ) : isEnded ? (
                      <Badge variant="secondary" className="text-xs font-semibold bg-muted text-muted-foreground border-border">
                        Meeting Ended
                      </Badge>
                    ) : canJoinDetail ? (
                      detail?.meetingUrl && (
                        isJitsiMeeting(detail.meetingUrl) ? (
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold" onClick={() => { setDetail(null); startInAppCall(detail); }}>
                            <Video className="h-3.5 w-3.5 mr-1.5" /> Join In-App Video Call
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <a href={detail.meetingUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Meeting Link
                            </a>
                          </Button>
                        )
                      )
                    ) : (
                      <Button size="sm" disabled className="bg-purple-600/20 text-purple-300 opacity-60 cursor-not-allowed border border-purple-500/20">
                        <Clock className="h-3.5 w-3.5 mr-1.5 text-purple-400" /> Starts at {detailStart ? format(detailStart, 'p') : 'Scheduled Time'}
                      </Button>
                    )}
                  </div>

                  {/* Organizer Controls - Only show for Active Meetings */}
                  {isOrganizer && !isEnded && !isCancelled && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 flex-wrap">
                      <span className="text-xs font-semibold text-primary">Organizer Options:</span>
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openReschedule(detail)}>
                          <CalendarSync className="h-3.5 w-3.5 mr-1" /> Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
                          title="Conclude meeting for all participants and move to Past"
                          onClick={() => endMeeting(detail.id)}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" /> End for All
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs text-muted-foreground" onClick={() => setCancelConfirmId(detail.id)}>
                          Cancel Meeting
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {detail?.agenda && (
              <div>
                <div className="text-xs text-muted-foreground font-medium mb-1 uppercase tracking-wide">Agenda</div>
                <div className="text-sm whitespace-pre-wrap rounded-md border border-border p-3 bg-card">{detail.agenda}</div>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide flex items-center justify-between">
                <span>Attendees ({detail?.attendees?.length || 0})</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Private to attendees</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail?.attendees?.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs bg-card">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={a.user?.avatarUrl} />
                      <AvatarFallback className="text-[8px]">{initials(a.user?.fullName)}</AvatarFallback>
                    </Avatar>
                    <span>{a.user?.fullName}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground font-medium mb-1 uppercase tracking-wide">Shared Meeting Notes</div>
              <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Take meeting notes..." />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={saveNotes}>Save notes</Button>
                <Button size="sm" variant="outline" onClick={summarize} disabled={summarizing}>
                  <Sparkles className="h-4 w-4 mr-1 text-accent" /> {summarizing ? 'Summarizing...' : 'AI summarize'}
                </Button>
              </div>
            </div>

            {detail?.aiSummary && (
              <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs uppercase text-accent font-semibold">
                  <Sparkles className="h-4 w-4" /> AI Summary & Decision Notes
                </div>
                <div className="text-sm leading-relaxed">
                  <FormattedMarkdown content={detail.aiSummary} />
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* In-App Jitsi Video Call Full-Screen Modal Overlay using Official Jitsi External API */}
      {activeCall && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="h-14 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">{activeCall.title}</h3>
                <p className="text-[11px] text-slate-400">Convee In-App HD Video Call · End-to-end encrypted</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className={`font-semibold border-purple-500/40 text-xs ${
                  showCallNotes
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-purple-950/40 text-purple-300 hover:bg-purple-900/50 hover:text-white'
                }`}
                onClick={() => setShowCallNotes(!showCallNotes)}
              >
                <FileText className="h-4 w-4 mr-1.5" /> {showCallNotes ? 'Hide Live Notes' : '📝 Live Notes'}
              </Button>
              <Button variant="destructive" size="sm" className="font-semibold px-4 text-xs" onClick={closeCall}>
                <X className="h-4 w-4 mr-1.5" /> Leave Call
              </Button>
            </div>
          </div>

          {/* Call Container + Live Notes Side Panel */}
          <div className="flex-1 w-full h-full bg-black relative flex overflow-hidden">
            {/* Jitsi API Container Node */}
            <div ref={jitsiContainerRef} className="flex-1 w-full h-full bg-black relative" />

            {/* Live Notes Side Panel */}
            {showCallNotes && (
              <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 p-4 flex flex-col justify-between text-white z-20 shadow-2xl animate-in slide-in-from-right duration-200">
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 font-semibold text-sm text-purple-300">
                      <FileText className="h-4 w-4 text-purple-400" /> Live Meeting Notes
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setShowCallNotes(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400">Notes typed here are saved for all meeting attendees in real-time.</p>
                  <Textarea
                    rows={14}
                    value={callNotesText}
                    onChange={(e) => setCallNotesText(e.target.value)}
                    placeholder="Type live meeting notes during the call..."
                    className="flex-1 bg-slate-950 border-slate-800 text-slate-200 text-sm focus-visible:ring-purple-500 resize-none"
                  />
                </div>
                <div className="pt-3 border-t border-slate-800 flex gap-2 mt-2">
                  <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 font-semibold" onClick={saveCallNotesInActiveCall}>
                    Save Notes
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={summarizeCallNotesInActiveCall} disabled={summarizing}>
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-400" /> {summarizing ? 'Summarizing...' : 'AI'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}

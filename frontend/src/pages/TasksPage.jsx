import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { connectSocket, getSocket } from '@/lib/socket';
import { taskApi, orgApi, userApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { Plus, ListTodo, LayoutGrid, Calendar as CalIcon, Circle, CircleDot, CheckCircle2, XCircle, AlertOctagon, EyeOff, Filter, X, Clock, Check, Send, RotateCcw, FileCheck, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

const STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED'];
const STATUS_CFG = {
  TODO: { label: 'To do', color: 'bg-slate-400', icon: Circle },
  IN_PROGRESS: { label: 'In progress', color: 'bg-primary', icon: CircleDot },
  REVIEW: { label: 'In review', color: 'bg-amber-500', icon: EyeOff },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  BLOCKED: { label: 'Blocked', color: 'bg-destructive', icon: AlertOctagon },
  CANCELLED: { label: 'Cancelled', color: 'bg-muted-foreground', icon: XCircle },
};
const PRIORITY_CFG = {
  LOW: { label: 'Low', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  HIGH: { label: 'High', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  URGENT: { label: 'Urgent', color: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

function TaskCard({ task, onOpen, isDragging }) {
  const { setNodeRef, transform, transition, isDragging: dragging, attributes, listeners } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={`group rounded-lg border border-border bg-card p-3 cursor-pointer hover:border-primary/50 transition-colors ${dragging ? 'opacity-40' : ''}`}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-balance leading-snug flex-1">{task.title}</div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_CFG[task.priority]?.color || ''}`}>{PRIORITY_CFG[task.priority]?.label || task.priority}</Badge>
      </div>
      {task.project && <div className="mt-1 text-xs text-muted-foreground">{task.project.name}</div>}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {task.assignees.slice(0, 3).map((a) => (
            <Avatar key={a.id} className="h-6 w-6 border-2 border-card">
              <AvatarImage src={a.user?.avatarUrl} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(a.user?.fullName)}</AvatarFallback>
            </Avatar>
          ))}
          {task.assignees.length > 3 && <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px]">+{task.assignees.length - 3}</div>}
        </div>
        {task.dueDate && <div className="text-xs text-muted-foreground">{format(new Date(task.dueDate), 'MMM d')}</div>}
      </div>
    </div>
  );
}

function KanbanColumn({ status, tasks, onOpen }) {
  const cfg = STATUS_CFG[status];
  const { setNodeRef } = useSortable({ id: `col-${status}`, disabled: true });
  return (
    <div className="w-72 flex-shrink-0 flex flex-col rounded-lg border border-border bg-secondary/30" data-testid={`kanban-column-${status}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className={`h-2 w-2 rounded-full ${cfg.color}`} />
        <div className="font-medium text-sm">{cfg.label}</div>
        <Badge variant="secondary" className="ml-auto text-[10px]">{tasks.length}</Badge>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy} id={status}>
        <div ref={setNodeRef} data-status={status} className="flex-1 overflow-auto p-2 space-y-2 min-h-32">
          {tasks.map((t) => <TaskCard key={t.id} task={t} onOpen={onOpen} />)}
          {tasks.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Drop tasks here</div>}
        </div>
      </SortableContext>
    </div>
  );
}

export default function TasksPage() {
  const { currentOrg, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { taskId: routeTaskId } = useParams();
  const targetTaskId = routeTaskId || searchParams.get('taskId');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState(null);

  useEffect(() => {
    if (!targetTaskId) return;
    const match = tasks.find((t) => t.id === targetTaskId);
    if (match) {
      setOpenDetail(match);
      if (searchParams.has('taskId')) setSearchParams({}, { replace: true });
    } else if (tasks.length > 0) {
      taskApi.get(targetTaskId).then((t) => {
        if (t) setOpenDetail(t);
        if (searchParams.has('taskId')) setSearchParams({}, { replace: true });
      }).catch(() => {
        if (searchParams.has('taskId')) setSearchParams({}, { replace: true });
      });
    }
  }, [targetTaskId, tasks, searchParams, setSearchParams]);
  const [filterProject, setFilterProject] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const [selectedDate, setSelectedDate] = useState(new Date());

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const params = {};
      if (filterProject !== 'all') params.projectId = filterProject;
      if (filterAssignee === 'me') params.assignee = 'me';
      else if (filterAssignee !== 'all') params.assignee = filterAssignee;
      const t = await taskApi.list(currentOrg.id, params);
      const regularTasksOnly = (t || []).filter((task) => !task.metadata?.isHomework);
      setTasks(regularTasksOnly);
    } catch (e) { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [currentOrg?.id, filterProject, filterAssignee]);

  useEffect(() => { load(); }, [load]);

  // Real-time socket events + Window focus listener
  useEffect(() => {
    if (!currentOrg?.id) return;
    const socket = connectSocket() || getSocket();

    const handleTaskEvent = () => {
      load();
    };

    if (socket) {
      socket.on('task:updated', handleTaskEvent);
      socket.on('notification:new', handleTaskEvent);
    }

    window.addEventListener('focus', load);

    return () => {
      if (socket) {
        socket.off('task:updated', handleTaskEvent);
        socket.off('notification:new', handleTaskEvent);
      }
      window.removeEventListener('focus', load);
    };
  }, [currentOrg?.id, load]);
  const [rawMembers, setRawMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', projectId: '', assigneeIds: [], checklist: '', isHomework: false, selectedClassTeamIds: [] });

  useEffect(() => {
    if (!currentOrg?.id) return;
    (async () => {
      try {
        const [p, m, d] = await Promise.all([
          orgApi.projects(currentOrg.id),
          orgApi.members(currentOrg.id),
          orgApi.departments(currentOrg.id).catch(() => []),
        ]);
        setProjects(p || []);
        setRawMembers(m || []);
        setDepartments(d || []);

        // Filter out STUDENT role for normal staff task assignees list
        const staffOnly = (m || []).filter((mm) => mm.role !== 'STUDENT').map((mm) => ({ ...mm.user, role: mm.role }));
        setMembers(staffOnly);
      } catch { }
    })();
  }, [currentOrg?.id]);

  const allTeams = useMemo(() => {
    const teamsList = [];
    departments.forEach((d) => {
      (d.teams || []).forEach((t) => {
        teamsList.push({
          ...t,
          deptName: d.name,
        });
      });
    });
    return teamsList;
  }, [departments]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(STATUSES.map((s) => [s, []]));
    tasks.forEach((t) => { if (g[t.status]) g[t.status].push(t); });
    return g;
  }, [tasks]);

  const myClassTeams = useMemo(() => {
    if (['DIRECTOR', 'ADMIN', 'PRINCIPAL'].includes(currentOrg?.role)) {
      return allTeams;
    }
    return allTeams.filter((t) => {
      if (t.managerId === user?.id) return true;
      if (t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)) return true;
      return false;
    });
  }, [allTeams, user?.id, currentOrg?.role]);

  const submit = async () => {
    try {
      const payload = {
        orgId: currentOrg.id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        projectId: form.projectId || null,
        assigneeIds: form.isHomework ? [] : form.assigneeIds,
        checklist: form.checklist ? form.checklist.split('\n').filter(Boolean) : [],
        isHomework: form.isHomework,
        classTeamIds: form.isHomework ? form.selectedClassTeamIds : [],
      };
      await taskApi.create(payload);
      toast.success(form.isHomework ? 'Homework assigned to class students! 📚' : 'Task created');
      setOpenCreate(false);
      setForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', projectId: '', assigneeIds: [], checklist: '', isHomework: false, selectedClassTeamIds: [] });
      await load();
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };

  const handleDragEnd = async (e) => {
    const { active, over } = e;
    setActiveDragId(null);
    if (!over) return;
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;
    if (activeTask.status === 'CANCELLED') {
      toast.error('Cancelled tasks are fixed and cannot be moved.');
      return;
    }
    let targetStatus = null;
    if (STATUSES.includes(over.id) || String(over.id).startsWith('col-')) {
      targetStatus = String(over.id).replace('col-', '');
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }
    if (!targetStatus || targetStatus === activeTask.status) return;
    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? { ...t, status: targetStatus } : t)));
    try { await taskApi.update(activeTask.id, { status: targetStatus }); } catch (err) { toast.error(err?.response?.data?.error || 'Failed'); load(); }
  };

  const daysWithTasks = useMemo(() => {
    const m = new Map();
    tasks.forEach((t) => {
      if (t.dueDate) {
        const d = format(new Date(t.dueDate), 'yyyy-MM-dd');
        m.set(d, (m.get(d) || 0) + 1);
      }
    });
    return m;
  }, [tasks]);

  const tasksOnDate = tasks.filter((t) => t.dueDate && format(new Date(t.dueDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col" data-testid="tasks-page">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Tasks</h1>
          <p className="text-xs text-muted-foreground">Manage work across projects and teams</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              <SelectItem value="me">Me</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setOpenCreate(true)} data-testid="new-task-btn"><Plus className="h-4 w-4 mr-1" /> New task</Button>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2">
          <TabsList data-testid="tasks-tabs">
            <TabsTrigger value="kanban"><LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban</TabsTrigger>
            <TabsTrigger value="list"><ListTodo className="h-3.5 w-3.5 mr-1" /> List</TabsTrigger>
            <TabsTrigger value="calendar"><CalIcon className="h-3.5 w-3.5 mr-1" /> Calendar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban" className="flex-1 overflow-hidden mt-0 p-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveDragId(e.active.id)} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto h-full pb-2">
              {STATUSES.map((s) => <KanbanColumn key={s} status={s} tasks={grouped[s]} onOpen={setOpenDetail} />)}
            </div>
            <DragOverlay>{activeDragId ? (() => { const t = tasks.find((x) => x.id === activeDragId); return t ? <div className="w-72"><TaskCard task={t} onOpen={() => { }} /></div> : null; })() : null}</DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="list" className="flex-1 overflow-auto mt-0 p-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Assignees</th>
                    <th className="px-3 py-2 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} onClick={() => setOpenDetail(t)} className="cursor-pointer hover:bg-muted/50 border-b border-border" data-testid={`task-list-row-${t.id}`}>
                      <td className="px-3 py-2 font-medium">{t.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.project?.name || '—'}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={`text-[10px] ${PRIORITY_CFG[t.priority]?.color}`}>{PRIORITY_CFG[t.priority]?.label}</Badge></td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] uppercase">{t.status.replace('_',' ')}</Badge></td>
                      <td className="px-3 py-2"><div className="flex -space-x-2">{t.assignees.slice(0,3).map((a) => <Avatar key={a.id} className="h-6 w-6 border-2 border-card"><AvatarImage src={a.user?.avatarUrl}/><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(a.user?.fullName)}</AvatarFallback></Avatar>)}</div></td>
                      <td className="px-3 py-2 text-muted-foreground">{t.dueDate ? format(new Date(t.dueDate), 'MMM d') : '—'}</td>
                    </tr>
                  ))}
                  {tasks.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No tasks yet</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 overflow-auto mt-0 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardContent className="p-3">
                <CalendarComp mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} modifiers={{ hasTask: (d) => daysWithTasks.has(format(d, 'yyyy-MM-dd')) }} modifiersClassNames={{ hasTask: 'bg-primary/20 rounded-full' }} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Tasks on {format(selectedDate, 'PPPP')}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {tasksOnDate.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks scheduled for this day</div>}
                  {tasksOnDate.map((t) => (
                    <button key={t.id} onClick={() => setOpenDetail(t)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left">
                      <div className={`h-2 w-2 rounded-full ${STATUS_CFG[t.status].color}`} />
                      <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{t.title}</div><div className="text-xs text-muted-foreground">{t.project?.name} · {t.priority}</div></div>
                      <Badge variant="outline" className="text-[10px] uppercase">{t.status.replace('_',' ')}</Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create task dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pr-6 pb-1">
            <DialogTitle className="text-lg font-bold font-display">Create task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-1">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" data-testid="task-title-input" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Add details…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['LOW','MEDIUM','HIGH','URGENT'].map((p) => <SelectItem key={p} value={p}>{PRIORITY_CFG[p]?.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Due date</Label><Input type="date" min={new Date().toISOString().split('T')[0]} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            </div>
            <div>
              <Label>Project</Label>
              <Select value={form.projectId || 'none'} onValueChange={(v) => setForm({ ...form, projectId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignees</Label>
              <div className="max-h-32 overflow-auto border border-border rounded-md p-2 space-y-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.assigneeIds.includes(m.id)} onCheckedChange={(checked) => setForm((f) => ({ ...f, assigneeIds: checked ? [...f.assigneeIds, m.id] : f.assigneeIds.filter((x) => x !== m.id) }))} />
                    <Avatar className="h-6 w-6"><AvatarImage src={m.avatarUrl}/><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(m.fullName)}</AvatarFallback></Avatar>
                    {m.fullName} <span className="text-xs text-muted-foreground">({m.email})</span>
                  </label>
                ))}
                {members.length === 0 && <div className="text-xs text-muted-foreground">No faculty/staff members found</div>}
              </div>
            </div>
            <div><Label>Checklist (one per line)</Label><Textarea rows={3} value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} placeholder={'Item 1\nItem 2'} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.title.trim()} data-testid="task-create-submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetail task={openDetail} onClose={() => setOpenDetail(null)} onSaved={load} />
    </motion.div>
  );
}

function TaskDetail({ task, onClose, onSaved }) {
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('TODO');
  const [extModalOpen, setExtModalOpen] = useState(false);
  const [extReason, setExtReason] = useState('');
  const [extDate, setExtDate] = useState('');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [selectedAssigneeForChanges, setSelectedAssigneeForChanges] = useState(null);
  const [changesFeedback, setChangesFeedback] = useState('Please revise the implementation.');

  const load = useCallback(async () => {
    if (!task?.id) return;
    try {
      const d = await taskApi.get(task.id);
      setDetail(d);
      setStatus(d.status);
    } catch { }
  }, [task?.id]);

  useEffect(() => { load(); }, [load]);

  if (!task) return null;

  const updateStatus = async (s) => { await taskApi.update(task.id, { status: s }); setStatus(s); onSaved?.(); load(); };
  const toggleCheck = async (item) => { await taskApi.toggleChecklist(task.id, item.id, !item.isDone); load(); };
  const submitComment = async () => { if (!comment.trim()) return; await taskApi.comment(task.id, comment); setComment(''); load(); };
  const myAssignee = detail?.assignees?.find((a) => a.userId === user?.id);

  const respond = async (s, note, reqDate) => {
    await taskApi.respond(task.id, user.id, s, note, reqDate);
    toast.success('Task status updated');
    try {
      const d = await taskApi.get(task.id);
      setDetail(d);
      setStatus(d.status);
    } catch { }
    onSaved?.();
  };

  const handleGrantExtension = async (assignee) => {
    try {
      await taskApi.approveExtension(task.id, assignee.userId, assignee.requestedDueDate);
      toast.success('Extension request granted!');
      load();
      onSaved?.();
    } catch (e) { toast.error('Failed to grant extension'); }
  };

  const handleDeclineExtension = async (assignee) => {
    try {
      await taskApi.rejectExtension(task.id, assignee.userId);
      toast.success('Extension request declined');
      load();
      onSaved?.();
    } catch (e) { toast.error('Failed to decline extension'); }
  };

  const handleApproveSubmission = async (assignee) => {
    try {
      await taskApi.approveSubmission(task.id, assignee.userId);
      toast.success('Work submission approved! Task completed.');
      load();
      onSaved?.();
    } catch (e) { toast.error('Failed to approve submission'); }
  };

  const handleRequestChanges = (assignee) => {
    setSelectedAssigneeForChanges(assignee);
    setChangesFeedback('Please revise the implementation.');
    setChangesModalOpen(true);
  };

  const handleAssignMe = async () => {
    try {
      const currentIds = detail?.assignees?.map((a) => a.userId) || [];
      if (!currentIds.includes(user.id)) {
        await taskApi.update(task.id, { assigneeIds: [...currentIds, user.id] });
        toast.success('Assigned yourself to task');
        load();
        onSaved?.();
      }
    } catch (e) { toast.error('Failed to assign yourself'); }
  };

  const isTaskCancelled = status === 'CANCELLED' || detail?.status === 'CANCELLED';
  const isTaskCompleted = status === 'COMPLETED' || detail?.status === 'COMPLETED';
  const isLocked = isTaskCancelled || isTaskCompleted;
  const extensionRequests = isLocked ? [] : (detail?.assignees?.filter((a) => a.status === 'EXTENSION_REQUESTED') || []);
  const submittedAssignees = isLocked ? [] : (detail?.assignees?.filter((a) => a.status === 'SUBMITTED') || []);
  const canManageExtension = detail?.createdById === user?.id || user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <>
      <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col" data-testid="task-detail-drawer">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="font-display text-xl">{detail?.title || task.title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select value={status} onValueChange={updateStatus} disabled={isTaskCancelled}>
                <SelectTrigger className="w-40 h-8" data-testid="task-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>)}</SelectContent>
              </Select>
              <Badge variant="outline" className={PRIORITY_CFG[detail?.priority]?.color}>{PRIORITY_CFG[detail?.priority]?.label}</Badge>
              {detail?.dueDate && <Badge variant="outline">Due {format(new Date(detail.dueDate), 'PP')}</Badge>}
              {detail?.project && <Badge variant="secondary">{detail.project.name}</Badge>}
              {canManageExtension && !isLocked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                  onClick={() => updateStatus('CANCELLED')}
                  data-testid="cancel-task-btn"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel Task
                </Button>
              )}
            </div>

            {/* Extension Request Banner */}
            {extensionRequests.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <Clock className="h-4 w-4" /> Extension Requested ({extensionRequests.length})
                </div>
                {extensionRequests.map((a) => (
                  <div key={a.id} className="text-xs space-y-1">
                    <div className="font-medium text-foreground">Requested by {a.user?.fullName || a.user?.email}:</div>
                    {a.note && <div className="text-muted-foreground italic">"{a.note}"</div>}
                    {a.requestedDueDate && <div>Requested Due Date: <span className="font-semibold text-primary">{format(new Date(a.requestedDueDate), 'PP')}</span></div>}
                    {canManageExtension && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleGrantExtension(a)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Grant Extension
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDeclineExtension(a)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Decline
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Work Submitted Review Banner */}
            {submittedAssignees.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <Send className="h-4 w-4" /> Work Submitted for Review ({submittedAssignees.length})
                </div>
                {submittedAssignees.map((a) => (
                  <div key={a.id} className="text-xs space-y-1">
                    <div className="font-medium text-foreground">Submitted by {a.user?.fullName || a.user?.email}:</div>
                    {a.note && <div className="text-muted-foreground italic">"{a.note}"</div>}
                    {canManageExtension && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveSubmission(a)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve & Complete
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-amber-400 border-amber-500/30" onClick={() => handleRequestChanges(a)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Request Changes
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-1">Description</div>
              <div className="text-sm whitespace-pre-wrap">{detail?.description || <em className="text-muted-foreground">No description</em>}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Assignees</div>
              <div className="flex flex-wrap gap-2">
                {detail?.assignees?.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-full border border-border px-2 py-1">
                    <Avatar className="h-5 w-5"><AvatarImage src={a.user?.avatarUrl} /><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(a.user?.fullName)}</AvatarFallback></Avatar>
                    <span className="text-sm">{a.user?.fullName}</span>
                    <Badge variant="outline" className={`text-[9px] ${a.status === 'EXTENSION_REQUESTED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : a.status === 'SUBMITTED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : ''}`}>{a.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
            {isTaskCancelled ? (
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Badge variant="destructive" className="px-3 py-1.5 font-medium text-xs">
                  <XCircle className="h-3.5 w-3.5 mr-1 inline-block" /> Task Cancelled (Fixed)
                </Badge>
              </div>
            ) : isTaskCompleted ? (
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Badge className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium text-xs">
                  <Check className="h-3.5 w-3.5 mr-1 inline-block" /> Task Completed
                </Badge>
              </div>
            ) : myAssignee ? (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                {myAssignee.status === 'PENDING' && (
                  <>
                    <Button size="sm" onClick={() => respond('ACCEPTED')}>Accept Task</Button>
                    <Button size="sm" variant="outline" onClick={() => respond('REJECTED')}>Reject</Button>
                  </>
                )}
                {myAssignee.status !== 'COMPLETED' && (
                  <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => setExtModalOpen(true)}>
                    <Clock className="h-3.5 w-3.5 mr-1" /> Request Extension
                  </Button>
                )}
                {myAssignee.status !== 'SUBMITTED' && myAssignee.status !== 'COMPLETED' && (
                  <Button size="sm" onClick={() => setSubmitModalOpen(true)}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Submit Work
                  </Button>
                )}
                {myAssignee.status === 'SUBMITTED' && (
                  <Badge variant="secondary" className="px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                    <FileCheck className="h-3.5 w-3.5 mr-1" /> Work Submitted (Pending Review)
                  </Badge>
                )}
                {myAssignee.status === 'COMPLETED' ? (
                  <Badge className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium text-xs">
                    <Check className="h-3.5 w-3.5 mr-1 inline-block" /> Completed
                  </Badge>
                ) : canManageExtension ? (
                  <Button size="sm" variant="outline" onClick={() => updateStatus('COMPLETED')}>Mark Complete</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSubmitModalOpen(true)}>Submit for Review</Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                <Button size="sm" variant="outline" onClick={handleAssignMe}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Assign Me to Task
                </Button>
              </div>
            )}
            {detail?.checklist?.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">Checklist</div>
                <div className="space-y-1">
                  {detail.checklist.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={c.isDone} onCheckedChange={() => toggleCheck(c)} />
                      <span className={c.isDone ? 'line-through text-muted-foreground' : ''}>{c.content}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-2">Comments</div>
              <div className="space-y-3">
                {detail?.comments?.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar className="h-7 w-7"><AvatarImage src={c.user?.avatarUrl} /><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(c.user?.fullName)}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{c.user?.fullName} · {format(new Date(c.createdAt), 'PPp')}</div>
                      <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                    </div>
                  </div>
                ))}
                {(!detail?.comments || detail.comments.length === 0) && <div className="text-sm text-muted-foreground">No comments yet.</div>}
              </div>
            </div>
          </div>
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
              <Button onClick={submitComment} disabled={!comment.trim()}>Post</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Extension Request Prompt Modal */}
      <Dialog open={extModalOpen} onOpenChange={setExtModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" /> Request Task Extension
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Reason / Explanation</Label>
              <Textarea
                rows={3}
                placeholder="Explain why you need extra time..."
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Requested New Due Date</Label>
              <Input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={extDate}
                onChange={(e) => setExtDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={async () => {
                await respond('EXTENSION_REQUESTED', extReason, extDate);
                setExtModalOpen(false);
                setExtReason('');
                setExtDate('');
              }}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Work Prompt Modal */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Submit Work for Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Submission Summary / Notes / Links</Label>
              <Textarea
                rows={4}
                placeholder="Summarize your work, add pull request or document links..."
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)}>Cancel</Button>
            <Button
              data-testid="submit-work-modal-btn"
              onClick={async () => {
                await respond('SUBMITTED', submitNote);
                setSubmitModalOpen(false);
                setSubmitNote('');
              }}
            >
              Submit Work
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Changes Custom Modal */}
      <Dialog open={changesModalOpen} onOpenChange={setChangesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <RotateCcw className="h-5 w-5" /> Request Changes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Feedback / Requested Changes for Assignee</Label>
              <Textarea
                rows={4}
                placeholder="Explain what needs to be revised or improved..."
                value={changesFeedback}
                onChange={(e) => setChangesFeedback(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="confirm-request-changes-btn"
              onClick={async () => {
                if (!selectedAssigneeForChanges) return;
                try {
                  await taskApi.requestChanges(task.id, selectedAssigneeForChanges.userId, changesFeedback);
                  toast.success('Changes requested from assignee');
                  setChangesModalOpen(false);
                  setChangesFeedback('Please revise the implementation.');
                  setSelectedAssigneeForChanges(null);
                  load();
                  onSaved?.();
                } catch (e) { toast.error('Failed to request changes'); }
              }}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

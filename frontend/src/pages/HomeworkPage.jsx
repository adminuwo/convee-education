import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { taskApi, orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, CheckCircle2, Clock, Calendar as CalIcon, Search, AlertCircle, Sparkles, User, FileCheck, Plus, Check, X, RotateCcw, Send, MessageSquare } from 'lucide-react';
import { connectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format, isPast } from 'date-fns';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

const PRIORITY_CFG = {
  LOW: { label: 'Low', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  HIGH: { label: 'High', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  URGENT: { label: 'Urgent', color: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

export default function HomeworkPage() {
  const { currentOrg, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStudent = currentOrg?.role === 'STUDENT';
  const activeTab = searchParams.get('tab') || (isStudent ? 'pending' : 'review');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState([]);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);

  // Revision modal state for teachers
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [selectedTaskForRevision, setSelectedTaskForRevision] = useState(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  // Homework creation form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'HIGH',
    dueDate: '',
    selectedClassTeamIds: [],
    checklist: '',
  });

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [allTasks, depts] = await Promise.all([
        taskApi.list(currentOrg.id, isStudent ? { assignee: 'me' } : {}),
        orgApi.departments(currentOrg.id).catch(() => []),
      ]);

      // Filter tasks marked as homework
      const homeworkOnly = (allTasks || []).filter((t) => Boolean(t.metadata?.isHomework));
      setTasks(homeworkOnly);
      setDepartments(depts || []);
    } catch (e) {
      toast.error('Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, isStudent]);

  useEffect(() => {
    loadData();
    const socket = connectSocket() || getSocket();
    const handleUpdate = () => loadData();
    if (socket) {
      socket.on('connect', handleUpdate);
      socket.on('task:updated', handleUpdate);
      socket.on('notification:new', handleUpdate);
    }
    window.addEventListener('focus', loadData);

    // Lightweight 5-second polling fallback for immediate real-time sync
    const interval = setInterval(loadData, 5000);

    return () => {
      if (socket) {
        socket.off('connect', handleUpdate);
        socket.off('task:updated', handleUpdate);
        socket.off('notification:new', handleUpdate);
      }
      window.removeEventListener('focus', loadData);
      clearInterval(interval);
    };
  }, [loadData]);

  // Extract all class teams / sections
  const allTeams = useMemo(() => {
    const list = [];
    departments.forEach((d) => {
      (d.teams || []).forEach((t) => {
        list.push({ ...t, deptName: d.name });
      });
    });
    return list;
  }, [departments]);

  // Filter class teams for teacher selection
  const myClassTeams = useMemo(() => {
    if (['DIRECTOR', 'ADMIN', 'PRINCIPAL'].includes(currentOrg?.role)) return allTeams;
    return allTeams.filter((t) => {
      if (t.managerId === user?.id) return true;
      if (t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)) return true;
      return false;
    });
  }, [allTeams, user?.id, currentOrg?.role]);

  // Submit new homework assignment (Teacher action)
  const handleAssignHomework = async () => {
    if (!form.title.trim()) {
      toast.error('Please enter a homework title');
      return;
    }
    if (form.selectedClassTeamIds.length === 0) {
      toast.error('Please select at least one class section');
      return;
    }

    try {
      const payload = {
        orgId: currentOrg.id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        isHomework: true,
        classTeamIds: form.selectedClassTeamIds,
        checklist: form.checklist ? form.checklist.split('\n').filter(Boolean) : [],
      };

      await taskApi.create(payload);
      toast.success('Homework assigned to class students! 📚');
      setOpenCreateModal(false);
      setForm({ title: '', description: '', priority: 'HIGH', dueDate: '', selectedClassTeamIds: [], checklist: '' });
      await loadData();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create homework');
    }
  };

  // Student action: Submit homework for teacher review
  const handleStudentSubmitReview = async (task, e) => {
    e?.stopPropagation();
    try {
      await taskApi.update(task.id, { status: 'REVIEW' });
      toast.success('Homework submitted for Teacher review! 🚀');
      setSelectedHomework(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to submit homework');
    }
  };

  // Teacher action: Approve student homework -> COMPLETED
  const handleTeacherApprove = async (task, e) => {
    e?.stopPropagation();
    try {
      await taskApi.update(task.id, { status: 'COMPLETED' });
      toast.success(`Approved homework for ${task.assignees?.[0]?.user?.fullName || 'Student'}! 🎉`);
      setSelectedHomework(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to approve submission');
    }
  };

  // Teacher action: Request revision -> TODO
  const handleTeacherRequestRevision = async () => {
    if (!selectedTaskForRevision) return;
    try {
      await taskApi.update(selectedTaskForRevision.id, { status: 'TODO' });

      // Add feedback comment if provided
      if (revisionFeedback.trim()) {
        await taskApi.comment(selectedTaskForRevision.id, `Teacher Feedback: ${revisionFeedback}`);
      }

      toast.success('Revision requested from student');
      setRevisionModalOpen(false);
      setSelectedTaskForRevision(null);
      setRevisionFeedback('');
      setSelectedHomework(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to request revision');
    }
  };

  // Toggle checklist item
  const toggleCheckitem = async (item) => {
    if (!selectedHomework) return;
    const newIsDone = !item.isDone;

    // Optimistic UI update for instant visual feedback
    setSelectedHomework((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklist: (prev.checklist || []).map((c) => (c.id === item.id ? { ...c, isDone: newIsDone } : c)),
      };
    });

    try {
      await taskApi.toggleChecklist(selectedHomework.id, item.id, newIsDone);
      loadData();
    } catch (e) {
      // Revert if failed
      setSelectedHomework((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          checklist: (prev.checklist || []).map((c) => (c.id === item.id ? { ...c, isDone: item.isDone } : c)),
        };
      });
      toast.error('Failed to update checklist item');
    }
  };

  // Filter tasks based on search & tab
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (isStudent) {
        if (activeTab === 'pending' && !['TODO', 'IN_PROGRESS'].includes(t.status)) return false;
        if (activeTab === 'review' && t.status !== 'REVIEW') return false;
        if (activeTab === 'completed' && t.status !== 'COMPLETED') return false;
      } else {
        if (activeTab === 'review' && t.status !== 'REVIEW') return false;
        if (activeTab === 'active' && !['TODO', 'IN_PROGRESS'].includes(t.status)) return false;
        if (activeTab === 'completed' && t.status !== 'COMPLETED') return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.createdBy?.fullName || '').toLowerCase().includes(q)
      );
    });
  }, [tasks, activeTab, search, isStudent]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
              {isStudent ? 'My Homework & Assignments' : 'Homework & Submissions Portal'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isStudent
                ? 'View assigned homework, submit completed work for teacher review, and track progress.'
                : 'Assign homework to class sections, review student submissions, and manage grading.'}
            </p>
          </div>
        </div>

        {!isStudent && (
          <Button onClick={() => setOpenCreateModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md">
            <Plus className="h-4 w-4 mr-1.5" /> Assign Homework
          </Button>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full sm:w-auto">
          {isStudent ? (
            <TabsList className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
              <TabsTrigger value="pending" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-pending">
                Assigned
              </TabsTrigger>
              <TabsTrigger value="review" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-review">
                Under Review
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-completed">
                Approved
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
              <TabsTrigger value="review" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5" data-testid="tab-review">
                Submissions for Review
                {tasks.filter((t) => t.status === 'REVIEW').length > 0 && (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px] rounded-full font-bold">
                    {tasks.filter((t) => t.status === 'REVIEW').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-active">
                Active Assignments
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-completed">
                Completed
              </TabsTrigger>
            </TabsList>
          )}
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search homework..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Homework Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t) => {
          const isDone = t.status === 'COMPLETED';
          const isUnderReview = t.status === 'REVIEW';
          const overdue = t.dueDate && isPast(new Date(t.dueDate)) && !isDone;
          const targetClasses = t.metadata?.targetClassNames?.join(', ') || '';
          const studentCount = t.assignees?.length || 0;

          return (
            <div
              key={t.id}
              onClick={() => setSelectedHomework(t)}
              className={`group rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isUnderReview
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : isDone
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : overdue
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold text-sm leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {t.title}
                  </h3>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_CFG[t.priority]?.color || ''}`}>
                    {PRIORITY_CFG[t.priority]?.label || t.priority}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {targetClasses && (
                    <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {targetClasses}
                    </Badge>
                  )}

                  {isUnderReview && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 font-semibold">
                      ⏳ Under Review
                    </Badge>
                  )}
                  {isDone && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-semibold">
                      ✓ Approved
                    </Badge>
                  )}
                </div>

                {t.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border border-border">
                      <AvatarImage src={t.createdBy?.avatarUrl} />
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {initials(t.createdBy?.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
                      {t.createdBy?.fullName || 'Teacher'}
                    </span>
                  </div>

                  {t.dueDate && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                      <CalIcon className="h-3.5 w-3.5" />
                      <span>{format(new Date(t.dueDate), 'MMM d')}</span>
                    </div>
                  )}
                </div>

                {/* Quick Action Buttons */}
                {isStudent && t.status === 'TODO' && (
                  <Button
                    size="sm"
                    onClick={(e) => handleStudentSubmitReview(t, e)}
                    className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Submit Homework for Review
                  </Button>
                )}

                {!isStudent && isUnderReview && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={(e) => handleTeacherApprove(t, e)}
                      className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskForRevision(t);
                        setRevisionModalOpen(true);
                      }}
                      className="h-7 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revision
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="col-span-full text-center py-16 space-y-3">
            <div className="h-12 w-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
              <FileCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold">No Homework Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {isStudent
                ? activeTab === 'pending'
                  ? "You're all caught up! No pending homework."
                  : 'No homework assignments match your filter.'
                : activeTab === 'review'
                ? 'No student submissions awaiting review.'
                : 'No homework assignments found.'}
            </p>
          </div>
        )}
      </div>

      {/* Homework Detail Dialog */}
      {selectedHomework && (
        <Dialog open={Boolean(selectedHomework)} onOpenChange={(o) => !o && setSelectedHomework(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader className="pr-6">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" /> {selectedHomework.title}
                </DialogTitle>
                <Badge variant="outline" className={`text-[10px] ${PRIORITY_CFG[selectedHomework.priority]?.color || ''}`}>
                  {selectedHomework.priority}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarImage src={selectedHomework.createdBy?.avatarUrl} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {initials(selectedHomework.createdBy?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-foreground">{selectedHomework.createdBy?.fullName || 'Teacher'}</div>
                    <div className="text-[10px] text-muted-foreground">Assigned Teacher</div>
                  </div>
                </div>

                {selectedHomework.dueDate && (
                  <div className="text-right">
                    <div className="font-semibold text-foreground">{format(new Date(selectedHomework.dueDate), 'PPP')}</div>
                    <div className="text-[10px] text-muted-foreground">Due Date</div>
                  </div>
                )}
              </div>

              {selectedHomework.description && (
                <div className="space-y-1">
                  <div className="font-semibold text-muted-foreground text-[11px]">Instructions</div>
                  <div className="p-3 rounded-md border border-border bg-card leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedHomework.description}
                  </div>
                </div>
              )}

              {selectedHomework.checklist?.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-muted-foreground text-[11px]">Submission Checklist</div>
                  <div className="space-y-1.5">
                    {selectedHomework.checklist.map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCheckitem(item);
                        }}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card/50 hover:bg-accent/10 transition-all cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={Boolean(item.isDone)}
                          className="pointer-events-none"
                        />
                        <span className={`text-xs ${item.isDone ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {item.content}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Actions */}
              <div className="pt-3 border-t border-border space-y-2">
                {isStudent && selectedHomework.status === 'TODO' && (
                  <Button
                    onClick={(e) => handleStudentSubmitReview(selectedHomework, e)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    <Send className="h-4 w-4 mr-2" /> Submit Homework for Review
                  </Button>
                )}

                {!isStudent && selectedHomework.status === 'REVIEW' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={(e) => handleTeacherApprove(selectedHomework, e)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Check className="h-4 w-4 mr-2" /> Approve & Mark Complete
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedTaskForRevision(selectedHomework);
                        setRevisionModalOpen(true);
                      }}
                      className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Request Revision
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Teacher Create Homework Modal */}
      <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pr-6 pb-1">
            <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" /> Assign New Homework
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-1 text-xs">
            <div>
              <Label className="text-xs font-semibold">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Chapter 4 Math Problem Set"
                className="h-9 mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Instructions / Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Add detailed instructions for students..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_CFG[p]?.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Due Date</Label>
                <Input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-blue-500 mb-1 flex items-center gap-1">
                Target Class Sections (Students will receive notification & assignment)
              </Label>
              <div className="max-h-36 overflow-auto border border-border rounded-md p-2 space-y-1.5 bg-card">
                {myClassTeams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 p-1 rounded">
                    <Checkbox
                      checked={form.selectedClassTeamIds?.includes(t.id)}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({
                          ...f,
                          selectedClassTeamIds: checked
                            ? [...(f.selectedClassTeamIds || []), t.id]
                            : (f.selectedClassTeamIds || []).filter((x) => x !== t.id),
                        }))
                      }
                    />
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">({t.deptName} Wing)</span>
                  </label>
                ))}
                {myClassTeams.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">No assigned class sections available</div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Checklist Items (one per line)</Label>
              <Textarea
                rows={2}
                value={form.checklist}
                onChange={(e) => setForm({ ...form, checklist: e.target.value })}
                placeholder={'Read Chapter 4\nComplete exercises 1-10'}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateModal(false)}>Cancel</Button>
            <Button onClick={handleAssignHomework} disabled={!form.title.trim()} className="bg-primary hover:bg-primary/90 text-white font-bold">
              Assign Homework
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Revision Prompt Modal (Teacher) */}
      <Dialog open={revisionModalOpen} onOpenChange={setRevisionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-500">
              <RotateCcw className="h-5 w-5" /> Request Homework Revision
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Send feedback to the student explaining what needs to be revised before resubmitting.
            </p>
            <div>
              <Label className="text-xs font-semibold">Feedback / Revision Notes</Label>
              <Textarea
                rows={3}
                placeholder="e.g. Please solve question 4 again and show full steps..."
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionModalOpen(false)}>Cancel</Button>
            <Button onClick={handleTeacherRequestRevision} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
              Send Revision Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

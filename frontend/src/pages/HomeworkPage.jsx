import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { taskApi, orgApi, homeworkApi, parentApi } from '@/lib/api';
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
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Calendar as CalIcon,
  Search,
  AlertCircle,
  Sparkles,
  User,
  FileCheck,
  Plus,
  Check,
  X,
  RotateCcw,
  Send,
  MessageSquare,
  Award,
  Paperclip,
  Building2,
  Users,
  ChevronRight,
  ArrowLeft,
  GraduationCap
} from 'lucide-react';
import { connectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format, isPast } from 'date-fns';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

function clampRubricVal(val, max = 25) {
  if (val === '' || val === null || val === undefined) return 0;
  const num = Number(val);
  if (isNaN(num) || num < 0) return 0;
  if (num > max) return max;
  return num;
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

  // Role Checks
  const roleUpper = (currentOrg?.role || '').toUpperCase();
  const titleUpper = (user?.title || '').toUpperCase();

  const isStudent = currentOrg?.role === 'STUDENT';
  const isParent = currentOrg?.role === 'PARENT';
  const isStudentOrParent = isStudent || isParent;
  const isTeacherOrAdmin = !isStudentOrParent;

  const isPrincipalOrDirector = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER'].some(
    (r) => roleUpper.includes(r) || titleUpper.includes(r)
  );

  const isDeanOrHOD =
    !isPrincipalOrDirector &&
    ['HOD', 'DEAN'].some((r) => roleUpper.includes(r) || titleUpper.includes(r));

  const isTeacherOnly = isTeacherOrAdmin && !isPrincipalOrDirector && !isDeanOrHOD;
  const isOversightRole = isPrincipalOrDirector || isDeanOrHOD;

  const activeTab = searchParams.get('tab') || (isStudentOrParent ? 'pending' : isOversightRole ? 'oversight' : 'review');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState([]);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);

  // Oversight state
  const [oversightDepts, setOversightDepts] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [oversightTeachers, setOversightTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [loadingOversight, setLoadingOversight] = useState(false);
  const [oversightSearch, setOversightSearch] = useState('');

  // Revision modal state for teachers
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [selectedTaskForRevision, setSelectedTaskForRevision] = useState(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  // Student submission modal state
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedTaskForSubmit, setSelectedTaskForSubmit] = useState(null);
  const [submitForm, setSubmitForm] = useState({ content: '', attachmentUrl: '' });

  // Teacher rubric grading modal state
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [selectedTaskForGrading, setSelectedTaskForGrading] = useState(null);
  const [existingSubmissions, setExistingSubmissions] = useState([]);
  const [gradingForm, setGradingForm] = useState({
    gradeScore: 90,
    gradeMax: 100,
    feedbackNotes: '',
    accuracy: 25,
    completeness: 25,
    formatting: 25,
    effort: 25,
  });

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
      let homeworkTasks = [];
      let depts = [];

      if (isParent) {
        const [children, deptsRes] = await Promise.all([
          parentApi.getMyChildren().catch(() => []),
          orgApi.departments(currentOrg.id).catch(() => []),
        ]);
        depts = deptsRes || [];
        if (children && children.length > 0) {
          const childStudentId = children[0].userId || children[0].user?.id;
          const report = await parentApi.getChildReport(childStudentId, currentOrg.id).catch(() => null);
          homeworkTasks = report?.homeworkReport || [];
        }
      } else {
        const [allTasks, deptsRes] = await Promise.all([
          taskApi.list(currentOrg.id, isStudent ? { assignee: 'me' } : {}),
          orgApi.departments(currentOrg.id).catch(() => []),
        ]);
        depts = deptsRes || [];

        // Standard teacher isolation: Regular teachers only see homework assigned by themselves
        homeworkTasks = (allTasks || []).filter((t) => {
          if (!t.metadata?.isHomework) return false;
          if (isTeacherOnly) {
            return t.createdById === user?.id;
          }
          return true;
        });
      }

      setTasks(homeworkTasks);
      setDepartments(depts);
    } catch (e) {
      toast.error('Failed to load homework');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, isStudent, isParent, isTeacherOnly, user?.id]);

  // Load oversight data based on role & selected drilldown level
  const loadOversightData = useCallback(async () => {
    if (!currentOrg?.id || !isOversightRole) return;
    setLoadingOversight(true);
    try {
      if (selectedTeacher) {
        const assignments = await homeworkApi.getTeacherAssignments(currentOrg.id, selectedTeacher.id);
        setTeacherAssignments(assignments || []);
      } else if (isPrincipalOrDirector && !selectedDept) {
        const deptOverview = await homeworkApi.getDepartmentOverview(currentOrg.id);
        setOversightDepts(deptOverview || []);
      } else {
        const deptId = selectedDept?.id || undefined;
        const teachers = await homeworkApi.getDepartmentTeachers(currentOrg.id, deptId);
        setOversightTeachers(teachers || []);
      }
    } catch (e) {
      toast.error('Failed to load departmental oversight data');
    } finally {
      setLoadingOversight(false);
    }
  }, [currentOrg?.id, isOversightRole, isPrincipalOrDirector, selectedDept, selectedTeacher]);

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

  useEffect(() => {
    if (activeTab === 'oversight') {
      loadOversightData();
    }
  }, [activeTab, loadOversightData]);

  // Extract all class teams / sections
  const allTeams = useMemo(() => {
    const list = [];
    departments.forEach((d) => {
      (d.teams || []).forEach((t) => {
        list.push({ ...t, departmentId: t.departmentId || d.id, deptName: d.name });
      });
    });
    return list;
  }, [departments]);

  // Filter class teams for teacher / HOD / Dean / admin selection
  const myClassTeams = useMemo(() => {
    if (isPrincipalOrDirector) return allTeams;

    const deptHeadIds = new Set(
      departments
        .filter(
          (d) =>
            d.headId === user?.id ||
            d.memberships?.some(
              (m) =>
                (m.userId === user?.id || m.user?.id === user?.id) &&
                ['HOD', 'DEAN'].some((r) => (m.role || '').toUpperCase().includes(r) || titleUpper.includes(r))
            )
        )
        .map((d) => d.id)
    );

    return allTeams.filter((t) => {
      if (isDeanOrHOD && (deptHeadIds.has(t.departmentId) || deptHeadIds.has(t.department?.id))) return true;
      if (t.managerId === user?.id) return true;
      if (t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)) return true;
      return false;
    });
  }, [allTeams, departments, user?.id, isPrincipalOrDirector, isDeanOrHOD, titleUpper]);

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

  // Student action: Submit homework with text/attachment
  const handleExecuteStudentSubmit = async () => {
    if (!selectedTaskForSubmit) return;
    try {
      await homeworkApi.submit(selectedTaskForSubmit.id, {
        content: submitForm.content,
        attachmentUrl: submitForm.attachmentUrl,
      });
      toast.success('Homework & attachment submitted for Teacher review! 🚀');
      setSubmitModalOpen(false);
      setSelectedTaskForSubmit(null);
      setSubmitForm({ content: '', attachmentUrl: '' });
      setSelectedHomework(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to submit homework');
    }
  };

  // Teacher action: Open Rubric Grading modal
  const handleOpenGradingModal = async (task, e) => {
    e?.stopPropagation();
    if (isTeacherOnly && task.createdById !== user?.id) {
      toast.error('Only the teacher who assigned this homework can grade it.');
      return;
    }

    setSelectedTaskForGrading(task);
    setGradingModalOpen(true);
    try {
      const subs = await homeworkApi.getSubmissions(task.id);
      const sub = subs?.[0];
      setExistingSubmissions(subs || []);
      if (sub?.rubricScores) {
        setGradingForm({
          accuracy: clampRubricVal(sub.rubricScores.accuracy, 25),
          completeness: clampRubricVal(sub.rubricScores.completeness, 25),
          formatting: clampRubricVal(sub.rubricScores.formatting, 25),
          effort: clampRubricVal(sub.rubricScores.effort, 25),
          feedbackNotes: sub.feedbackNotes || '',
          gradeMax: 100,
        });
      } else {
        setGradingForm({
          accuracy: 25,
          completeness: 25,
          formatting: 25,
          effort: 25,
          feedbackNotes: sub?.feedbackNotes || '',
          gradeMax: 100,
        });
      }
    } catch (e) {
      setExistingSubmissions([]);
    }
  };

  // Teacher action: Execute Rubric Grade Submission
  const handleExecuteTeacherGrade = async () => {
    if (!selectedTaskForGrading) return;
    try {
      const targetSub = existingSubmissions[0];
      const subId = targetSub?.id || 'demo-sub';

      const accuracy = clampRubricVal(gradingForm.accuracy, 25);
      const completeness = clampRubricVal(gradingForm.completeness, 25);
      const formatting = clampRubricVal(gradingForm.formatting, 25);
      const effort = clampRubricVal(gradingForm.effort, 25);

      const rubricScores = { accuracy, completeness, formatting, effort };
      const calculatedScore = accuracy + completeness + formatting + effort;

      await homeworkApi.gradeSubmission(selectedTaskForGrading.id, subId, {
        gradeScore: calculatedScore,
        gradeMax: 100,
        rubricScores,
        feedbackNotes: gradingForm.feedbackNotes,
      });

      toast.success(`Homework graded (${calculatedScore}/100) and approved! 🎉`);
      setGradingModalOpen(false);
      setSelectedTaskForGrading(null);
      setSelectedHomework(null);
      await loadData();
      if (activeTab === 'oversight') loadOversightData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to submit rubric grade');
    }
  };

  // Teacher action: Request revision -> TODO
  const handleTeacherRequestRevision = async () => {
    if (!selectedTaskForRevision) return;
    try {
      await taskApi.update(selectedTaskForRevision.id, { status: 'TODO' });

      if (revisionFeedback.trim()) {
        await taskApi.comment(selectedTaskForRevision.id, `Teacher Feedback: ${revisionFeedback}`);
      }

      toast.success('Revision requested from student');
      setRevisionModalOpen(false);
      setSelectedTaskForRevision(null);
      setRevisionFeedback('');
      setSelectedHomework(null);
      await loadData();
      if (activeTab === 'oversight') loadOversightData();
    } catch (err) {
      toast.error('Failed to request revision');
    }
  };

  // Toggle checklist item
  const toggleCheckitem = async (item) => {
    if (!selectedHomework) return;
    const newIsDone = !item.isDone;

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
      if (isStudentOrParent) {
        if (activeTab === 'pending' && !['TODO', 'IN_PROGRESS'].includes(t.status)) return false;
        if (activeTab === 'review' && t.status !== 'REVIEW') return false;
        if (activeTab === 'completed' && t.status !== 'COMPLETED') return false;
      } else {
        // Staff / Teacher / HOD / Director filtering
        // Personal tabs (My Assignments, Submissions for Review, Completed) strictly show homework created by the logged-in user.
        // Oversight tab is used to inspect other teachers' homework.
        if (activeTab === 'active') {
          if (!['TODO', 'IN_PROGRESS'].includes(t.status)) return false;
          if (t.createdById !== user?.id) return false;
        }
        if (activeTab === 'review') {
          if (t.status !== 'REVIEW') return false;
          if (t.createdById !== user?.id) return false;
        }
        if (activeTab === 'completed') {
          if (t.status !== 'COMPLETED') return false;
          if (t.createdById !== user?.id) return false;
        }
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.createdBy?.fullName || '').toLowerCase().includes(q)
      );
    });
  }, [tasks, activeTab, search, isStudentOrParent, user?.id]);

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
              {isParent
                ? "Child's Homework & Progress"
                : isStudent
                ? 'My Homework & Assignments'
                : isPrincipalOrDirector
                ? 'Faculty Homework & Institutional Oversight Portal'
                : isDeanOrHOD
                ? 'Departmental Faculty Homework Oversight'
                : 'My Homework & Submissions Portal'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isParent
                ? "View your child's assigned homework, submission progress, and teacher grades."
                : isStudent
                ? 'View assigned homework, submit completed work for teacher review, and track progress.'
                : isPrincipalOrDirector
                ? 'Monitor departments, inspect faculty homework assignments, and oversee evaluation compliance.'
                : isDeanOrHOD
                ? 'Inspect teachers under your department and review homework assigned to class sections.'
                : 'Assign homework to class sections, review student submissions, and manage grading.'}
            </p>
          </div>
        </div>

        {isTeacherOrAdmin && (
          <Button onClick={() => setOpenCreateModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md">
            <Plus className="h-4 w-4 mr-1.5" /> Assign Homework
          </Button>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full sm:w-auto">
          {isStudentOrParent ? (
            <TabsList className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
              <TabsTrigger value="pending" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-pending">
                Assigned
              </TabsTrigger>
              <TabsTrigger value="review" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-review">
                Under Review
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-completed">
                Approved & Graded
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
              {isOversightRole && (
                <TabsTrigger value="oversight" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 text-blue-500" data-testid="tab-oversight">
                  {isPrincipalOrDirector ? <Building2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {isPrincipalOrDirector ? 'Faculty Oversight' : 'Department Oversight'}
                </TabsTrigger>
              )}
              <TabsTrigger value="review" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5" data-testid="tab-review">
                Submissions for Review
                {tasks.filter((t) => t.status === 'REVIEW' && t.createdById === user?.id).length > 0 && (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px] rounded-full font-bold">
                    {tasks.filter((t) => t.status === 'REVIEW' && t.createdById === user?.id).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-active">
                My Assignments
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all" data-testid="tab-completed">
                Completed
              </TabsTrigger>
            </TabsList>
          )}
        </Tabs>

        {activeTab !== 'oversight' && (
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
        )}
      </div>

      {/* ==================== OVERSIGHT VIEW (HOD / DEAN / PRINCIPAL / DIRECTOR) ==================== */}
      {activeTab === 'oversight' && isOversightRole && (
        <div className="space-y-6">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
            {isPrincipalOrDirector && (
              <button
                onClick={() => {
                  setSelectedDept(null);
                  setSelectedTeacher(null);
                }}
                className={`hover:text-primary transition-colors flex items-center gap-1 ${!selectedDept ? 'text-foreground font-bold' : ''}`}
              >
                <Building2 className="h-3.5 w-3.5" /> All Departments
              </button>
            )}

            {selectedDept && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className={`hover:text-primary transition-colors flex items-center gap-1 ${selectedDept && !selectedTeacher ? 'text-foreground font-bold' : ''}`}
                >
                  <Users className="h-3.5 w-3.5" /> {selectedDept.name} Department
                </button>
              </>
            )}

            {isDeanOrHOD && !selectedDept && (
              <span className={`flex items-center gap-1 ${!selectedTeacher ? 'text-foreground font-bold' : ''}`}>
                <Users className="h-3.5 w-3.5" /> Department Teachers
              </span>
            )}

            {selectedTeacher && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-foreground font-bold flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-500" /> {selectedTeacher.fullName}'s Assigned Homework
                </span>
              </>
            )}

            {(selectedDept || selectedTeacher) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedTeacher) setSelectedTeacher(null);
                  else if (selectedDept) setSelectedDept(null);
                }}
                className="ml-auto h-7 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3 mr-1" /> Back
              </Button>
            )}
          </div>

          {/* Level 1: Departments List (Principal / Director Only) */}
          {isPrincipalOrDirector && !selectedDept && !selectedTeacher && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Select Department to Inspect Faculty Homework</h3>
                <span className="text-xs text-muted-foreground">{oversightDepts.length} Departments Recorded</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {oversightDepts.map((dept) => (
                  <Card
                    key={dept.id}
                    onClick={() => {
                      setSelectedDept(dept);
                      setSelectedTeacher(null);
                    }}
                    className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md border-border bg-card group"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 font-bold text-[11px]">
                          {dept.totalHomeworkCount} Homework Tasks
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold mt-2 group-hover:text-primary transition-colors">
                        {dept.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        HOD: {dept.headUser?.fullName || 'Department Head'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3 mt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" /> {dept.teacherCount} Faculty Teachers
                        </span>
                        <span className="text-primary font-bold text-[11px] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                          Inspect Teachers <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Level 2: Teachers List under Department (HOD / Dean or Principal selected Dept) */}
          {((isPrincipalOrDirector && selectedDept && !selectedTeacher) || (isDeanOrHOD && !selectedTeacher)) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Teachers under {selectedDept?.name || 'Department'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Click on any teacher to inspect the homework assignments they have given.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search teacher by name..."
                    value={oversightSearch}
                    onChange={(e) => setOversightSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {oversightTeachers
                  .filter((t) => !oversightSearch.trim() || t.fullName.toLowerCase().includes(oversightSearch.toLowerCase()) || (t.email || '').toLowerCase().includes(oversightSearch.toLowerCase()))
                  .map((teacher) => (
                    <Card
                      key={teacher.id}
                      onClick={() => setSelectedTeacher(teacher)}
                      className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md border-border bg-card group"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 border border-border">
                            <AvatarImage src={teacher.avatarUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {initials(teacher.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                              {teacher.fullName}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">{teacher.title || teacher.role || 'Teacher'}</p>
                            <p className="text-[11px] text-muted-foreground/70 truncate">{teacher.email}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-muted/30 border border-border/50 text-center mb-3">
                          <div>
                            <div className="text-sm font-bold text-foreground">{teacher.homeworkCount}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">Assigned</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-amber-500">{teacher.pendingReviewCount}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">Pending</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-emerald-500">{teacher.completedCount}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">Graded</div>
                          </div>
                        </div>

                        <Button size="sm" variant="outline" className="w-full h-8 text-xs font-semibold group-hover:bg-primary group-hover:text-white transition-colors">
                          View Homework Given ({teacher.homeworkCount}) <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}

                {oversightTeachers.length === 0 && !loadingOversight && (
                  <div className="col-span-full text-center py-12 text-muted-foreground text-xs">
                    No faculty teachers recorded under this department.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Level 3: Homework Given by Selected Teacher */}
          {selectedTeacher && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={selectedTeacher.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {initials(selectedTeacher.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      Homework Assignments by {selectedTeacher.fullName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {teacherAssignments.length} Homework tasks assigned to class sections
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTeacher(null)}
                  className="h-8 text-xs"
                >
                  Select Another Teacher
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teacherAssignments.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  const isUnderReview = t.status === 'REVIEW';
                  const overdue = t.dueDate && isPast(new Date(t.dueDate)) && !isDone;
                  const targetClasses = t.metadata?.targetClassNames?.join(', ') || '';

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
                              ⏳ Pending Review
                            </Badge>
                          )}
                          {isDone && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-semibold">
                              ✓ Graded & Approved
                            </Badge>
                          )}
                        </div>

                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Students Assigned: {t.assignees?.length || 0}</span>
                        {t.dueDate && (
                          <span className="font-medium text-[11px]">Due: {format(new Date(t.dueDate), 'MMM d')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {teacherAssignments.length === 0 && !loadingOversight && (
                  <div className="col-span-full text-center py-12 text-muted-foreground text-xs">
                    No homework assignments logged by this teacher.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== STANDARD HOMEWORK GRID VIEW ==================== */}
      {activeTab !== 'oversight' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const isDone = t.status === 'COMPLETED';
            const isUnderReview = t.status === 'REVIEW';
            const overdue = t.dueDate && isPast(new Date(t.dueDate)) && !isDone;
            const targetClasses = t.metadata?.targetClassNames?.join(', ') || '';
            const isMyTask = t.createdById === user?.id;

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
                      <>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-semibold">
                          ✓ Approved
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-bold">
                          Grade: {t.submission?.gradeScore !== null && t.submission?.gradeScore !== undefined ? `${t.submission.gradeScore}/${t.submission.gradeMax || 100}` : `-/${t.submission?.gradeMax || 100}`}
                        </Badge>
                      </>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskForSubmit(t);
                        setSubmitModalOpen(true);
                      }}
                      className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Submit Homework Solution
                    </Button>
                  )}

                  {!isStudentOrParent && isUnderReview && (isMyTask || isOversightRole) && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={(e) => handleOpenGradingModal(t, e)}
                        className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        <Award className="h-3.5 w-3.5 mr-1" /> Grade Rubric
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
      )}

      {/* Homework Detail Dialog */}
      {selectedHomework && (
        <Dialog open={Boolean(selectedHomework)} onOpenChange={(o) => !o && setSelectedHomework(null)}>
          <DialogContent className="sm:max-w-lg">
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

              {selectedHomework.checklist?.length > 0 && (() => {
                const isChecklistEditable = isStudent && ['TODO', 'IN_PROGRESS'].includes(selectedHomework.status);

                return (
                  <div className="space-y-2">
                    <div className="font-semibold text-muted-foreground text-[11px]">Submission Checklist</div>
                    <div className="space-y-1.5">
                      {selectedHomework.checklist.map((item) => (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isChecklistEditable) toggleCheckitem(item);
                          }}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card/50 transition-all select-none ${
                            isChecklistEditable ? 'hover:bg-accent/10 cursor-pointer' : 'cursor-default opacity-85'
                          }`}
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
                );
              })()}

              {selectedHomework.submission && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">Teacher Evaluation & Grade</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold text-xs">
                      Grade: {selectedHomework.submission.gradeScore !== null && selectedHomework.submission.gradeScore !== undefined ? selectedHomework.submission.gradeScore : '-'} / {selectedHomework.submission.gradeMax || 100}
                    </Badge>
                  </div>
                  {selectedHomework.submission.feedbackNotes && (
                    <p className="text-xs text-muted-foreground italic">
                      "{selectedHomework.submission.feedbackNotes}"
                    </p>
                  )}
                </div>
              )}

              {/* Status Actions */}
              <div className="pt-3 border-t border-border space-y-2">
                {isStudent && selectedHomework.status === 'TODO' && (
                  <Button
                    onClick={() => {
                      setSelectedTaskForSubmit(selectedHomework);
                      setSubmitModalOpen(true);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    <Send className="h-4 w-4 mr-2" /> Submit Homework for Review
                  </Button>
                )}

                {!isStudentOrParent && selectedHomework.status === 'REVIEW' && (selectedHomework.createdById === user?.id || isOversightRole) && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button
                      onClick={(e) => handleOpenGradingModal(selectedHomework, e)}
                      className="flex-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Award className="h-4 w-4 mr-1.5 shrink-0" /> Grade Rubric & Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedTaskForRevision(selectedHomework);
                        setRevisionModalOpen(true);
                      }}
                      className="text-xs font-bold text-amber-500 border-amber-500/30 hover:bg-amber-500/10 shrink-0"
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5 shrink-0" /> Request Revision
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

      {/* Student Interactive Homework Submission Dialog */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-blue-500">
              <Send className="h-5 w-5" /> Submit Homework Solution
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Your Solution / Text Answer</Label>
              <Textarea
                rows={4}
                value={submitForm.content}
                onChange={(e) => setSubmitForm({ ...submitForm, content: e.target.value })}
                placeholder="Type your homework answer or solution notes here..."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5 text-blue-500" /> Attachment Link / Google Drive URL (Optional)
              </Label>
              <Input
                type="url"
                value={submitForm.attachmentUrl}
                onChange={(e) => setSubmitForm({ ...submitForm, attachmentUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/..."
                className="mt-1 h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)}>Cancel</Button>
            <Button onClick={handleExecuteStudentSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Submit Solution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher Rubric Grading & Feedback Modal */}
      <Dialog open={gradingModalOpen} onOpenChange={setGradingModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-500">
              <Award className="h-5 w-5" /> Rubric Grading & Feedback Portal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
              Grade homework using criterion-based rubric scores out of 100 points.
            </div>

            {/* Rubric criteria breakdown */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-card">
              <div>
                <Label className="text-[11px] font-semibold">1. Accuracy & Correctness (/25)</Label>
                <Input
                  type="number"
                  max={25}
                  min={0}
                  value={gradingForm.accuracy}
                  onChange={(e) => setGradingForm({ ...gradingForm, accuracy: clampRubricVal(e.target.value, 25) })}
                  className="h-8 mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold">2. Completeness (/25)</Label>
                <Input
                  type="number"
                  max={25}
                  min={0}
                  value={gradingForm.completeness}
                  onChange={(e) => setGradingForm({ ...gradingForm, completeness: clampRubricVal(e.target.value, 25) })}
                  className="h-8 mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold">3. Formatting & Structure (/25)</Label>
                <Input
                  type="number"
                  max={25}
                  min={0}
                  value={gradingForm.formatting}
                  onChange={(e) => setGradingForm({ ...gradingForm, formatting: clampRubricVal(e.target.value, 25) })}
                  className="h-8 mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold">4. Effort & Presentation (/25)</Label>
                <Input
                  type="number"
                  max={25}
                  min={0}
                  value={gradingForm.effort}
                  onChange={(e) => setGradingForm({ ...gradingForm, effort: clampRubricVal(e.target.value, 25) })}
                  className="h-8 mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
              <span className="font-bold text-foreground">Calculated Total Score:</span>
              <span className="text-lg font-bold text-primary">
                {clampRubricVal(gradingForm.accuracy, 25) +
                  clampRubricVal(gradingForm.completeness, 25) +
                  clampRubricVal(gradingForm.formatting, 25) +
                  clampRubricVal(gradingForm.effort, 25)}{' '}
                / 100
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold">Teacher Rubric Feedback & Notes</Label>
              <Textarea
                rows={3}
                value={gradingForm.feedbackNotes}
                onChange={(e) => setGradingForm({ ...gradingForm, feedbackNotes: e.target.value })}
                placeholder="Great work! Well explained with neat formatting..."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingModalOpen(false)}>Cancel</Button>
            <Button onClick={handleExecuteTeacherGrade} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Submit Rubric Grade & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

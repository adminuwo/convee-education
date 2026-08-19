import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { examApi, orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  GraduationCap,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Users,
  Layers,
  Sparkles,
  BookOpen,
  Trash2,
  Send,
  FileSpreadsheet,
  Clock,
  Search,
  Check,
  Building,
  UserX,
  AlertCircle,
  HelpCircle,
  FolderPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { connectSocket, getSocket } from '@/lib/socket';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function HODExamManager({ orgId, user, departments, currentOrg, onSelectExamForGrading }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' or 'defaulters'

  // Selected exam for defaulters view
  const [selectedExamId, setSelectedExamId] = useState('');
  const [defaultersData, setDefaultersData] = useState(null);
  const [defaultersLoading, setDefaultersLoading] = useState(false);
  const [defaulterFilter, setDefaulterFilter] = useState('ALL'); // 'ALL', 'ABSENT', 'FAILED'
  const [defaulterSearch, setDefaulterSearch] = useState('');

  // Create Exam Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [examForm, setExamForm] = useState({
    title: '',
    term: 'Term 1',
    academicSession: '2026-2027',
    examType: 'MID_TERM',
    defaultGradingType: 'NUMERICAL',
    defaultMaxMarks: 100,
    defaultPassingMarks: 33,
    departmentId: '',
    targetClassIds: [],
    subjects: [
      { subjectName: 'Mathematics', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, gradingType: 'NUMERICAL' },
      { subjectName: 'Physics Theory', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, gradingType: 'NUMERICAL' },
      { subjectName: 'Physics Practical Lab', isLabOrPractical: true, maxMarks: 50, passingMarks: 20, gradingType: 'NUMERICAL' },
    ],
  });

  // User's department or accessible departments
  const userRole = (currentOrg?.role || '').toUpperCase();
  const isSuperAccess = ['OWNER', 'ADMIN', 'DIRECTOR', 'PRINCIPAL'].includes(userRole);

  const accessibleDepts = useMemo(() => {
    if (isSuperAccess) return departments;
    return departments.filter(d => d.headId === user?.id || (user?.memberships || []).some(m => m.departmentId === d.id && ['HOD', 'DEAN'].includes(m.role)));
  }, [departments, isSuperAccess, user]);

  const activeDeptId = accessibleDepts[0]?.id || '';

  // All class sections under accessible departments
  const allDepartmentTeams = useMemo(() => {
    const list = [];
    accessibleDepts.forEach(d => {
      (d.teams || []).forEach(t => {
        list.push({ ...t, deptName: d.name, deptId: d.id });
      });
    });
    return list;
  }, [accessibleDepts]);

  // Load exams
  const loadExams = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await examApi.getExams({
        orgId,
        departmentId: isSuperAccess ? undefined : activeDeptId,
      });
      setExams(data || []);
      if (data && data.length > 0 && !selectedExamId) {
        setSelectedExamId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to load exams:', e);
      toast.error('Failed to load department exams');
    } finally {
      setLoading(false);
    }
  }, [orgId, activeDeptId, isSuperAccess, selectedExamId]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // Real-time socket updates for grade submissions
  useEffect(() => {
    const s = getSocket() || connectSocket();
    if (!s) return;
    const handleUpdate = () => {
      loadExams();
      if (selectedExamId) loadDefaulters(selectedExamId);
    };
    s.on('exam:grades_updated', handleUpdate);
    s.on('exam:opened_for_grading', handleUpdate);
    return () => {
      s.off('exam:grades_updated', handleUpdate);
      s.off('exam:opened_for_grading', handleUpdate);
    };
  }, [loadExams, selectedExamId]);

  // Load Defaulters & Absentees for selected exam
  const loadDefaulters = async (examId) => {
    if (!examId) return;
    setDefaultersLoading(true);
    try {
      const res = await examApi.getDefaulters(examId);
      setDefaultersData(res);
    } catch (e) {
      console.error('Failed to load defaulters:', e);
    } finally {
      setDefaultersLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      loadDefaulters(selectedExamId);
    }
  }, [selectedExamId]);

  // Open Exam for Grading
  const handleOpenGrading = async (exam) => {
    try {
      await examApi.openGrading(exam.id);
      toast.success(`Exam "${exam.title}" is now unlocked for Class Teachers to grade!`);
      loadExams();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to open grading');
    }
  };

  // Generate Report Cards for whole department / exam
  const handleGenerateReportCards = async (exam) => {
    try {
      const res = await examApi.generateReportCards(exam.id, {});
      toast.success(`Generated ${res.count} Official Report Cards for ${exam.title}!`);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to generate report cards');
    }
  };

  // Add Subject row in Create Modal
  const handleAddSubject = () => {
    setExamForm(prev => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        {
          subjectName: '',
          isLabOrPractical: false,
          maxMarks: prev.defaultMaxMarks,
          passingMarks: prev.defaultPassingMarks,
          gradingType: prev.defaultGradingType,
        },
      ],
    }));
  };

  const handleRemoveSubject = (index) => {
    setExamForm(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index),
    }));
  };

  const handleSubjectChange = (index, field, value) => {
    setExamForm(prev => {
      const updated = [...prev.subjects];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'isLabOrPractical' && value === true && updated[index].maxMarks === prev.defaultMaxMarks) {
        // Suggested default for labs
        updated[index].maxMarks = 50;
        updated[index].passingMarks = 20;
      }
      return { ...prev, subjects: updated };
    });
  };

  // Toggle class selection for target classes
  const handleToggleClass = (classId) => {
    setExamForm(prev => {
      const exists = prev.targetClassIds.includes(classId);
      return {
        ...prev,
        targetClassIds: exists
          ? prev.targetClassIds.filter(id => id !== classId)
          : [...prev.targetClassIds, classId],
      };
    });
  };

  const handleSelectAllClasses = () => {
    setExamForm(prev => ({
      ...prev,
      targetClassIds: allDepartmentTeams.map(t => t.id),
    }));
  };

  // Create Exam Submit
  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examForm.title.trim()) {
      return toast.error('Please provide an exam title');
    }
    if (examForm.subjects.length === 0) {
      return toast.error('Please add at least one subject/lab component');
    }

    setSavingExam(true);
    try {
      await examApi.createExam({
        ...examForm,
        orgId,
        departmentId: examForm.departmentId || activeDeptId || null,
        targetClassIds: examForm.targetClassIds.length > 0 ? examForm.targetClassIds : allDepartmentTeams.map(t => t.id),
      });
      toast.success('Exam schedule & grading criteria created successfully!');
      setCreateModalOpen(false);
      loadExams();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create exam');
    } finally {
      setSavingExam(false);
    }
  };

  // Filtered Defaulters
  const filteredDefaulters = useMemo(() => {
    const list = defaultersData?.defaulters || [];
    return list.filter(st => {
      if (defaulterFilter === 'ABSENT' && !st.hasAbsence) return false;
      if (defaulterFilter === 'FAILED' && !st.hasFailure) return false;
      if (defaulterSearch.trim()) {
        const q = defaulterSearch.toLowerCase();
        return st.fullName.toLowerCase().includes(q) || st.teamName.toLowerCase().includes(q) || st.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [defaultersData, defaulterFilter, defaulterSearch]);

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent p-5 rounded-2xl border border-primary/20">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">
              HOD / Dean Assessment Suite
            </Badge>
            <span className="text-xs text-muted-foreground">Department Examination & Marks Control</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Exams, Assessments & Marks Governance
          </h2>
          <p className="text-xs text-muted-foreground">
            Schedule department exams, customize subject/lab grading criteria, unlock grading for Class Teachers, and monitor live absentees & failing students.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => {
              setExamForm({
                title: '',
                term: 'Term 1',
                academicSession: '2026-2027',
                examType: 'MID_TERM',
                defaultGradingType: 'NUMERICAL',
                defaultMaxMarks: 100,
                defaultPassingMarks: 33,
                departmentId: activeDeptId,
                targetClassIds: allDepartmentTeams.map(t => t.id),
                subjects: [
                  { subjectName: 'Mathematics', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, gradingType: 'NUMERICAL' },
                  { subjectName: 'Physics Theory', isLabOrPractical: false, maxMarks: 100, passingMarks: 33, gradingType: 'NUMERICAL' },
                  { subjectName: 'Physics Practical Lab', isLabOrPractical: true, maxMarks: 50, passingMarks: 20, gradingType: 'NUMERICAL' },
                ],
              });
              setCreateModalOpen(true);
            }}
            className="gap-2 shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Department Exam
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="exams" className="text-xs gap-2">
            <BookOpen className="h-3.5 w-3.5" /> Department Exams ({exams.length})
          </TabsTrigger>
          <TabsTrigger value="defaulters" className="text-xs gap-2">
            <UserX className="h-3.5 w-3.5 text-amber-500" /> Defaulters & Absentee Tracker
          </TabsTrigger>
        </TabsList>

        {/* 1. EXAMS TAB */}
        <TabsContent value="exams" className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading department examinations...</div>
          ) : exams.length === 0 ? (
            <Card className="border-dashed p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">No Exams Created Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Create a scheduled examination, unit test, or surprise assessment for your department class sections to initiate grading.
              </p>
              <Button
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="mt-4 gap-1.5"
              >
                <Plus className="h-4 w-4" /> Schedule First Exam
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => {
                const isOpen = exam.status === 'OPEN_FOR_GRADING';
                const isDraft = exam.status === 'DRAFT';

                return (
                  <Card key={exam.id} className="border-border hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden shadow-sm">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge
                          variant={isOpen ? 'default' : isDraft ? 'secondary' : 'outline'}
                          className={`text-[10px] font-semibold ${isOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : ''}`}
                        >
                          {isOpen ? 'Open for Grading' : isDraft ? 'Draft Scheduled' : exam.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {exam.term} • {exam.academicSession}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm font-bold text-foreground mt-2 line-clamp-1">
                        {exam.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {exam.examType.replace('_', ' ')} • {exam.subjects?.length || 0} Subjects / Labs
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3">
                      {/* Subject tags preview */}
                      <div className="flex flex-wrap gap-1">
                        {(exam.subjects || []).slice(0, 4).map((sub, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] px-2 py-0.5 rounded-md border ${
                              sub.isLabOrPractical
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {sub.subjectName} ({sub.maxMarks}m / Pass {sub.passingMarks})
                          </span>
                        ))}
                        {(exam.subjects?.length || 0) > 4 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            +{exam.subjects.length - 4} more
                          </span>
                        )}
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg text-xs border border-border/60">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Target Classes</span>
                          <span className="font-semibold text-foreground">
                            {exam.targetTeams?.length || 0} Class Sections
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Scores Recorded</span>
                          <span className="font-semibold text-primary">
                            {exam.totalScoresCount || 0} Submissions
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-2 border-t border-border/60">
                        {isDraft ? (
                          <Button
                            size="sm"
                            className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            onClick={() => handleOpenGrading(exam)}
                          >
                            <Send className="h-3.5 w-3.5" /> Open for Class Teachers to Grade
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 p-2 rounded-md border border-emerald-500/20">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Grading Unlocked
                            </span>
                            <span className="text-muted-foreground text-[10px]">Live Class Access</span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs gap-1"
                            onClick={() => {
                              setSelectedExamId(exam.id);
                              setActiveTab('defaulters');
                            }}
                          >
                            <UserX className="h-3.5 w-3.5 text-amber-500" /> Defaulters ({exam.defaulterScoresCount || 0})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1"
                            onClick={() => handleGenerateReportCards(exam)}
                            title="Generate Official Report Cards"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Report Cards
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. DEFAULTERS & ABSENTEE TRACKER TAB */}
        <TabsContent value="defaulters" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Defaulter & Absentee Monitor</h3>
                <p className="text-[11px] text-muted-foreground">
                  Automated list of all students who failed passing cutoff or were marked absent by Class Teachers
                </p>
              </div>
            </div>

            {/* Exam Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Exam:</span>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Select Exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.title} ({e.term})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant={defaulterFilter === 'ALL' ? 'default' : 'outline'}
                onClick={() => setDefaulterFilter('ALL')}
                className="h-8 text-xs"
              >
                All Issues ({defaultersData?.totalDefaulters || 0})
              </Button>
              <Button
                size="sm"
                variant={defaulterFilter === 'ABSENT' ? 'default' : 'outline'}
                onClick={() => setDefaulterFilter('ABSENT')}
                className="h-8 text-xs gap-1"
              >
                <UserX className="h-3 w-3 text-amber-500" /> Absentees
              </Button>
              <Button
                size="sm"
                variant={defaulterFilter === 'FAILED' ? 'default' : 'outline'}
                onClick={() => setDefaulterFilter('FAILED')}
                className="h-8 text-xs gap-1"
              >
                <AlertCircle className="h-3 w-3 text-rose-500" /> Failing Cutoff
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search student or class..."
                value={defaulterSearch}
                onChange={e => setDefaulterSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Defaulter Records Table */}
          {defaultersLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Scanning marks & absentees...</div>
          ) : filteredDefaulters.length === 0 ? (
            <Card className="border-dashed p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">No Defaulters Found</h4>
              <p className="text-xs text-muted-foreground mt-1">
                All students who have been graded have met passing criteria and no unexcused absentees were recorded.
              </p>
            </Card>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class Section</th>
                    <th className="p-3">Exam Issues / Deficiencies</th>
                    <th className="p-3">Class Teacher Remarks</th>
                    <th className="p-3 text-right">Parent Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDefaulters.map((st) => (
                    <tr key={st.studentId} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={st.avatarUrl} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {initials(st.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-semibold text-foreground block">{st.fullName}</span>
                            <span className="text-[10px] text-muted-foreground">{st.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-medium text-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {st.teamName}
                        </Badge>
                      </td>

                      <td className="p-3 space-y-1">
                        {st.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px]">
                            {issue.isAbsent ? (
                              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                                ABSENT: {issue.subjectName}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                FAILED: {issue.subjectName} ({issue.marksObtained}/{issue.maxMarks} • Pass {issue.passingMarks})
                              </Badge>
                            )}
                          </div>
                        ))}
                      </td>

                      <td className="p-3 text-muted-foreground italic text-[11px] max-w-xs">
                        {st.issues.find(i => i.remarks)?.remarks || 'No notes added'}
                      </td>

                      <td className="p-3 text-right">
                        {st.hasLinkedParent ? (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Parent Linked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Parent Not Linked
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* CREATE EXAM MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Create Department Examination Schedule
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure exam name, target classes, global grading rules, and customize subject or lab overrides.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateExam} className="space-y-4">
            {/* Title & Term Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Exam Title *</Label>
                <Input
                  placeholder="e.g. Mid-Term Examination 2026"
                  value={examForm.title}
                  onChange={e => setExamForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Term / Semester</Label>
                  <Select
                    value={examForm.term}
                    onChange={() => {}}
                    onValueChange={v => setExamForm(prev => ({ ...prev, term: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Term 1" className="text-xs">Term 1</SelectItem>
                      <SelectItem value="Term 2" className="text-xs">Term 2</SelectItem>
                      <SelectItem value="Mid Term" className="text-xs">Mid Term</SelectItem>
                      <SelectItem value="Annual Final" className="text-xs">Annual Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Exam Type</Label>
                  <Select
                    value={examForm.examType}
                    onValueChange={v => setExamForm(prev => ({ ...prev, examType: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MID_TERM" className="text-xs">Mid Term</SelectItem>
                      <SelectItem value="FINAL" className="text-xs">Final Exam</SelectItem>
                      <SelectItem value="UNIT_TEST" className="text-xs">Unit Test</SelectItem>
                      <SelectItem value="SURPRISE_TEST" className="text-xs">Surprise Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Target Department Class Sections */}
            <div className="space-y-2 bg-muted/40 p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Target Class Sections in Department</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllClasses}
                  className="h-6 text-[11px] text-primary"
                >
                  Select All
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {allDepartmentTeams.map(t => {
                  const isSelected = examForm.targetClassIds.includes(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => handleToggleClass(t.id)}
                      className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Global Default Grading Pattern */}
            <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Default Max Marks (Theory)</Label>
                <Input
                  type="number"
                  value={examForm.defaultMaxMarks}
                  onChange={e => setExamForm(prev => ({ ...prev, defaultMaxMarks: Number(e.target.value) }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Default Passing Cutoff</Label>
                <Input
                  type="number"
                  value={examForm.defaultPassingMarks}
                  onChange={e => setExamForm(prev => ({ ...prev, defaultPassingMarks: Number(e.target.value) }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Dynamic Subjects & Lab Overrides */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Subjects & Lab Specific Overrides ({examForm.subjects.length})
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddSubject}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Subject / Lab
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {examForm.subjects.map((sub, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border text-xs"
                  >
                    <Input
                      placeholder="Subject Name (e.g. Chemistry Theory)"
                      value={sub.subjectName}
                      onChange={e => handleSubjectChange(idx, 'subjectName', e.target.value)}
                      className="h-7 text-xs flex-1"
                    />

                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        id={`lab-${idx}`}
                        checked={sub.isLabOrPractical}
                        onChange={e => handleSubjectChange(idx, 'isLabOrPractical', e.target.checked)}
                        className="rounded border-border text-primary focus:ring-0"
                      />
                      <label htmlFor={`lab-${idx}`} className="text-[11px] text-muted-foreground cursor-pointer">
                        Lab / Practical
                      </label>
                    </div>

                    <div className="w-16">
                      <Input
                        type="number"
                        placeholder="Max"
                        title="Max Marks"
                        value={sub.maxMarks}
                        onChange={e => handleSubjectChange(idx, 'maxMarks', Number(e.target.value))}
                        className="h-7 text-xs text-center"
                      />
                    </div>

                    <div className="w-16">
                      <Input
                        type="number"
                        placeholder="Pass"
                        title="Passing Cutoff"
                        value={sub.passingMarks}
                        onChange={e => handleSubjectChange(idx, 'passingMarks', Number(e.target.value))}
                        className="h-7 text-xs text-center"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSubject(idx)}
                      disabled={examForm.subjects.length <= 1}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingExam}
                className="bg-primary text-primary-foreground gap-1.5"
              >
                <Check className="h-4 w-4" /> Save Exam Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

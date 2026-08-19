import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { examApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GraduationCap,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  BookOpen,
  FileSpreadsheet,
  Printer,
  Sparkles,
  HelpCircle,
  Clock,
  UserX,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import StudentReportCardModal from './StudentReportCardModal';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function ClassTeacherGradingMatrix({ orgId, user, classTeams = [], currentOrg }) {
  const [selectedTeamId, setSelectedTeamId] = useState(classTeams[0]?.id || '');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [gradingSheet, setGradingSheet] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Editable local marks state: { [studentId]: { [subjectId]: { marksObtained, isAbsent, remarks } } }
  const [scoresState, setScoresState] = useState({});

  // Report card modal state
  const [reportCardModalOpen, setReportCardModalOpen] = useState(false);
  const [activeReportCard, setActiveReportCard] = useState(null);

  useEffect(() => {
    if (!selectedTeamId && classTeams.length > 0) {
      setSelectedTeamId(classTeams[0].id);
    }
  }, [classTeams, selectedTeamId]);

  // Load active exams available for this class
  useEffect(() => {
    async function loadExamsForClass() {
      if (!orgId || !selectedTeamId) return;
      try {
        const data = await examApi.getExams({ orgId, teamId: selectedTeamId });
        setExams(data || []);
        if (data && data.length > 0) {
          // Default to first open or available exam
          const openExam = data.find(e => e.status === 'OPEN_FOR_GRADING') || data[0];
          setSelectedExamId(openExam.id);
        } else {
          setSelectedExamId('');
          setGradingSheet(null);
        }
      } catch (e) {
        console.error('Failed to load exams for class:', e);
      }
    }
    loadExamsForClass();
  }, [orgId, selectedTeamId]);

  // Load grading sheet data when exam or team changes
  const loadSheet = useCallback(async () => {
    if (!selectedExamId || !selectedTeamId) return;
    setLoadingSheet(true);
    try {
      const data = await examApi.getGradingSheet(selectedExamId, selectedTeamId);
      setGradingSheet(data);

      // Initialize local state from returned student scores
      const initial: Record<string, Record<string, any>> = {};
      (data.students || []).forEach(st => {
        initial[st.studentId] = {};
        (data.exam?.subjects || []).forEach(sub => {
          const sc = st.scores?.[sub.id] || {};
          initial[st.studentId][sub.id] = {
            marksObtained: sc.marksObtained !== undefined && sc.marksObtained !== null ? sc.marksObtained : '',
            isAbsent: !!sc.isAbsent,
            remarks: sc.remarks || '',
          };
        });
      });
      setScoresState(initial);
    } catch (e) {
      console.error('Failed to load grading sheet:', e);
      toast.error('Failed to load class grading sheet');
    } finally {
      setLoadingSheet(false);
    }
  }, [selectedExamId, selectedTeamId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const activeTeam = useMemo(() => {
    return classTeams.find(t => t.id === selectedTeamId) || classTeams[0];
  }, [classTeams, selectedTeamId]);

  const subjects = useMemo(() => gradingSheet?.exam?.subjects || [], [gradingSheet?.exam?.subjects]);
  const students = useMemo(() => gradingSheet?.students || [], [gradingSheet?.students]);

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(st => st.fullName.toLowerCase().includes(q) || (st.rollNo && st.rollNo.toLowerCase().includes(q)));
  }, [students, studentSearch]);

  // Handle Score Input Change
  const handleScoreChange = (studentId, subjectId, field, value) => {
    setScoresState(prev => {
      const studentScores = prev[studentId] || {};
      const currentSub = studentScores[subjectId] || { marksObtained: '', isAbsent: false, remarks: '' };

      const updatedSub = {
        ...currentSub,
        [field]: value,
      };

      // If marked absent, clear marks
      if (field === 'isAbsent' && value === true) {
        updatedSub.marksObtained = '';
      }

      return {
        ...prev,
        [studentId]: {
          ...studentScores,
          [subjectId]: updatedSub,
        },
      };
    });
  };

  // Submit / Save Grades
  const handleSaveGrades = async (isFinal = false) => {
    if (!selectedExamId || !selectedTeamId) return;
    setSaving(true);

    const submissions = [];
    Object.entries(scoresState).forEach(([studentId, subs]) => {
      Object.entries(subs).forEach(([subjectId, data]) => {
        submissions.push({
          studentId,
          subjectId,
          marksObtained: data.marksObtained,
          isAbsent: data.isAbsent,
          remarks: data.remarks,
        });
      });
    });

    try {
      await examApi.submitGrades(selectedExamId, selectedTeamId, {
        submissions,
        isFinalSubmit: isFinal,
      });

      if (isFinal) {
        toast.success('Exam grades submitted to HOD successfully!');
      } else {
        toast.success('Grading draft saved successfully');
      }
      loadSheet();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  // Open Report Card Modal for single student
  const handleOpenStudentReportCard = (student) => {
    const studentScores = scoresState[student.studentId] || {};
    let totalObt = 0;
    let totalMax = 0;
    let hasFailed = false;
    let allAbsent = true;

    const subjectsJson = subjects.map(sub => {
      const sc = studentScores[sub.id] || {};
      const marks = sc.marksObtained !== '' && sc.marksObtained !== null ? Number(sc.marksObtained) : 0;
      const isAbsent = !!sc.isAbsent;
      const isPassed = !isAbsent && marks >= sub.passingMarks;

      if (!isAbsent) {
        allAbsent = false;
        totalObt += marks;
        totalMax += sub.maxMarks;
      }
      if (!isPassed) hasFailed = true;

      return {
        subjectName: sub.subjectName,
        isLabOrPractical: sub.isLabOrPractical,
        maxMarks: sub.maxMarks,
        passingMarks: sub.passingMarks,
        marksObtained: isAbsent ? null : marks,
        grade: isAbsent ? 'ABS' : marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 60 ? 'B' : marks >= 33 ? 'D' : 'F',
        isAbsent,
        isPassed,
        remarks: sc.remarks || '',
      };
    });

    const pct = totalMax > 0 ? Number(((totalObt / totalMax) * 100).toFixed(1)) : 0;

    setActiveReportCard({
      studentName: student.fullName,
      academicSession: gradingSheet?.exam?.academicSession || '2026-2027',
      term: gradingSheet?.exam?.term || 'Term 1',
      subjectsJson,
      totalMarksObtained: totalObt,
      totalMaxMarks: totalMax,
      percentage: pct,
      overallGrade: allAbsent ? 'ABS' : pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 33 ? 'D' : 'F',
      resultStatus: allAbsent ? 'ABSENT' : hasFailed ? 'FAILED' : 'PASSED',
      attendanceStats: { totalDays: 90, daysPresent: 85, percentage: 94.4 },
      aiRemarks: `${student.fullName} demonstrated consistent effort in ${gradingSheet?.exam?.title || 'the assessment'}. Overall performance stands at ${pct}%.`,
      teacherRemarks: 'Academic records reviewed by Class Teacher.',
    });
    setReportCardModalOpen(true);
  };

  // Metrics
  const summaryMetrics = useMemo(() => {
    let totalEntries = 0;
    let gradedCount = 0;
    let absentCount = 0;
    let failedCount = 0;

    Object.values(scoresState).forEach(subs => {
      Object.entries(subs).forEach(([subjectId, sc]) => {
        totalEntries++;
        const sub = subjects.find(s => s.id === subjectId);
        if (sc.isAbsent) {
          absentCount++;
          gradedCount++;
        } else if (sc.marksObtained !== '' && sc.marksObtained !== null) {
          gradedCount++;
          if (sub && Number(sc.marksObtained) < sub.passingMarks) {
            failedCount++;
          }
        }
      });
    });

    return { totalEntries, gradedCount, absentCount, failedCount };
  }, [scoresState, subjects]);

  return (
    <div className="space-y-5">
      {/* Top Banner & Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Class Teacher Exam Marks Portal
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-500 border-purple-500/30">
                Grading Matrix
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Enter subject & lab marks, mark absentees, add custom teacher notes, and submit to HOD
            </p>
          </div>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Section */}
          <div className="w-44">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select Class Section" />
              </SelectTrigger>
              <SelectContent>
                {classTeams.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exam */}
          <div className="w-56">
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select Exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map(e => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.title} ({e.status === 'OPEN_FOR_GRADING' ? '🟢 Open' : 'Draft'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedExamId || exams.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <GraduationCap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-foreground">No Active Exams for this Class Section</h4>
          <p className="text-xs text-muted-foreground mt-1">
            When an HOD or Dean schedules and opens an examination for {activeTeam?.name || 'this class'}, the grading matrix will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary Row & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Users className="h-3.5 w-3.5 text-primary" /> {students.length} Students
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> {summaryMetrics.gradedCount} / {summaryMetrics.totalEntries} Graded
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                <UserX className="h-3.5 w-3.5" /> {summaryMetrics.absentCount} Absences
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> {summaryMetrics.failedCount} Below Cutoff
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search student..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSaveGrades(false)}
                disabled={saving}
                className="h-7 text-xs gap-1"
              >
                <Save className="h-3.5 w-3.5" /> Save Draft
              </Button>

              <Button
                size="sm"
                onClick={() => handleSaveGrades(true)}
                disabled={saving}
                className="h-7 text-xs gap-1 bg-primary text-primary-foreground shadow-sm"
              >
                <Send className="h-3.5 w-3.5" /> Submit to HOD
              </Button>
            </div>
          </div>

          {/* Interactive Matrix Grid */}
          {loadingSheet ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading student roster and subject criteria...</div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto bg-card shadow-sm">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3 w-56">Student Name & Roll No</th>
                    {subjects.map(sub => (
                      <th key={sub.id} className="p-3 text-center min-w-[150px]">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-foreground">{sub.subjectName}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {sub.isLabOrPractical && (
                              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-purple-500/10 text-purple-600">
                                Lab
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Max: {sub.maxMarks} • Pass: {sub.passingMarks}
                            </span>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-center w-28">Report Card</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {filteredStudents.map(student => {
                    const studentScores = scoresState[student.studentId] || {};

                    return (
                      <tr key={student.studentId} className="hover:bg-muted/20 transition-colors">
                        {/* Student Name */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={student.avatarUrl} />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {initials(student.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-semibold text-foreground block">{student.fullName}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{student.rollNo}</span>
                            </div>
                          </div>
                        </td>

                        {/* Subject Marks Columns */}
                        {subjects.map(sub => {
                          const sc = studentScores[sub.id] || { marksObtained: '', isAbsent: false, remarks: '' };
                          const numMarks = sc.marksObtained !== '' && sc.marksObtained !== null ? Number(sc.marksObtained) : null;
                          const isFailed = numMarks !== null && numMarks < sub.passingMarks;
                          const isPass = numMarks !== null && numMarks >= sub.passingMarks;

                          return (
                            <td key={sub.id} className="p-3 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex items-center justify-center gap-2 w-full">
                                  {/* Marks Input */}
                                  <Input
                                    type="number"
                                    placeholder="Marks"
                                    disabled={sc.isAbsent}
                                    value={sc.marksObtained}
                                    onChange={e => handleScoreChange(student.studentId, sub.id, 'marksObtained', e.target.value)}
                                    className={`h-7 w-16 text-center text-xs font-bold transition-all ${
                                      sc.isAbsent
                                        ? 'bg-muted text-muted-foreground'
                                        : isPass
                                        ? 'border-emerald-500/60 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                                        : isFailed
                                        ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400'
                                        : 'border-border'
                                    }`}
                                  />

                                  {/* Absent Checkbox */}
                                  <label
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none"
                                    title="Mark Student Absent"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={sc.isAbsent}
                                      onChange={e => handleScoreChange(student.studentId, sub.id, 'isAbsent', e.target.checked)}
                                      className="rounded border-border text-amber-500 focus:ring-0 h-3.5 w-3.5"
                                    />
                                    <span className={sc.isAbsent ? 'text-amber-500 font-bold' : ''}>Abs</span>
                                  </label>
                                </div>

                                {/* Per-subject Remark / Note */}
                                <Input
                                  placeholder="Notes / Remarks..."
                                  value={sc.remarks}
                                  onChange={e => handleScoreChange(student.studentId, sub.id, 'remarks', e.target.value)}
                                  className="h-6 text-[10px] text-muted-foreground placeholder:text-muted-foreground/40 w-full"
                                />
                              </div>
                            </td>
                          );
                        })}

                        {/* Preview Report Card */}
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenStudentReportCard(student)}
                            className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                            title="Generate & View Official Report Card"
                          >
                            <Printer className="h-3 w-3" /> View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Student Report Card Modal */}
      <StudentReportCardModal
        open={reportCardModalOpen}
        onOpenChange={setReportCardModalOpen}
        reportCard={activeReportCard}
        currentOrg={currentOrg}
      />
    </div>
  );
}

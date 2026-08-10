import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { parentApi, channelApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCheck, CalendarCheck, BookOpen, MessageSquare, AlertTriangle, CheckCircle, Clock, Award, Shield, Sparkles, GraduationCap, Building } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function ParentPortalPage() {
  const navigate = useNavigate();
  const { currentOrg, user } = useAuth();
  const [childrenList, setChildrenList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrg?.role && currentOrg.role !== 'PARENT') {
      navigate('/app/home', { replace: true });
    }
  }, [currentOrg?.role, navigate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const children = await parentApi.getMyChildren();
        const uniqueChildren = Array.from(
          new Map((children || []).map((c) => [c.userId || c.user?.id, c])).values()
        );
        setChildrenList(uniqueChildren);
        if (uniqueChildren?.length > 0) {
          const firstId = uniqueChildren[0].userId || uniqueChildren[0].user?.id;
          setSelectedStudentId(firstId);
          const r = await parentApi.getChildReport(firstId, currentOrg?.id);
          setReport(r);
        }
      } catch (e) {
        toast.error('Failed to load parent portal data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentOrg?.id]);

  const handleSelectChild = async (studentId) => {
    setSelectedStudentId(studentId);
    setLoading(true);
    try {
      const r = await parentApi.getChildReport(studentId, currentOrg?.id);
      setReport(r);
    } catch (e) {
      toast.error('Failed to load child report');
    } finally {
      setLoading(false);
    }
  };

  const handleMessageFaculty = async (userId, roleName) => {
    if (!userId || !currentOrg?.id) return;
    try {
      const dmCh = await channelApi.dm(currentOrg.id, userId);
      navigate(`/app/channels/${dmCh.id}`);
    } catch (e) {
      toast.error(`Failed to open message channel with ${roleName || 'faculty'}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
              Parent Portal Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Monitor your child's attendance statistics, graded homework, and connect with Class Teachers & HOD.
            </p>
          </div>
        </div>

        {childrenList.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Select Student:</span>
            <div className="flex gap-1">
              {childrenList.map((c) => {
                const uId = c.userId || c.user?.id;
                const isSelected = uId === selectedStudentId;
                return (
                  <Button
                    key={uId}
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleSelectChild(uId)}
                    className="text-xs font-semibold"
                  >
                    {c.user?.fullName || 'Child'}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-6">
          {/* Child Card Header */}
          <div className="p-4 rounded-xl border border-border bg-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border border-border">
                <AvatarImage src={report.student?.user?.avatarUrl} />
                <AvatarFallback className="text-sm bg-purple-500/10 text-purple-500 font-bold">
                  {initials(report.student?.user?.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold text-foreground">{report.student?.user?.fullName}</h2>
                <div className="text-xs text-muted-foreground">
                  {report.student?.team?.name || 'Class Section'} · {report.student?.department?.name || 'School Wing'}
                </div>
              </div>
            </div>

            {/* Faculty Contact Cards (Class Teacher & HOD) */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {report.classTeacher && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border shrink-0">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={report.classTeacher.avatarUrl} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {initials(report.classTeacher.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{report.classTeacher.fullName}</div>
                    <div className="text-[10px] text-muted-foreground">Class Teacher</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMessageFaculty(report.classTeacher.id, 'Class Teacher')}
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold ml-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Contact Teacher
                  </Button>
                </div>
              )}

              {report.hodUser && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border shrink-0">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={report.hodUser.avatarUrl} />
                    <AvatarFallback className="text-[10px] bg-purple-500/10 text-purple-500 font-bold">
                      {initials(report.hodUser.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{report.hodUser.fullName}</div>
                    <div className="text-[10px] text-muted-foreground">Head of Department (HOD)</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMessageFaculty(report.hodUser.id, 'HOD')}
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold ml-1.5"
                  >
                    <Building className="h-3.5 w-3.5 mr-1" /> Contact HOD
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Parent AI Assistance Banner Card */}
          <Card className="border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <Sparkles className="h-4 w-4" /> Parent AI Academic Assistant
                  <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">24/7 AI Helper</Badge>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Need help understanding your child's progress, explaining homework concepts, or drafting messages to Class Teachers & HOD? Use your personal Parent AI Companion.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  size="sm"
                  onClick={() => navigate('/app/ai')}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-md w-full sm:w-auto"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Launch Parent AI Assistant
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className={`border-border ${report.attendance?.isLowAttendance ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display">
                    {report.attendance?.percentage}%
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Monthly Attendance Rate</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display">
                    {report.homeworkReport?.filter(h => h.status === 'COMPLETED').length || 0} / {report.homeworkReport?.length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Completed Homework</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold font-display">
                    {report.homeworkReport?.filter(h => h.submission?.gradeScore).length || 0} Graded
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Rubric Scores Released</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graded Homework & Rubric Scores Section */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" /> Child's Homework & Rubric Progress
              </CardTitle>
              <CardDescription className="text-xs">
                View homework assignments, teacher feedback, and criterion-based rubric scores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.homeworkReport?.map((h) => {
                const sub = h.submission;
                const isCompleted = h.status === 'COMPLETED';

                return (
                  <div key={h.id} className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{h.title}</h4>
                        <div className="text-xs text-muted-foreground">Assigned by {h.createdBy?.fullName || 'Teacher'}</div>
                      </div>

                      {sub?.gradeScore !== undefined && sub?.gradeScore !== null ? (
                        <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          Grade: {sub.gradeScore} / {sub.gradeMax || 100}
                        </Badge>
                      ) : isCompleted ? (
                        <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          Grade: - / {sub?.gradeMax || 100}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-semibold bg-amber-500/10 text-amber-500 border-amber-500/30">
                          Pending Submission
                        </Badge>
                      )}
                    </div>

                    {sub?.feedbackNotes && (
                      <div className="p-2.5 rounded-lg bg-muted/40 text-xs text-foreground border border-border/60">
                        <strong className="text-muted-foreground">Teacher Feedback:</strong> "{sub.feedbackNotes}"
                      </div>
                    )}
                  </div>
                );
              })}

              {(!report.homeworkReport || report.homeworkReport.length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No homework assignments logged yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !report && (
        <Card className="border-border shadow-sm p-8 text-center max-w-xl mx-auto space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold mx-auto">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">No Linked Children Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {user?.email?.includes('parent') || currentOrg?.role === 'PARENT'
                ? "Your parent account is not currently linked to any student profile. Please contact the school administration or enter your child's Student ID to link."
                : "You are currently viewing the Parent Portal as a Staff/Administrator. To test child progress tracking, log in with a Parent account or link a student account."}
            </p>
          </div>
        </Card>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      )}
    </motion.div>
  );
}

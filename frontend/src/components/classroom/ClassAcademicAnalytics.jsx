import React, { useEffect, useState, useMemo } from 'react';
import { attendanceApi, homeworkApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  Cell,
} from 'recharts';
import {
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  TrendingUp,
  Search,
  Award,
  Calendar,
  Layers,
  Crown,
  FileCheck,
  Users,
} from 'lucide-react';
import CustomTooltip from '@/components/CustomTooltip';

export default function ClassAcademicAnalytics({ orgId, classTeams, user }) {
  const [selectedTeamId, setSelectedTeamId] = useState(classTeams[0]?.id || '');
  const [attendanceData, setAttendanceData] = useState(null);
  const [homeworkData, setHomeworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    if (!selectedTeamId && classTeams.length > 0) {
      setSelectedTeamId(classTeams[0].id);
    }
  }, [classTeams, selectedTeamId]);

  useEffect(() => {
    async function loadTeamAnalytics() {
      if (!orgId || !selectedTeamId) return;
      setLoading(true);
      try {
        const [attRes, hwRes] = await Promise.all([
          attendanceApi.getTeamAnalytics(selectedTeamId, orgId).catch((err) => {
            console.error('Error fetching team attendance analytics:', err);
            return null;
          }),
          homeworkApi.getTeamAnalytics(selectedTeamId, orgId).catch((err) => {
            console.error('Error fetching team homework analytics:', err);
            return null;
          }),
        ]);
        setAttendanceData(attRes);
        setHomeworkData(hwRes);
      } catch (e) {
        console.error('Failed to load team analytics:', e);
      } finally {
        setLoading(false);
      }
    }
    loadTeamAnalytics();
  }, [orgId, selectedTeamId]);

  const activeTeam = useMemo(() => {
    return classTeams.find((t) => t.id === selectedTeamId) || classTeams[0];
  }, [classTeams, selectedTeamId]);

  // Merge student attendance and homework records
  const combinedStudentLedger = useMemo(() => {
    const attList = attendanceData?.studentLedger || [];
    const hwList = homeworkData?.studentPerformance || [];
    const hwMap = new Map(hwList.map((h) => [h.studentId, h]));

    return attList.map((st) => {
      const hw = hwMap.get(st.studentId);
      return {
        ...st,
        hwSubmitted: hw?.submittedCount || 0,
        hwPending: hw?.pendingCount || 0,
        hwRatePct: hw?.submissionRatePct !== undefined ? hw.submissionRatePct : 100,
        hwAvgScore: hw?.averageScore || null,
      };
    });
  }, [attendanceData, homeworkData]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return combinedStudentLedger;
    const q = studentSearch.toLowerCase();
    return combinedStudentLedger.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }, [combinedStudentLedger, studentSearch]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const avgAttendance = attendanceData?.classAverageAttendancePercentage || 94;
  const avgSubmission = homeworkData?.classSubmissionRatePct || 90;
  const gradedRate = homeworkData?.classGradedRatePct || 85;
  const totalStudents = attendanceData?.totalStudents || 0;
  const totalHomeworks = homeworkData?.totalHomeworks || 0;
  const dailyAttendanceTrends = attendanceData?.dailyTrends || [];
  const assignments = homeworkData?.assignments || [];

  return (
    <div className="space-y-6" data-testid="classroom-academic-analytics">
      {/* Header & Class Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border p-4 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Class Academic & Attendance Analytics
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                {activeTeam?.name || 'Class Section'}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Class Teacher Oversight: Daily attendance fluctuations, homework submission rates, and student performance ledger.
            </p>
          </div>
        </div>

        {classTeams.length > 1 && (
          <div className="flex items-center gap-2">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-56 h-9 text-xs">
                <SelectValue placeholder="Select Class Section" />
              </SelectTrigger>
              <SelectContent>
                {classTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.deptName || 'Wing'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Class Attendance % */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Class Attendance</div>
              <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums flex items-baseline gap-1">
                <span className={avgAttendance >= 85 ? 'text-emerald-400' : 'text-amber-400'}>{avgAttendance}%</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Past 30 days active sessions
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Homework Submission Rate */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Homework Turn-In</div>
              <div className="text-2xl font-extrabold text-blue-400 mt-1 tabular-nums">{avgSubmission}%</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {gradedRate}% evaluated & graded
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Class Roster */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Enrolled Students</div>
              <div className="text-2xl font-extrabold text-purple-400 mt-1 tabular-nums">{totalStudents}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {totalHomeworks} homework assignments
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Top Performing Rate */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Good Attendance</div>
              <div className="text-2xl font-extrabold text-teal-400 mt-1 tabular-nums">
                {combinedStudentLedger.filter((s) => s.percentage >= 85).length}
              </div>
              <div className="text-[11px] text-teal-400 font-semibold mt-0.5">
                Students above 85% attendance
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Charts (Daily Attendance Trend + Homework Assignment Rates) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: 14-Day Attendance Daily Trend */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                14-Day Class Attendance Fluctuations
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Daily Trend</Badge>
            </div>
            <CardDescription className="text-xs">
              Daily Present, Late, and Absent attendance breakdown for {activeTeam?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {dailyAttendanceTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyAttendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="teamAttGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    domain={[60, 100]}
                    unit="%"
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    name="Attendance %"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#teamAttGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No daily attendance trend records available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Homework Assignment Performance */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                Homework Assignments Submission Rates
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Assignment Breakdown</Badge>
            </div>
            <CardDescription className="text-xs">
              Turn-in percentage for recent homework assignments given to this class.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {assignments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assignments} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="subject"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    domain={[0, 100]}
                    unit="%"
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="submissionRatePct"
                    name="Submission Rate %"
                    radius={[6, 6, 0, 0]}
                  >
                    {assignments.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.submissionRatePct >= 85 ? '#3b82f6' : entry.submissionRatePct >= 70 ? '#f59e0b' : '#f43f5e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No homework assignments recorded for this class.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Comprehensive Student-by-Student Performance Ledger */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-500" />
              Student Academic & Attendance Performance Ledger ({filteredStudents.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Complete student-by-student attendance records, homework submissions, and status ratings.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search student or roll no..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/30"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/20 text-muted-foreground">
              <tr>
                <th className="text-left py-2.5 px-3">Student Name</th>
                <th className="text-left py-2.5 px-3">Roll No</th>
                <th className="text-center py-2.5 px-3">Attendance Sessions</th>
                <th className="text-center py-2.5 px-3">Attended (P+L)</th>
                <th className="text-center py-2.5 px-3">Attendance Rate</th>
                <th className="text-center py-2.5 px-3">Homework Submissions</th>
                <th className="text-center py-2.5 px-3">HW Rate</th>
                <th className="text-right py-2.5 px-3">Academic Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredStudents.map((st) => (
                <tr key={st.studentId} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-foreground">{st.studentName}</div>
                    <div className="text-[10px] text-muted-foreground">{st.email}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">{st.rollNo}</td>
                  <td className="py-2.5 px-3 text-center tabular-nums">{st.totalSessions}</td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-emerald-400 font-semibold">
                    {st.presentCount + st.lateCount} / {st.totalSessions}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] tabular-nums font-bold ${
                        st.percentage >= 85
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : st.percentage >= 75
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {st.percentage}%
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums">
                    {st.hwSubmitted} submitted {st.hwPending > 0 && <span className="text-amber-400">({st.hwPending} pending)</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums font-semibold text-blue-400">
                    {st.hwRatePct}%
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        st.percentage >= 85 && st.hwRatePct >= 80
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : st.percentage < 75
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {st.percentage >= 85 && st.hwRatePct >= 80 ? 'EXCELLENT' : st.percentage < 75 ? 'LOW ATTENDANCE' : 'AVERAGE'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

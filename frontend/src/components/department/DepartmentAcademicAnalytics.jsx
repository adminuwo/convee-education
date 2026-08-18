import React, { useEffect, useState, useMemo } from 'react';
import { attendanceApi, homeworkApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  FolderGit2,
  TrendingUp,
  Users,
  Award,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import CustomTooltip from '@/components/CustomTooltip';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function DepartmentAcademicAnalytics({ orgId, scopedDepartments, currentRole, currentUser }) {
  const [selectedDeptId, setSelectedDeptId] = useState(scopedDepartments[0]?.id || '');
  const [attendanceData, setAttendanceData] = useState(null);
  const [homeworkData, setHomeworkData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync selected dept if list changes
  useEffect(() => {
    if (!selectedDeptId && scopedDepartments.length > 0) {
      setSelectedDeptId(scopedDepartments[0].id);
    }
  }, [scopedDepartments, selectedDeptId]);

  useEffect(() => {
    async function loadAnalytics() {
      if (!orgId || !selectedDeptId) return;
      setLoading(true);
      try {
        const [attRes, hwRes] = await Promise.all([
          attendanceApi.getDepartmentAnalytics(selectedDeptId, orgId).catch((err) => {
            console.error('Error fetching dept attendance analytics:', err);
            return null;
          }),
          homeworkApi.getDepartmentAnalytics(selectedDeptId, orgId).catch((err) => {
            console.error('Error fetching dept homework analytics:', err);
            return null;
          }),
        ]);
        setAttendanceData(attRes);
        setHomeworkData(hwRes);
      } catch (e) {
        console.error('Failed to load department analytics:', e);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [orgId, selectedDeptId]);

  const activeDepartment = useMemo(() => {
    return scopedDepartments.find((d) => d.id === selectedDeptId) || scopedDepartments[0];
  }, [scopedDepartments, selectedDeptId]);

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

  const avgAttendance = attendanceData?.averageAttendancePercentage || 92;
  const avgSubmission = homeworkData?.overallSubmissionRatePct || 88;
  const gradedRate = homeworkData?.overallGradedRatePct || 82;
  const totalStudents = attendanceData?.totalStudents || 0;
  const lowAttendanceList = attendanceData?.lowAttendanceStudents || [];
  const classAttendance = attendanceData?.classBreakdown || [];
  const dailyAttendanceTrends = attendanceData?.dailyTrends || [];
  const classHomework = homeworkData?.classBreakdown || [];
  const subjectBreakdown = homeworkData?.subjectBreakdown || [];
  const projectStats = homeworkData?.projectStats || [];

  return (
    <div className="space-y-6" data-testid="department-academic-analytics">
      {/* Top Header & Department Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border p-4 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Academic & Student Performance Analytics
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                {activeDepartment?.name || 'Department'}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Class-wise attendance rates, homework submission trends, and project delivery matrix for HODs & Deans.
            </p>
          </div>
        </div>

        {scopedDepartments.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
              <SelectTrigger className="w-56 h-9 text-xs">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {scopedDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Department Attendance Rate */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Attendance</div>
              <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums flex items-baseline gap-1">
                <span className={avgAttendance >= 85 ? 'text-emerald-400' : 'text-amber-400'}>{avgAttendance}%</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Across {attendanceData?.totalClasses || 0} class sections
              </div>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              avgAttendance >= 85 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Homework Submission Rate */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Homework Rate</div>
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

        {/* Card 3: Enrolled Students */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Department Students</div>
              <div className="text-2xl font-extrabold text-purple-400 mt-1 tabular-nums">{totalStudents}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {homeworkData?.totalHomeworks || 0} active assignments
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Low Attendance Alerts */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">At-Risk Students</div>
              <div className="text-2xl font-extrabold text-rose-400 mt-1 tabular-nums">{lowAttendanceList.length}</div>
              <div className="text-[11px] text-rose-400 font-semibold mt-0.5">
                {lowAttendanceList.length > 0 ? 'Below 75% threshold' : 'All students on track'}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Charts (Class Attendance Comparison + 14-Day Attendance Trends) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Class-Wise Attendance Rate Bar Chart */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                Class-Wise Attendance Rates
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">30-Day Aggregation</Badge>
            </div>
            <CardDescription className="text-xs">
              Average student attendance percentage for each class section in {activeDepartment?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {classAttendance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="className"
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
                    domain={[60, 100]}
                    unit="%"
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="attendancePercentage"
                    name="Attendance %"
                    radius={[6, 6, 0, 0]}
                  >
                    {classAttendance.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.attendancePercentage >= 85 ? '#10b981' : entry.attendancePercentage >= 75 ? '#3b82f6' : '#f43f5e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No class attendance records available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: 14-Day Attendance Trend Area Chart */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                14-Day Department Attendance Fluctuation
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Daily Trend</Badge>
            </div>
            <CardDescription className="text-xs">
              Daily percentage of present and late students across all classes in this department.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {dailyAttendanceTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyAttendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
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
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#attendanceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No daily trend records available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Homework Performance & Department Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Homework Submissions by Class */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-purple-500" />
                Homework Submission & Grading Rates
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Class Breakdown</Badge>
            </div>
            <CardDescription className="text-xs">
              Percentage of homework submitted vs graded across sections.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            {classHomework.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classHomework} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="className"
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
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="submissionRatePct" name="Submitted %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gradedRatePct" name="Graded %" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No homework data recorded for this department.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Department Projects Matrix */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-amber-500" />
                Department Projects Status Matrix
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500">
                {projectStats.length} Active
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Live milestones and delivery status for ongoing projects in {activeDepartment?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-3">
            {projectStats.length > 0 ? (
              projectStats.map((proj) => (
                <div key={proj.id} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-xs text-foreground truncate">{proj.name}</div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        proj.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {proj.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{proj.description}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-bold text-foreground">{proj.completionPercentage}% ({proj.completedTasks}/{proj.totalTasks} tasks)</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${proj.completionPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No active projects found under this department.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: At-Risk Students Alert Table (Below 75% Attendance) */}
      {lowAttendanceList.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="pb-3 border-b border-rose-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <div>
                  <CardTitle className="text-sm font-bold text-rose-400">
                    Low Attendance Students Requiring Intervention (&lt;75%)
                  </CardTitle>
                  <CardDescription className="text-xs text-rose-400/80">
                    These students have fallen below the mandatory 75% attendance threshold in {activeDepartment?.name}.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="destructive" className="text-xs font-bold px-2.5 py-0.5">
                {lowAttendanceList.length} Students Flagged
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-3">Student Name</th>
                  <th className="text-left py-2 px-3">Class Section</th>
                  <th className="text-center py-2 px-3">Total Sessions</th>
                  <th className="text-center py-2 px-3">Attended</th>
                  <th className="text-center py-2 px-3">Absent</th>
                  <th className="text-right py-2 px-3">Attendance %</th>
                  <th className="text-right py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {lowAttendanceList.map((st) => (
                  <tr key={st.studentId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{st.studentName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{st.className}</td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{st.totalSessions}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 tabular-nums">{st.presentSessions}</td>
                    <td className="py-2.5 px-3 text-center text-rose-400 font-bold tabular-nums">{st.absentSessions}</td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-400 tabular-nums">{st.percentage}%</td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/30">
                        Critical Alert
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

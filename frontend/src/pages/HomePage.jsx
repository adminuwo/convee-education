import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ListTodo, MessageSquare, Sparkles, TrendingUp, Users, Building2, Layers, BarChart3, Bell, Timer } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CustomTooltip from '@/components/CustomTooltip';

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

const STATUS_COLORS = { TODO: 'hsl(var(--muted-foreground))', IN_PROGRESS: 'hsl(var(--chart-1))', REVIEW: 'hsl(var(--chart-3))', COMPLETED: 'hsl(var(--chart-4))', BLOCKED: 'hsl(var(--destructive))', CANCELLED: 'hsl(var(--muted))' };

function KpiCard({ icon: Icon, label, value, tone = 'primary', testid }) {
  return (
    <Card className="overflow-hidden" data-testid={testid}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums mt-1">{value ?? '-'}</div>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-${tone}/10 text-${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { user, currentOrg } = useAuth();
  const navigate = useNavigate();
  const [empData, setEmpData] = useState(null);
  const [mgrData, setMgrData] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = currentOrg?.role;
  const isManagerPlus = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'DIRECTOR'].includes(role);
  const isAdmin = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DIRECTOR'].includes(role);

  useEffect(() => {
    if (!currentOrg?.id) return;
    (async () => {
      setLoading(true);
      try {
        const [e, m, o] = await Promise.all([
          dashboardApi.employee(currentOrg.id).catch(() => null),
          isManagerPlus ? dashboardApi.manager(currentOrg.id).catch(() => null) : Promise.resolve(null),
          isAdmin ? dashboardApi.orgAdmin(currentOrg.id).catch(() => null) : Promise.resolve(null),
        ]);
        setEmpData(e); setMgrData(m); setOrgData(o);
      } finally { setLoading(false); }
    })();
  }, [currentOrg?.id, isAdmin, isManagerPlus]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="home-page">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Good to see you, {user?.fullName?.split(' ')[0] || 'there'}.</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening in <span className="text-foreground font-medium">{currentOrg?.name}</span> today.</p>
      </div>

      {/* KPI Row - varies by role */}
      {isAdmin && orgData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-row">
          <KpiCard icon={Users} label="Members" value={orgData.metrics.members} tone="primary" testid="kpi-members" />
          <KpiCard icon={Building2} label="Departments" value={orgData.metrics.departments} tone="accent" testid="kpi-departments" />
          <KpiCard icon={Layers} label="Projects" value={orgData.metrics.projects} tone="info" testid="kpi-projects" />
          <KpiCard icon={Sparkles} label="AI messages" value={orgData.aiUsage} tone="accent" testid="kpi-ai" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-row">
          <KpiCard icon={ListTodo} label="My tasks" value={empData?.myTasks?.length ?? 0} tone="primary" testid="kpi-mytasks" />
          <KpiCard icon={Timer} label="Upcoming meetings" value={empData?.myMeetings?.length ?? 0} tone="accent" testid="kpi-meetings" />
          <KpiCard icon={Bell} label="Unread notifs" value={empData?.unreadNotifications ?? 0} tone="warning" testid="kpi-notifs" />
          <KpiCard icon={MessageSquare} label="My channels" value={empData?.myChannels ?? 0} tone="info" testid="kpi-channels" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My tasks (all roles) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">My tasks</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/tasks')}>View all</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(empData?.myTasks || []).slice(0, 6).map((t) => (
                <button key={t.id} onClick={() => navigate('/app/tasks')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left">
                  <div className={`h-2 w-2 rounded-full ${t.status === 'COMPLETED' ? 'bg-emerald-500' : t.status === 'BLOCKED' ? 'bg-destructive' : t.priority === 'URGENT' ? 'bg-orange-500' : 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.project?.name || 'No project'} · {t.priority}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{t.status.replace('_', ' ')}</Badge>
                </button>
              ))}
              {(!empData?.myTasks?.length) && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  You're all clear. 🎉 <Button variant="link" onClick={() => navigate('/app/tasks')} className="px-1">Create a task</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task status donut */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Task status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="count" data={(empData?.taskStatusChart || []).length ? empData.taskStatusChart : [{ status: 'None', count: 1 }]} innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {(empData?.taskStatusChart || [{ status: 'None' }]).map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || 'hsl(var(--muted))'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(empData?.taskStatusChart || []).map((s) => (
                <div key={s.status} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[s.status] }} />
                  {s.status.replace('_', ' ')} <span className="tabular-nums text-muted-foreground">({s.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manager view */}
      {isManagerPlus && mgrData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Team workload</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mgrData.workload.map(w => ({ name: w.user?.fullName?.split(' ')[0] || 'Unknown', tasks: w.openTasks }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent) / 0.15)', rx: 4 }} />
                    <Bar dataKey="tasks" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Recent activity</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {(mgrData.recentActivity || []).slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={t.createdBy?.avatarUrl} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(t.createdBy?.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground">Updated {new Date(t.updatedAt).toLocaleString()}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase">{t.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Org admin view */}
      {isAdmin && orgData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Member growth</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={orgData.growth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ fill: 'hsl(var(--chart-1))', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Organization overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Teams" value={orgData.metrics.teams} />
                <Stat label="Channels" value={orgData.metrics.channels} />
                <Stat label="Tasks total" value={orgData.metrics.tasks} />
                <Stat label="Meetings" value={orgData.metrics.meetings} />
                <Stat label="Files" value={orgData.metrics.files} />
                <Stat label="Active channels" value={orgData.channelsActive} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold tabular-nums mt-1">{value ?? '-'}</div>
    </div>
  );
}

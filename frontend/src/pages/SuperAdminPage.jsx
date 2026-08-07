import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Building2, MessageSquare, ListTodo, Sparkles, HardDrive, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import CustomTooltip from '@/components/CustomTooltip';

function KpiCard({ icon: Icon, label, value }) {
  return (
    <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="font-display text-2xl font-semibold mt-1 tabular-nums">{value ?? '-'}</div></div><div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div></div></CardContent></Card>
  );
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.systemRole !== 'SUPER_ADMIN') { setLoading(false); return; }
    (async () => { try { setData(await dashboardApi.superAdmin()); } catch { } finally { setLoading(false); } })();
  }, [user]);

  if (user && user.systemRole !== 'SUPER_ADMIN') return <Navigate to="/app/home" replace />;

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-8 w-56" /><div className="grid grid-cols-4 gap-3">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-24"/>)}</div></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Super Admin</h1>
        <p className="text-muted-foreground">Platform-wide visibility across all organizations</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Building2} label="Organizations" value={data?.metrics.orgs} />
        <KpiCard icon={Users} label="Total users" value={data?.metrics.users} />
        <KpiCard icon={Activity} label="Active (24h)" value={data?.metrics.activeUsers} />
        <KpiCard icon={MessageSquare} label="Messages" value={data?.metrics.messages} />
        <KpiCard icon={ListTodo} label="Tasks" value={data?.metrics.tasks} />
        <KpiCard icon={Sparkles} label="AI messages" value={data?.metrics.aiMessages} />
        <KpiCard icon={HardDrive} label="Files" value={data?.metrics.files} />
        <KpiCard icon={Building2} label="Channels" value={data?.metrics.channels} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">User growth (last 6 months)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.growth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { superAdminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
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
  BarChart,
  Bar,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  Building2,
  MessageSquare,
  ListTodo,
  Sparkles,
  HardDrive,
  Activity,
  PlusCircle,
  Eye,
  Copy,
  Check,
  Search,
  School,
  UserCheck,
  ShieldAlert,
  ArrowUpRight,
  RefreshCw,
  GraduationCap,
  Scale,
  Coins,
  DollarSign,
  Cpu,
  ShieldCheck,
  Download,
  BrainCircuit,
  HeartHandshake,
  AlertTriangle,
  FileSpreadsheet,
  TrendingUp,
  Calendar,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import CustomTooltip from '@/components/CustomTooltip';
import { toast } from 'sonner';

function KpiCard({ icon: Icon, label, value, subtext, color = 'text-primary' }) {
  return (
    <Card className="border-border/60 hover:border-primary/40 transition-all shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
            <div className="font-display text-2xl font-bold mt-1 tabular-nums">{value ?? '-'}</div>
            {subtext && <div className="text-[11px] text-muted-foreground mt-0.5">{subtext}</div>}
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center bg-primary/10 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminPage() {
  const { user, switchOrg } = useAuth();
  const [activeTab, setActiveTab] = useState('campuses'); // 'campuses' | 'ai-telemetry'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Token & Safety Telemetry State
  const [tokenData, setTokenData] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [telemetryViewMode, setTelemetryViewMode] = useState('daily'); // 'daily' | 'monthly' | 'hourly' | 'leaderboard'

  // Provisioning Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    campusType: 'K-12 School',
    description: '',
    enableAiLegal: false,
    directorName: '',
    directorEmail: '',
    directorPassword: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, tRes] = await Promise.all([
        superAdminApi.dashboard(),
        superAdminApi.tokenAnalytics().catch(() => null),
      ]);
      setData(res);
      if (tRes) setTokenData(tRes);
    } catch (err) {
      toast.error('Failed to load Super Admin dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenDataOnly = async () => {
    try {
      setTokenLoading(true);
      const tRes = await superAdminApi.tokenAnalytics();
      setTokenData(tRes);
      toast.success('AI Token & Safety telemetry refreshed!');
    } catch (err) {
      toast.error('Failed to refresh token telemetry');
    } finally {
      setTokenLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.systemRole !== 'SUPER_ADMIN') {
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  if (user && user.systemRole !== 'SUPER_ADMIN') return <Navigate to="/app/home" replace />;

  const handleOpenModal = () => {
    const defaultPass = `Director${Math.floor(1000 + Math.random() * 9000)}!`;
    setFormData({
      name: '',
      slug: '',
      campusType: 'K-12 School',
      description: '',
      enableAiLegal: false,
      directorName: '',
      directorEmail: '',
      directorPassword: defaultPass,
    });
    setCreatedResult(null);
    setIsModalOpen(true);
  };

  const handleToggleAiLegal = async (org) => {
    const nextState = !org.hasAiLegal;
    try {
      toast.info(`${nextState ? 'Enabling' : 'Disabling'} AI-Legal Add-on for "${org.name}"...`);
      await superAdminApi.updateOrgAddons(org.id, { enableAiLegal: nextState });
      toast.success(`AI-Legal Add-on ${nextState ? 'enabled' : 'disabled'} for "${org.name}"`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update organization add-on');
    }
  };

  const handleToggleAutoMonthlyReset = async (org, e) => {
    e?.stopPropagation();
    const currentPaused = (org.description || '').toUpperCase().includes('AI_LEGAL_AUTO_RENEW_PAUSED');
    const nextAutoReset = currentPaused;
    try {
      toast.info(`${nextAutoReset ? 'Resuming' : 'Pausing'} Auto-Monthly Plan Reset for "${org.name}"...`);
      await superAdminApi.updateOrgAddons(org.id, { aiLegalAutoMonthlyReset: nextAutoReset });
      toast.success(`Auto-Monthly Reset ${nextAutoReset ? 'active' : 'paused'} for "${org.name}"`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update auto-monthly reset status');
    }
  };

  const handleRenewAiLegalNow = async (org, e) => {
    e?.stopPropagation();
    try {
      toast.info(`Renewing student academic plans for "${org.name}"...`);
      const res = await superAdminApi.renewAiLegalOrg(org.id);
      toast.success(res.message || `Successfully renewed student plans for "${org.name}"!`);
      fetchData();
    } catch (err) {
      toast.error('Failed to trigger instant plan renewal');
    }
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    setFormData((prev) => ({ ...prev, name, slug: autoSlug }));
  };

  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Institution name is required');
    if (!formData.directorName.trim()) return toast.error('Director full name is required');
    if (!formData.directorEmail.trim()) return toast.error('Director email is required');

    try {
      setProvisioning(true);
      const res = await superAdminApi.provisionOrg(formData);
      setCreatedResult(res);
      toast.success(`Successfully provisioned "${res.organization.name}"!`);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to provision organization';
      toast.error(msg);
    } finally {
      setProvisioning(false);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShadowEnter = (org) => {
    toast.info(`Entering "${org.name}" in Shadow Mode...`);
    switchOrg(org.id, org);
  };

  // Export Invoicing CSV for Organizations
  const exportTokenUsageCsv = () => {
    if (!tokenData?.orgLeaderboard || tokenData.orgLeaderboard.length === 0) {
      return toast.error('No organization token usage records to export');
    }

    const headers = [
      'Organization Name',
      'Slug / Domain',
      'Campus Type',
      'Total Tokens',
      'Prompt Tokens',
      'Completion Tokens',
      'Student Tokens',
      'Teacher & Staff Tokens',
      'Total Cost (USD)',
      'Total Cost (INR)',
      'Active Students',
      'Active Teachers',
      'Total AI Queries',
      'Last Active Timestamp',
    ];

    const rows = tokenData.orgLeaderboard.map((o) => [
      `"${(o.orgName || '').replace(/"/g, '""')}"`,
      `"${o.slug}"`,
      `"${o.campusType}"`,
      o.totalTokens,
      o.promptTokens,
      o.completionTokens,
      o.studentTokens,
      o.teacherTokens,
      o.estimatedCostUsd,
      o.estimatedCostInr,
      o.activeStudentsCount,
      o.activeTeachersCount,
      o.queryCount,
      o.lastActive ? new Date(o.lastActive).toISOString() : 'Never',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `convee_ai_campus_invoicing_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Campus Invoicing CSV Report!');
  };

  const exportMonthlyBillingCsv = () => {
    if (!tokenData?.monthlyHistory || tokenData.monthlyHistory.length === 0) {
      return toast.error('No monthly billing records to export');
    }

    const headers = [
      'Billing Month (Key)',
      'Month Display Name',
      'Total Tokens',
      'Prompt Tokens',
      'Completion Tokens',
      'Student Study Tokens',
      'Faculty & Staff Tokens',
      'Total Cost (USD)',
      'Total Cost (INR)',
      'Total AI Queries',
      'Active Campuses',
      'Active Learners',
      'Settlement Status',
    ];

    const rows = tokenData.monthlyHistory.map((m) => [
      `"${m.monthKey}"`,
      `"${m.monthName}"`,
      m.totalTokens,
      m.promptTokens,
      m.completionTokens,
      m.studentTokens,
      m.teacherTokens,
      m.estimatedCostUsd,
      m.estimatedCostInr,
      m.queryCount,
      m.activeOrgsCount,
      m.activeUsersCount,
      m.isCurrentMonth ? 'ACTIVE_UNBILLED' : 'FINALIZED_INVOICED',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `convee_ai_monthly_billing_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Monthly Billing Ledger CSV!');
  };

  const exportDailyTelemetryCsv = () => {
    if (!tokenData?.dailyTrends || tokenData.dailyTrends.length === 0) {
      return toast.error('No daily telemetry records to export');
    }

    const headers = [
      'Date (YYYY-MM-DD)',
      'Display Date',
      'Total Metered Tokens',
      'Student Tokens',
      'Faculty Tokens',
      'AI Queries',
      'Cost (USD)',
      'Cost (INR)',
    ];

    const rows = tokenData.dailyTrends.map((d) => [
      `"${d.date}"`,
      `"${d.displayDate}"`,
      d.totalTokens,
      d.studentTokens,
      d.teacherTokens,
      d.queryCount || 0,
      d.costUsd,
      d.costInr,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `convee_ai_30day_daily_velocity_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded 30-Day Daily Velocity CSV!');
  };

  const exportHourlyDistributionCsv = () => {
    if (!tokenData?.hourlyDistribution || tokenData.hourlyDistribution.length === 0) {
      return toast.error('No hourly distribution data to export');
    }

    const headers = [
      'Hour of Day (0-23)',
      'Time Window',
      'Total Tokens Consumed',
      'Student Study Tokens',
      'Faculty & Staff Tokens',
      'Total AI Queries',
      'Percentage of Platform Traffic',
    ];

    const rows = tokenData.hourlyDistribution.map((h) => [
      h.hour,
      `"${h.fullLabel}"`,
      h.totalTokens,
      h.studentTokens,
      h.teacherTokens,
      h.queryCount,
      `${h.percentage}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `convee_ai_24h_peak_traffic_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded 24-Hour Peak Traffic CSV Report!');
  };

  const filteredOrgs = (data?.organizations || []).filter((org) => {
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.slug?.toLowerCase().includes(q) ||
      org.owner?.fullName?.toLowerCase().includes(q) ||
      org.owner?.email?.toLowerCase().includes(q)
    );
  });

  const filteredLeaderboard = (tokenData?.orgLeaderboard || []).filter((org) => {
    const q = tokenSearchQuery.toLowerCase();
    return (
      org.orgName.toLowerCase().includes(q) ||
      org.slug?.toLowerCase().includes(q) ||
      org.campusType?.toLowerCase().includes(q)
    );
  });

  if (loading && !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert className="h-3.5 w-3.5" /> SUPER ADMIN
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Platform Command Hub
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Tenant provisioning, AI token metered billing telemetry, student & faculty guardrails, and shadow inspection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={activeTab === 'ai-telemetry' ? fetchTokenDataOnly : fetchData}
            disabled={loading || tokenLoading}
            className="gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading || tokenLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleOpenModal}
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-primary-foreground shadow-md shadow-primary/20"
          >
            <PlusCircle className="h-4 w-4" />
            Provision New School
          </Button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveTab('campuses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'campuses'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Campuses & Tenancy
          <Badge variant="outline" className={`ml-1 text-[11px] ${activeTab === 'campuses' ? 'bg-primary-foreground/20 text-primary-foreground border-transparent' : ''}`}>
            {data?.organizations?.length || 0}
          </Badge>
        </button>

        <button
          onClick={() => {
            setActiveTab('ai-telemetry');
            if (!tokenData) fetchTokenDataOnly();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'ai-telemetry'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          AI Token & Billing Telemetry
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>
      </div>

      {/* ================= TAB 1: CAMPUSES & TENANCY ================= */}
      {activeTab === 'campuses' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={Building2}
              label="Total Campuses"
              value={data?.metrics.orgs}
              subtext="Active tenant workspaces"
              color="text-indigo-500"
            />
            <KpiCard
              icon={Users}
              label="Total Registered Users"
              value={data?.metrics.users}
              subtext="Faculty, Students & Staff"
              color="text-emerald-500"
            />
            <KpiCard
              icon={Activity}
              label="Active (Last 24h)"
              value={data?.metrics.activeUsers}
              subtext="Live daily campus sessions"
              color="text-sky-500"
            />
            <KpiCard
              icon={Sparkles}
              label="AI Messages"
              value={data?.metrics.aiMessages}
              subtext="AI Assistant inquiries"
              color="text-purple-500"
            />
            <KpiCard
              icon={MessageSquare}
              label="Total Messages"
              value={data?.metrics.messages}
              subtext="Across public & team channels"
              color="text-amber-500"
            />
            <KpiCard
              icon={ListTodo}
              label="Academic Tasks"
              value={data?.metrics.tasks}
              subtext="Homework & practical projects"
              color="text-rose-500"
            />
            <KpiCard
              icon={HardDrive}
              label="Stored Files"
              value={data?.metrics.files}
              subtext="Assets & verified reports"
              color="text-teal-500"
            />
            <KpiCard
              icon={Building2}
              label="Active Channels"
              value={data?.metrics.channels}
              subtext="Communication feeds"
              color="text-cyan-500"
            />
          </div>

          {/* Organizations Directory & Shadow Access Table */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 border-b border-border/40 bg-muted/20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <School className="h-5 w-5 text-primary" />
                    Provisioned Institutions & Workspaces ({data?.organizations?.length || 0})
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Inspect any school in Shadow Mode without appearing on internal staff rosters.
                  </CardDescription>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campus or director..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm bg-background"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border/40 font-medium">
                    <tr>
                      <th className="px-5 py-3.5">Institution & Domain</th>
                      <th className="px-5 py-3.5">Director / Owner</th>
                      <th className="px-5 py-3.5 text-center">Add-ons</th>
                      <th className="px-5 py-3.5 text-center">Members</th>
                      <th className="px-5 py-3.5 text-center">Wings / Depts</th>
                      <th className="px-5 py-3.5 text-center">Channels</th>
                      <th className="px-5 py-3.5">Provisioned Date</th>
                      <th className="px-5 py-3.5 text-right">Shadow Inspection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                          No institutions match your search query. Click "+ Provision New School" to create one.
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((org) => (
                        <tr
                          key={org.id}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                                {org.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">{org.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  /{org.slug}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                              <div>
                                <div className="font-medium text-foreground text-xs">
                                  {org.owner?.fullName || 'Appointed Director'}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {org.owner?.email || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {org.hasAiLegal ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    onClick={() => handleToggleAiLegal(org)}
                                    className="cursor-pointer bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20 transition-colors gap-1 text-[11px] font-medium"
                                    title="Click to toggle AI-Legal Add-on"
                                  >
                                    <Scale className="h-3 w-3" /> AI-Legal
                                  </Badge>
                                  <button
                                    type="button"
                                    onClick={(e) => handleRenewAiLegalNow(org, e)}
                                    className="p-1 rounded hover:bg-purple-500/10 text-purple-600 hover:text-purple-700 transition-colors"
                                    title="Instantly Renew Student Plans for this Campus"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleAutoMonthlyReset(org, e)}
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
                                    (org.description || '').toUpperCase().includes('AI_LEGAL_AUTO_RENEW_PAUSED')
                                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                                  }`}
                                  title="Click to toggle automated 1st-of-month student plan resets"
                                >
                                  {(org.description || '').toUpperCase().includes('AI_LEGAL_AUTO_RENEW_PAUSED')
                                    ? 'Auto-Reset: Paused'
                                    : 'Auto-Reset: Active (1st/mo)'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleAiLegal(org)}
                                className="text-[11px] text-muted-foreground hover:text-primary transition-colors hover:underline"
                                title="Click to enable AI-Legal for this campus"
                              >
                                + Add AI-Legal
                              </button>
                            )}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {org.metrics?.members ?? 0}
                            </Badge>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <Badge variant="outline" className="font-mono text-xs">
                              {org.metrics?.departments ?? 0}
                            </Badge>
                          </td>

                          <td className="px-5 py-4 text-center text-xs text-muted-foreground font-mono">
                            {org.metrics?.channels ?? 0}
                          </td>

                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {new Date(org.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShadowEnter(org)}
                              className="gap-1.5 text-xs font-medium border-primary/30 hover:bg-primary hover:text-primary-foreground transition-all shadow-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Inspect Campus
                              <ArrowUpRight className="h-3 w-3 opacity-60" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* User Growth Chart */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="p-5 sm:p-6 border-b border-border/40">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Platform User Growth Trend (Last 6 Months)
              </CardTitle>
              <CardDescription className="text-xs">
                Aggregated institutional user registrations across all provisioned campuses.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.growth || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= TAB 2: AI TOKEN & BILLING TELEMETRY ================= */}
      {activeTab === 'ai-telemetry' && (
        <div className="space-y-6">
          {/* AI Telemetry Header KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-background to-background shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wider font-semibold">
                      Today's Consumption
                    </div>
                    <div className="font-display text-2xl font-bold mt-1 tabular-nums text-foreground">
                      {(tokenData?.dailySummary?.today?.totalTokens || 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      ₹{(tokenData?.dailySummary?.today?.costInr || 0).toLocaleString()} • {tokenData?.dailySummary?.today?.queryCount || 0} queries today
                    </div>
                  </div>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-purple-500/20 text-purple-600">
                    <Coins className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-background shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <span>MTD Invoiced ({tokenData?.monthlySummary?.currentMonth?.monthName || 'Current Month'})</span>
                    </div>
                    <div className="font-display text-2xl font-bold mt-1 tabular-nums text-foreground">
                      ₹{(tokenData?.monthlySummary?.currentMonth?.costInr || 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                      Proj. Month-End: ₹{(tokenData?.monthlySummary?.currentMonth?.projectedMonthEndCostInr || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-sky-600 dark:text-sky-400 uppercase tracking-wider font-semibold">
                      Peak Traffic Window
                    </div>
                    <div className="font-display text-xl font-bold mt-1 tabular-nums text-foreground">
                      {tokenData?.dailySummary?.peakHour?.label || '10 AM'}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {tokenData?.dailySummary?.peakHour?.percentage || 0}% load • Peak Day: {tokenData?.dailySummary?.peakDay?.displayDate || 'N/A'}
                    </div>
                  </div>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-sky-500/20 text-sky-600">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-background to-background shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider font-semibold">
                      Safety & Guardrails
                    </div>
                    <div className="font-display text-2xl font-bold mt-1 tabular-nums text-foreground flex items-center gap-1.5">
                      <span>100%</span>
                      <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {tokenData?.guardrailSummary?.crisisCount || 0} Crisis Assists | {tokenData?.guardrailSummary?.reframedCount || 0} Reframed
                    </div>
                  </div>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-rose-500/20 text-rose-600">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Model & Role Breakdown Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Breakdown by Role */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-4 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Token Consumption by Role
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(!tokenData?.roleBreakdown || tokenData.roleBreakdown.length === 0) ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">No token logs recorded yet.</div>
                ) : (
                  tokenData.roleBreakdown.map((r) => {
                    const totalAll = tokenData.summary.totalTokens || 1;
                    const percent = Math.round((r.totalTokens / totalAll) * 100);
                    return (
                      <div key={r.role} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{r.role}</span>
                          <span className="font-mono text-muted-foreground">
                            {r.totalTokens.toLocaleString()} tokens ({percent}%) • ₹{(r.estimatedCost * 86.5).toFixed(2)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${
                              r.role === 'STUDENT' ? 'bg-purple-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(percent, 2)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Breakdown by Provider / Model */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-4 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Provider & Model Routing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(!tokenData?.modelBreakdown || tokenData.modelBreakdown.length === 0) ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">No model queries logged yet.</div>
                ) : (
                  tokenData.modelBreakdown.map((m) => (
                    <div
                      key={`${m.provider}-${m.model}`}
                      className="p-3 bg-muted/40 rounded-xl border border-border/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{m.model}</div>
                        <div className="text-[11px] text-muted-foreground uppercase">{m.provider}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-foreground">{m.totalTokens.toLocaleString()} tokens</div>
                        <div className="text-[11px] text-emerald-600 font-medium">₹{(m.estimatedCost * 86.5).toFixed(2)} (${m.estimatedCost.toFixed(4)} USD)</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Granularity & View Mode Navigation */}
          <div className="flex items-center gap-2 border-b border-border/40 pb-3 overflow-x-auto">
            <button
              onClick={() => setTelemetryViewMode('daily')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                telemetryViewMode === 'daily'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              30-Day Daily Velocity
            </button>

            <button
              onClick={() => setTelemetryViewMode('monthly')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                telemetryViewMode === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Monthly Billing Ledger
            </button>

            <button
              onClick={() => setTelemetryViewMode('hourly')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                telemetryViewMode === 'hourly'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Peak Usage by Time of Day (24h)
            </button>

            <button
              onClick={() => setTelemetryViewMode('leaderboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                telemetryViewMode === 'leaderboard'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Campus Invoicing Leaderboard
            </button>
          </div>

          {/* VIEW 1: 30-DAY DAILY VELOCITY */}
          {telemetryViewMode === 'daily' && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-5 sm:p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    30-Day Daily Token Consumption Velocity
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Day-by-day metered student curriculum study tokens vs faculty & administrative inquiries.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-purple-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Student Tokens
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span> Faculty Tokens
                    </span>
                  </div>

                  <Button
                    onClick={exportDailyTelemetryCsv}
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0 bg-background hover:bg-muted text-xs h-8"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Daily CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tokenData?.dailyTrends || []}>
                    <defs>
                      <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="teacherGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="displayDate" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="studentTokens"
                      name="Student Tokens"
                      stroke="#9333ea"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#studentGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="teacherTokens"
                      name="Faculty Tokens"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#teacherGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* VIEW 2: MONTHLY BILLING LEDGER */}
          {telemetryViewMode === 'monthly' && (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Monthly Billing Ledger & Invoicing History
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Aggregated calendar month token statements for corporate and institutional accounting.
                  </CardDescription>
                </div>

                <Button
                  onClick={exportMonthlyBillingCsv}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0 bg-background hover:bg-muted text-xs h-8"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Monthly Invoicing CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border/40 font-medium">
                      <tr>
                        <th className="px-5 py-3.5">Billing Period</th>
                        <th className="px-5 py-3.5 text-center">Total Tokens</th>
                        <th className="px-5 py-3.5 text-center">Prompt / Output</th>
                        <th className="px-5 py-3.5 text-center">Student vs Faculty</th>
                        <th className="px-5 py-3.5 text-center">Invoiced (₹ INR)</th>
                        <th className="px-5 py-3.5 text-center">Invoiced ($ USD)</th>
                        <th className="px-5 py-3.5 text-center">Active Campuses</th>
                        <th className="px-5 py-3.5 text-right">Billing Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {(!tokenData?.monthlyHistory || tokenData.monthlyHistory.length === 0) ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground text-xs">
                            No monthly billing statements recorded yet.
                          </td>
                        </tr>
                      ) : (
                        tokenData.monthlyHistory.map((m) => (
                          <tr key={m.monthKey} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-foreground">{m.monthName}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{m.monthKey} • {m.queryCount} queries</div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <Badge variant="secondary" className="font-mono text-xs font-bold">
                                {m.totalTokens.toLocaleString()}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-center text-xs font-mono text-muted-foreground">
                              {m.promptTokens.toLocaleString()} / {m.completionTokens.toLocaleString()}
                            </td>
                            <td className="px-5 py-4 text-center text-xs">
                              <span className="text-purple-600 font-medium">{m.studentTokens.toLocaleString()}</span>
                              <span className="text-muted-foreground"> / </span>
                              <span className="text-indigo-600 font-medium">{m.teacherTokens.toLocaleString()}</span>
                            </td>
                            <td className="px-5 py-4 text-center font-mono font-bold text-emerald-600">
                              ₹{m.estimatedCostInr.toLocaleString()}
                            </td>
                            <td className="px-5 py-4 text-center font-mono text-xs text-muted-foreground">
                              ${m.estimatedCostUsd.toFixed(4)}
                            </td>
                            <td className="px-5 py-4 text-center text-xs">
                              {m.activeOrgsCount} campuses ({m.activeUsersCount} users)
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Badge
                                variant="outline"
                                className={
                                  m.isCurrentMonth
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px]'
                                    : 'bg-muted text-muted-foreground text-[11px]'
                                }
                              >
                                {m.isCurrentMonth ? 'Active Billing' : 'Finalized'}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* VIEW 3: 24-HOUR PEAK USAGE BY TIME OF DAY */}
          {telemetryViewMode === 'hourly' && (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-5 sm:p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    24-Hour Peak Traffic Load & Time-of-Day Analysis
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Analyze when the AI service is utilized most (school hours vs evening study sessions) without any message privacy exposure.
                  </CardDescription>
                </div>

                <Button
                  onClick={exportHourlyDistributionCsv}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0 bg-background hover:bg-muted text-xs h-8"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Hourly CSV
                </Button>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokenData?.hourlyDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={1} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="studentTokens" name="Student Study Tokens" fill="#9333ea" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="teacherTokens" name="Faculty Tokens" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* VIEW 4 / DEFAULT: CAMPUS LEADERBOARD */}
          {(telemetryViewMode === 'leaderboard' || telemetryViewMode === 'overview') && (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 border-b border-border/40 bg-muted/20">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Campus Token Invoicing Leaderboard ({tokenData?.orgLeaderboard?.length || 0})
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Metered consumption breakdown per tenant for monthly billing and institutional invoicing.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search institution..."
                        value={tokenSearchQuery}
                        onChange={(e) => setTokenSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm bg-background"
                      />
                    </div>

                    <Button
                      onClick={exportTokenUsageCsv}
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0 bg-background hover:bg-muted"
                    >
                      <Download className="h-4 w-4" />
                      Export Invoicing CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border/40 font-medium">
                      <tr>
                        <th className="px-5 py-3.5">Institution & Campus</th>
                        <th className="px-5 py-3.5 text-center">Total Tokens</th>
                        <th className="px-5 py-3.5 text-center">Student Tokens</th>
                        <th className="px-5 py-3.5 text-center">Faculty Tokens</th>
                        <th className="px-5 py-3.5 text-center">Billed Cost (₹ INR)</th>
                        <th className="px-5 py-3.5 text-center">Billed Cost ($ USD)</th>
                        <th className="px-5 py-3.5 text-center">Active Users</th>
                        <th className="px-5 py-3.5 text-right">Last AI Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                            No tenant usage logs found.
                          </td>
                        </tr>
                      ) : (
                        filteredLeaderboard.map((o) => (
                          <tr key={o.orgId} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-xs border border-purple-500/20">
                                  {o.orgName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground">{o.orgName}</div>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    /{o.slug} • <span className="text-[11px] font-sans">{o.campusType}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <Badge variant="secondary" className="font-mono text-xs font-bold">
                                {o.totalTokens.toLocaleString()}
                              </Badge>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span className="font-mono text-xs text-purple-600 font-semibold">
                                {o.studentTokens.toLocaleString()}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span className="font-mono text-xs text-indigo-600 font-semibold">
                                {o.teacherTokens.toLocaleString()}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center">
                              <span className="font-mono text-xs font-bold text-emerald-600">
                                ₹{o.estimatedCostInr.toLocaleString()}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-center text-xs font-mono text-muted-foreground">
                              ${o.estimatedCostUsd.toFixed(4)}
                            </td>

                            <td className="px-5 py-4 text-center">
                              <div className="text-xs font-medium">
                                {o.activeStudentsCount + o.activeTeachersCount} users
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {o.activeStudentsCount} students / {o.activeTeachersCount} staff
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right text-xs text-muted-foreground">
                              {o.lastActive ? new Date(o.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No queries yet'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Guardrail Safety Audit Feed */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="p-5 sm:p-6 border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    AI Guardrail Safety Telemetry & Crisis Intervention Audit
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Live audit trail of dual-use academic allowances, crisis support cards, and PII sanitization events.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-xs">
                    {tokenData?.guardrailSummary?.crisisCount || 0} Crisis Helps
                  </Badge>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs">
                    {tokenData?.guardrailSummary?.reframedCount || 0} Academic Reframes
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border/40 font-medium">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">User Role</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(!tokenData?.guardrailSummary?.recentEvents || tokenData.guardrailSummary.recentEvents.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground text-xs">
                          All systems active. No safety violation incidents recorded.
                        </td>
                      </tr>
                    ) : (
                      tokenData.guardrailSummary.recentEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-muted/30 transition-colors text-xs">
                          <td className="px-5 py-3 text-muted-foreground font-mono">
                            {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-5 py-3 font-semibold text-foreground">
                            {ev.userRole}
                          </td>
                          <td className="px-5 py-3 font-medium">
                            {ev.category}
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              variant="outline"
                              className={
                                ev.severity === 'CRISIS'
                                  ? 'bg-rose-500/20 text-rose-600 border-rose-500/40 text-[10px]'
                                  : ev.severity === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-600 border-amber-500/40 text-[10px]'
                                  : 'bg-sky-500/20 text-sky-600 border-sky-500/40 text-[10px]'
                              }
                            >
                              {ev.severity}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-semibold text-emerald-600">{ev.actionTaken}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provisioning Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-border/80 shadow-2xl">
          <DialogHeader className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {createdResult ? 'Campus Provisioned Successfully! 🎉' : 'Provision New School Workspace'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {createdResult
                    ? 'Here are the official login credentials for the appointed Director.'
                    : 'Set up an institutional workspace and assign the Institutional Director.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {createdResult ? (
                /* Success View with Copyable Credentials */
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-5"
                >
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                    <div>
                      <strong>Workspace Created:</strong> {createdResult.organization.name} (/{createdResult.organization.slug}). Default school wings and core channels were automatically seeded.
                    </div>
                  </div>

                  {createdResult.organization.hasAiLegal && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3.5 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <Scale className="h-4 w-4 text-purple-600" />
                        AI-Legal Suite Add-on Provisioned
                      </div>
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-600 border-purple-500/40 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>
                  )}

                  {/* Credentials Card */}
                  <div className="bg-muted/50 border border-border rounded-xl p-5 space-y-3.5">
                    <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Director Login Credentials</span>
                      <Badge variant="outline" className="font-mono text-[10px] text-primary">
                        {createdResult.director.directorId}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/60">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">Director Name</span>
                          <span className="font-semibold text-foreground text-sm font-sans">{createdResult.director.fullName}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/60">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">Work Email / Login ID</span>
                          <span className="text-foreground">{createdResult.director.email}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(createdResult.director.email, 'Email')}
                          className="h-7 w-7 p-0"
                        >
                          {copiedField === 'Email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/60">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">Temporary Password</span>
                          <span className="text-emerald-500 font-bold">{createdResult.director.plainPassword}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(createdResult.director.plainPassword, 'Password')}
                          className="h-7 w-7 p-0"
                        >
                          {copiedField === 'Password' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 text-xs gap-2"
                      onClick={() =>
                        copyToClipboard(
                          `Institutional Portal: ${createdResult.organization.name}\nLogin URL: ${window.location.origin}/login\nEmail: ${createdResult.director.email}\nInitial Password: ${createdResult.director.plainPassword}${createdResult.organization.hasAiLegal ? '\nAdd-ons: AI-Legal Enabled' : ''}`,
                          'All Credentials'
                        )
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedField === 'All Credentials' ? 'Copied Full Summary!' : 'Copy Full Credentials Package'}
                    </Button>
                    <Button
                      className="flex-1 text-xs gap-2 bg-primary hover:bg-primary/90"
                      onClick={() => {
                        setIsModalOpen(false);
                        handleShadowEnter(createdResult.organization);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Enter Campus (Shadow Mode)
                    </Button>
                  </div>
                </motion.div>
              ) : (
                /* Form Input View */
                <form key="form" onSubmit={handleProvisionSubmit} className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> 1. Institution Profile
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="orgName" className="text-xs">
                          School / College Name *
                        </Label>
                        <Input
                          id="orgName"
                          placeholder="e.g. St. Xavier International Academy"
                          value={formData.name}
                          onChange={handleNameChange}
                          required
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="campusType" className="text-xs">
                          Campus Type
                        </Label>
                        <select
                          id="campusType"
                          value={formData.campusType}
                          onChange={(e) => setFormData({ ...formData, campusType: e.target.value })}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="K-12 School">K-12 School (CBSE / ICSE / State)</option>
                          <option value="Higher Secondary">Higher Secondary / Jr College (11th-12th)</option>
                          <option value="University / College">University / Degree College / Autonomous</option>
                          <option value="Law School">Law School / Legal Institute</option>
                          <option value="Coaching Institute">Coaching & Competitive Prep Academy</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="orgSlug" className="text-xs">
                          Workspace Domain Slug *
                        </Label>
                        <div className="relative">
                          <Input
                            id="orgSlug"
                            placeholder="st-xavier"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            required
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-purple-600" /> 2. Enterprise Add-ons & Suites
                    </h4>

                    <div
                      onClick={() => setFormData((prev) => ({ ...prev, enableAiLegal: !prev.enableAiLegal }))}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        formData.enableAiLegal
                          ? 'border-purple-500/60 bg-purple-500/10 shadow-sm'
                          : 'border-border/60 bg-muted/20 hover:border-border'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">AI-Legal Suite (Indian Law & Judgments)</span>
                          <Badge variant="outline" className="bg-purple-500/20 text-purple-600 border-purple-500/40 text-[10px]">
                            Recommended for Law Schools
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Provides Supreme Court/High Court case search, legal research briefing, Indian Penal Code / BNS reference tools.
                        </p>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          formData.enableAiLegal
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-muted-foreground/40 bg-background'
                        }`}
                      >
                        {formData.enableAiLegal && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-primary" /> 3. Appointed Institutional Director
                    </h4>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="directorName" className="text-xs">
                          Director Full Name *
                        </Label>
                        <Input
                          id="directorName"
                          placeholder="e.g. Dr. Rajesh Sharma"
                          value={formData.directorName}
                          onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                          required
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="directorEmail" className="text-xs">
                            Work Email (Login ID) *
                          </Label>
                          <Input
                            id="directorEmail"
                            type="email"
                            placeholder="director@stxavier.edu.in"
                            value={formData.directorEmail}
                            onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                            required
                            className="h-9 text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="directorPassword" className="text-xs">
                            Initial Temporary Password *
                          </Label>
                          <Input
                            id="directorPassword"
                            value={formData.directorPassword}
                            onChange={(e) => setFormData({ ...formData, directorPassword: e.target.value })}
                            required
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsModalOpen(false)}
                      disabled={provisioning}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={provisioning}
                      className="gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-primary-foreground shadow-md"
                    >
                      {provisioning ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Provisioning Tenant Workspace...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" />
                          Complete & Provision School
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

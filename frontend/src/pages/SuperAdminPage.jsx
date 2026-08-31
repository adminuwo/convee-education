import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { superAdminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  KeyRound,
  Mail,
  GraduationCap,
  Scale,
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
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
      const res = await superAdminApi.dashboard();
      setData(res);
    } catch (err) {
      toast.error('Failed to load Super Admin dashboard metrics');
    } finally {
      setLoading(false);
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
    const nextAutoReset = currentPaused; // If paused, turn it ON (true)
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

  const filteredOrgs = (data?.organizations || []).filter((org) => {
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.slug?.toLowerCase().includes(q) ||
      org.owner?.fullName?.toLowerCase().includes(q) ||
      org.owner?.email?.toLowerCase().includes(q)
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
      className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto"
    >
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
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
            Institutional workspace provisioning, cross-campus shadow inspection, and platform health telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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

                  {/* Add-on Active Badge (if enabled) */}
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
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="K-12 School">K-12 School (Playschool to Grade 12)</option>
                          <option value="Higher Secondary Institute">Higher Secondary Institute (Grades 11-12)</option>
                          <option value="Degree College / University">Degree College / University</option>
                          <option value="Training & Educational Academy">Training & Educational Academy</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="slug" className="text-xs">
                          Workspace URL Slug
                        </Label>
                        <Input
                          id="slug"
                          placeholder="e.g. st-xavier-academy"
                          value={formData.slug}
                          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                          className="h-9 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 space-y-3">
                    <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> 2. Appointed Director Credentials
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="directorName" className="text-xs">
                          Director Full Name *
                        </Label>
                        <Input
                          id="directorName"
                          placeholder="e.g. Dr. Arthur Vance (Director)"
                          value={formData.directorName}
                          onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                          required
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="directorEmail" className="text-xs">
                          Director Work Email *
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="directorEmail"
                            type="email"
                            placeholder="director@school.edu"
                            value={formData.directorEmail}
                            onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                            required
                            className="h-9 pl-9 text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="directorPassword" className="text-xs">
                          Initial Password
                        </Label>
                        <div className="relative">
                          <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="directorPassword"
                            placeholder="Generated Password"
                            value={formData.directorPassword}
                            onChange={(e) => setFormData({ ...formData, directorPassword: e.target.value })}
                            className="h-9 pl-9 text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Platform Add-ons */}
                  <div className="pt-2 border-t border-border/40 space-y-3">
                    <h4 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-purple-500" /> 3. Add-ons & Platform Extensions
                    </h4>

                    <div
                      onClick={() => setFormData((prev) => ({ ...prev, enableAiLegal: !prev.enableAiLegal }))}
                      className={`cursor-pointer p-3 rounded-lg border transition-all flex items-start gap-3 ${
                        formData.enableAiLegal
                          ? 'bg-purple-500/10 border-purple-500/40'
                          : 'bg-background hover:bg-muted/30 border-border/60'
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          formData.enableAiLegal
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'border-muted-foreground/50'
                        }`}
                      >
                        {formData.enableAiLegal && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 select-none">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">AI-Legal Suite Add-on</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                            Add-on Module
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Enables AI legal research, case precedent lookups, and prepares student onboarding accounts to sync with the AI-Legal database.
                        </p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="pt-4 border-t border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
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
                      className="gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-primary-foreground shadow-sm"
                    >
                      {provisioning ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Provisioning...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-3.5 w-3.5" />
                          Provision Campus & Director
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}



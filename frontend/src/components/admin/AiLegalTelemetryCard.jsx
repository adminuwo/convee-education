import React, { useState, useEffect } from 'react';
import { orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Scale,
  MessageSquare,
  Sparkles,
  Users,
  ShieldCheck,
  RefreshCw,
  Search,
  Activity,
  Award,
  Zap,
  BookOpen,
  FileText,
  Gavel,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AiLegalTelemetryCard({ orgId, orgName, hasAiLegal = true }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTelemetry = async (isManualRefresh = false) => {
    if (!orgId) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await orgApi.getAiLegalTelemetry(orgId);
      setTelemetry(res);
    } catch (err) {
      console.error('Failed to load AI-Legal telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRenewNow = async () => {
    if (!orgId) return;
    try {
      setRenewing(true);
      toast.info(`Renewing AI-Legal academic plans for students of "${orgName || 'this institution'}"...`);
      const res = await orgApi.renewAiLegal(orgId);
      toast.success(res.message || 'Successfully renewed student academic plans!');
      await fetchTelemetry(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to renew student plans');
    } finally {
      setRenewing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!hasAiLegal) {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-purple-500/20 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-72 mb-2" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const overview = telemetry?.overview || {
    totalStudents: 0,
    activeScholars: 0,
    totalInquiries: 0,
    totalChatSessions: 0,
  };

  const featureBreakdown = telemetry?.featureBreakdown || [];
  const students = telemetry?.students || [];

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.studentName || '').toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.studentEmail || '').toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q)
    );
  });

  const getFeatureIcon = (featureName = '') => {
    const lower = featureName.toLowerCase();
    if (lower.includes('precedent')) return <BookOpen className="h-4 w-4 text-indigo-500" />;
    if (lower.includes('draft')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (lower.includes('court') || lower.includes('argument')) return <Gavel className="h-4 w-4 text-purple-500" />;
    if (lower.includes('strategy')) return <Zap className="h-4 w-4 text-amber-500" />;
    if (lower.includes('chat')) return <MessageSquare className="h-4 w-4 text-emerald-500" />;
    return <Sparkles className="h-4 w-4 text-purple-500" />;
  };

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-card via-purple-950/5 to-card shadow-sm overflow-hidden" data-testid="ai-legal-telemetry-card">
      {/* Header Banner */}
      <CardHeader className="pb-4 border-b border-purple-500/10 bg-purple-500/[0.03]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  AI-Legal™ Academic Telemetry
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px] font-mono">
                    INSTITUTIONAL SUITE ACTIVE
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time feature utilization, research inquiries, and campus scholarly engagement for {orgName || 'your institution'}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[11px] font-mono px-2.5 py-1 ${
                telemetry?.autoMonthlyResetActive !== false
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
              }`}
            >
              {telemetry?.autoMonthlyResetActive !== false ? 'Auto-Reset: Active (1st/mo)' : 'Auto-Reset: Paused'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRenewNow}
              disabled={renewing}
              className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
              title="Instantly renew all student academic plans for this campus"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${renewing ? 'animate-spin' : ''}`} />
              {renewing ? 'Renewing...' : 'Renew Plans Now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTelemetry(true)}
              disabled={refreshing}
              className="h-8 text-xs gap-1.5 border-border/80"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-purple-600' : ''}`} />
              {refreshing ? 'Syncing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Privacy-Preserving Notice */}
        <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
          <div>
            <strong>Privacy-Preserving Telemetry:</strong> Zero chat conversation transcripts, student research queries, or document drafts are inspected. Only feature module frequencies and numerical inquiry totals are tracked.
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Inquiries */}
          <div className="bg-card/70 border border-border/80 rounded-xl p-3.5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Legal Inquiries</span>
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold font-display text-foreground">{overview.totalInquiries.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground">Total module executions</p>
          </div>

          {/* Chat Inquiries */}
          <div className="bg-card/70 border border-border/80 rounded-xl p-3.5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Chat Consultations</span>
              <MessageSquare className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {overview.totalChatSessions.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground">Total chat inquiries run</p>
          </div>

          {/* Active Scholars */}
          <div className="bg-card/70 border border-border/80 rounded-xl p-3.5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Active Scholars</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold font-display text-foreground">
              {overview.activeScholars} <span className="text-sm font-normal text-muted-foreground">/ {overview.totalStudents}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Enrolled student scholars</p>
          </div>

          {/* Academic Plan Status */}
          <div className="bg-card/70 border border-border/80 rounded-xl p-3.5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Academic License</span>
              <Award className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold font-display text-purple-600 dark:text-purple-400">
              Full Suite <span className="text-xs font-medium text-muted-foreground">Active</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Uncapped academic tools & research</p>
          </div>
        </div>

        {/* Feature Breakdown Section */}
        <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <Sliders className="h-4 w-4 text-purple-600" />
              Legal Research Module Utilization
            </div>
            <span className="text-[11px] text-muted-foreground">
              {featureBreakdown.length} active module(s)
            </span>
          </div>

          {featureBreakdown.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No module activity recorded yet this academic term. Students will appear here once they run research inquiries.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {featureBreakdown.map((item, index) => (
                <div key={item.feature || index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium">
                      {getFeatureIcon(item.feature)}
                      {item.feature}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {item.count} inquiries ({item.percentage}%)
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-1.5 bg-muted" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Student Scholars Telemetry Table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Enrolled Scholars Telemetry ({filteredStudents.length})
              </h3>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by student or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3.5">Student Scholar</th>
                    <th className="py-2.5 px-3.5">Class / Batch</th>
                    <th className="py-2.5 px-3.5 text-center">Inquiries</th>
                    <th className="py-2.5 px-3.5 text-center">Chat Sessions</th>
                    <th className="py-2.5 px-3.5">Top Utilized Feature</th>
                    <th className="py-2.5 px-3.5">Scholar Status</th>
                    <th className="py-2.5 px-3.5 text-right">Academic Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-sans">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                        {students.length === 0
                          ? 'No students enrolled with AI-Legal integration yet. Generate an enrollment link from the Student ID Generator tab to onboard students.'
                          : 'No students match your search criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => {
                      const isActive = s.totalInquiries > 0 || s.totalChats > 0;

                      return (
                        <tr key={s.studentEmail || s.studentId || idx} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-foreground">{s.studentName}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{s.studentId}</div>
                          </td>
                          <td className="py-3 px-3.5 text-muted-foreground">
                            {s.className || 'General Batch'}
                          </td>
                          <td className="py-3 px-3.5 text-center font-bold">
                            {s.totalInquiries > 0 ? (
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {s.totalInquiries}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground font-mono">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {s.totalChats > 0 ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-mono text-[10px]">
                                {s.totalChats} chats
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground font-mono">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
                              {getFeatureIcon(s.topFeature)}
                              {s.topFeature}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            {isActive ? (
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] gap-1 font-medium">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Active Scholar
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-muted-foreground font-medium">
                                Enrolled
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <Badge variant="outline" className="bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 text-[10px] gap-1 font-mono">
                              Full Academic Suite
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

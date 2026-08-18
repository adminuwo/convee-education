import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/contexts/OrgDataContext';
import { financeApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndianRupee, CheckCircle2, Clock, AlertTriangle, Building2, Search, Filter, GraduationCap, ShieldCheck, Download, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function StudentFeeStatusPage() {
  const { user, currentOrg } = useAuth();
  const { departments, members, loading: orgLoading } = useOrgData();

  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const userRole = currentOrg?.role || 'TEACHER';
  const isFullAccess = ['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN'].includes(userRole);
  const isDeptRole = ['DEAN', 'HOD'].includes(userRole);

  // User's assigned department ID if HOD/DEAN
  const userDeptId = currentOrg?.departmentId || user?.departmentId;

  useEffect(() => {
    async function loadFeeData() {
      setLoading(true);
      try {
        const res = await financeApi.getFees();
        setFees(res.fees || []);
      } catch (err) {
        console.error('Error loading fee statuses:', err);
        toast.error('Failed to load student fee statuses');
      } finally {
        setLoading(false);
      }
    }
    loadFeeData();
  }, []);

  // Filtered departments based on user role
  const availableDepartments = useMemo(() => {
    if (isFullAccess) return departments;
    if (isDeptRole && userDeptId) {
      return departments.filter((d) => d.id === userDeptId);
    }
    return departments;
  }, [departments, isFullAccess, isDeptRole, userDeptId]);

  // Combine student fee records with membership department and team info
  const enrichedFeeRecords = useMemo(() => {
    const studentMembersMap = new Map();
    (members || []).forEach((m) => {
      if (m.user) {
        if (m.user.fullName) studentMembersMap.set(m.user.fullName.toLowerCase(), m);
        if (m.user.email) studentMembersMap.set(m.user.email.toLowerCase(), m);
      }
      if (m.title) studentMembersMap.set(m.title.toLowerCase(), m);
    });

    return fees.map((f) => {
      const match = studentMembersMap.get((f.studentName || '').toLowerCase()) ||
                    studentMembersMap.get((f.studentRollNo || '').toLowerCase());
      
      const deptName = match?.department?.name || match?.departmentName || 'General Wing';
      const className = match?.team?.name || match?.teamName || f.className || 'Grade 10 Sec A';
      const deptId = match?.departmentId || match?.department?.id;
      const teamId = match?.teamId || match?.team?.id;

      return {
        ...f,
        departmentName: deptName,
        className: className,
        departmentId: deptId,
        teamId: teamId,
      };
    });
  }, [fees, members]);

  // Role-scoped records
  const roleScopedRecords = useMemo(() => {
    if (isFullAccess) return enrichedFeeRecords;
    if (isDeptRole && userDeptId) {
      return enrichedFeeRecords.filter((r) => !r.departmentId || r.departmentId === userDeptId);
    }
    return enrichedFeeRecords;
  }, [enrichedFeeRecords, isFullAccess, isDeptRole, userDeptId]);

  // Filtered records by user selection
  const filteredRecords = useMemo(() => {
    return roleScopedRecords.filter((r) => {
      // Dept filter
      if (selectedDeptId !== 'ALL' && r.departmentId && r.departmentId !== selectedDeptId) {
        return false;
      }
      // Class filter
      if (selectedClassId !== 'ALL' && r.className !== selectedClassId) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.studentName?.toLowerCase().includes(q);
        const matchesRoll = r.studentRollNo?.toLowerCase().includes(q);
        const matchesHeader = r.feeHeader?.toLowerCase().includes(q);
        const matchesClass = r.className?.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesHeader && !matchesClass) return false;
      }
      return true;
    });
  }, [roleScopedRecords, selectedDeptId, selectedClassId, statusFilter, searchQuery]);

  // Classes list for dropdown
  const availableClasses = useMemo(() => {
    const classSet = new Set();
    roleScopedRecords.forEach((r) => {
      if (r.className) classSet.add(r.className);
    });
    return Array.from(classSet);
  }, [roleScopedRecords]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const paid = filteredRecords.filter((r) => r.status === 'PAID').length;
    const partial = filteredRecords.filter((r) => r.status === 'PARTIAL').length;
    const unpaid = filteredRecords.filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE').length;

    const totalCollected = filteredRecords.reduce((acc, r) => acc + (r.paidAmount || 0), 0);
    const totalPending = filteredRecords.reduce((acc, r) => acc + (r.pendingBalance || 0), 0);
    const partialPending = filteredRecords.filter((r) => r.status === 'PARTIAL').reduce((acc, r) => acc + (r.pendingBalance || 0), 0);
    const unpaidPending = filteredRecords.filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE').reduce((acc, r) => acc + (r.pendingBalance || 0), 0);

    return { total, paid, partial, unpaid, totalCollected, totalPending, partialPending, unpaidPending };
  }, [filteredRecords]);

  if (loading || orgLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading class-wise student fee statuses...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
              Student Fee Status Tracking
            </h1>
            <p className="text-xs text-muted-foreground">
              {isDeptRole
                ? `Department Scope (${userRole}): Class-wise student fee collection & pending dues tracking.`
                : `Institutional View (${userRole}): All departments, school wings, and class fee status tracking.`}
            </p>
          </div>
        </div>

        <Badge variant="outline" className={`self-start sm:self-auto font-bold px-3 py-1 text-xs ${
          isDeptRole ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
        }`}>
          {isDeptRole ? `🔒 Assigned Dept: ${userRole}` : `🌐 All Departments Access (${userRole})`}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Students</div>
              <div className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">{stats.total}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Tracked in view</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Paid In Full</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1 tabular-nums">{stats.paid}</div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> ₹{stats.totalCollected.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Partial Dues</div>
              <div className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums">{stats.partial}</div>
              <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                ₹{stats.partialPending.toLocaleString('en-IN')} Remaining
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Outstanding</div>
              <div className="text-2xl font-extrabold text-rose-400 mt-1 tabular-nums">
                ₹{stats.totalPending.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-rose-400/90 font-semibold mt-0.5">
                {stats.partial + stats.unpaid} students ({stats.partial} partial{stats.unpaid > 0 ? `, ${stats.unpaid} unpaid` : ''})
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls & Filter Bar */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Department Filter (Full Access roles only) */}
            {isFullAccess && (
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger className="h-9 w-44 text-xs">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Class Filter */}
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Payment Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PAID">🟢 Paid</SelectItem>
                <SelectItem value="PARTIAL">🟡 Partial Dues</SelectItem>
                <SelectItem value="OVERDUE">🔴 Pending / Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Student Fee Table */}
      <Card className="border-border overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-500" />
            Class-Wise Student Fee Ledger ({filteredRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Student Info</th>
                  <th className="px-4 py-3 text-left">Wing & Class</th>
                  <th className="px-4 py-3 text-left">Fee Header</th>
                  <th className="px-4 py-3 text-right">Total Fee (₹)</th>
                  <th className="px-4 py-3 text-right">Paid (₹)</th>
                  <th className="px-4 py-3 text-right">Balance Due (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    {/* Student Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 border border-primary/20">
                          <AvatarFallback className="text-[10px] bg-amber-500/10 text-amber-500 font-bold">
                            {initials(r.studentName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-foreground">{r.studentName}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{r.studentRollNo}</div>
                        </div>
                      </div>
                    </td>

                    {/* Wing & Class */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{r.className}</div>
                      <div className="text-[10px] text-muted-foreground">{r.departmentName}</div>
                    </td>

                    {/* Fee Header */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{r.feeHeader}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">Rec: {r.receiptNo || '-'}</div>
                    </td>

                    {/* Total Fee */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                      ₹{r.totalAmount?.toLocaleString('en-IN')}
                    </td>

                    {/* Paid Amount */}
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                      ₹{r.paidAmount?.toLocaleString('en-IN')}
                    </td>

                    {/* Pending Balance */}
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-400">
                      ₹{r.pendingBalance?.toLocaleString('en-IN')}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] uppercase font-bold tracking-wide ${
                          r.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : r.status === 'PARTIAL'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {r.status === 'PAID' ? '🟢 PAID' : r.status === 'PARTIAL' ? '🟡 PARTIAL' : '🔴 UNPAID'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No student fee records match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

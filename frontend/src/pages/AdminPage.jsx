import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/contexts/OrgDataContext';
import { orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Users, Layers, Plus, Mail, Trash2, Crown, ChevronRight, GraduationCap, UserCheck, Filter, Key, HeartHandshake, Pencil, Clock, Copy, CheckCircle2, UserX, BookOpen } from 'lucide-react';
import { connectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import StudentIDGenerator from '@/components/admin/StudentIDGenerator';
import OrgRenameModal from '@/components/org/OrgRenameModal';
import AcademicPromotionModal from '@/components/admin/AcademicPromotionModal';

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

function renderEmailCell(u) {
  const email = u?.email;
  if (!email || !email.includes('@') || email.startsWith('STU-') || email.startsWith('PAR-') || email.startsWith('stu-') || email.startsWith('par-') || email.endsWith('.convee.local')) {
    return <span className="text-muted-foreground/40 italic text-xs">No email set</span>;
  }
  return email;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'members';

  const { currentOrg, user, refresh, memberships } = useAuth();
  const {
    members, setMembers,
    departments, setDepartments,
    projects, setProjects,
    loading: orgLoading,
    refreshOrgData,
  } = useOrgData();

  const isFullAdmin = ['DIRECTOR', 'OWNER', 'PRINCIPAL', 'ADMIN'].includes(currentOrg?.role);
  const [invite, setInvite] = useState({ open: false, email: '', fullName: '', role: 'TEACHER' });
  const [newDept, setNewDept] = useState({ open: false, name: '' });
  const [newTeam, setNewTeam] = useState({ open: false, gradeName: '', sectionName: '', deptId: '' });
  const [newProject, setNewProject] = useState({ open: false, name: '', description: '', teamIds: [] });
  const [removeDialog, setRemoveDialog] = useState({ open: false, member: null });
  const [transferDialog, setTransferDialog] = useState({ open: false, member: null });
  const [deleteDeptDialog, setDeleteDeptDialog] = useState({ open: false, dept: null });
  const [deleteTeamDialog, setDeleteTeamDialog] = useState({ open: false, team: null });
  const [transferFlow, setTransferFlow] = useState({ open: false, step: 1, targetEmail: '', verifyEmail: '', targetMember: null, loading: false });

  // Sub-tabs for Members section: 'faculty' | 'students' | 'parents'
  const [memberSubTab, setMemberSubTab] = useState('faculty');
  const [studentWingFilter, setStudentWingFilter] = useState('ALL');
  const [studentClassFilter, setStudentClassFilter] = useState('ALL');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);

  const facultyMembers = useMemo(() => {
    return members.filter(
      (m) => m.role !== 'STUDENT' && m.role !== 'ALUMNI' && m.role !== 'PARENT' && !m.user?.email?.includes('parent') && !m.title?.toLowerCase().includes('parent')
    );
  }, [members]);

  const parentMembers = useMemo(() => {
    return members.filter(
      (m) => m.role === 'PARENT' || m.user?.email?.includes('parent') || m.title?.toLowerCase().includes('parent')
    );
  }, [members]);

  const alumniMembers = useMemo(() => {
    return members.filter(
      (m) => m.role === 'ALUMNI' || m.title?.includes('Alumni')
    );
  }, [members]);

  const unassignedMembers = useMemo(() => {
    return members.filter(
      (m) => m.role === 'STUDENT' && (!m.teamId && !m.team?.id) && m.role !== 'ALUMNI' && !m.title?.includes('Alumni')
    );
  }, [members]);

  const adminMembers = useMemo(() => {
    return members.filter(
      (m) => ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(m.role) && m.userId !== user?.id
    );
  }, [members, user?.id]);

  const studentMembers = useMemo(() => {
    return members.filter((m) => {
      if (m.role !== 'STUDENT' || m.role === 'ALUMNI' || m.title?.includes('Alumni')) return false;
      if (studentWingFilter !== 'ALL' && m.departmentId !== studentWingFilter && m.department?.id !== studentWingFilter) {
        return false;
      }
      if (studentClassFilter !== 'ALL' && m.teamId !== studentClassFilter && m.team?.id !== studentClassFilter) {
        return false;
      }
      return true;
    });
  }, [members, studentWingFilter, studentClassFilter]);

  const availableClassesForFilter = useMemo(() => {
    if (studentWingFilter === 'ALL') {
      return departments.flatMap((d) => d.teams || []);
    }
    const targetDept = departments.find((d) => d.id === studentWingFilter);
    return targetDept?.teams || [];
  }, [departments, studentWingFilter]);

  const load = useCallback(() => {
    refreshOrgData();
  }, [refreshOrgData]);

  const submitInvite = async () => {
    try {
      const res = await orgApi.invite(currentOrg.id, invite);
      toast.success(`Member invited successfully! Login ID (${res.generatedId}) and password sent to ${invite.email}`);
      setInvite({ open: false, email: '', fullName: '', role: 'TEACHER' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create member');
    }
  };
  const submitDept = async () => { try { await orgApi.createDept(currentOrg.id, { name: newDept.name }); toast.success('Department created'); setNewDept({ open: false, name: '' }); load(); } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); } };
  const submitTeam = async () => {
    try {
      const combinedName = newTeam.sectionName?.trim()
        ? `${newTeam.gradeName.trim()} - ${newTeam.sectionName.trim()}`
        : newTeam.gradeName.trim();
      await orgApi.createTeam(currentOrg.id, newTeam.deptId, { name: combinedName });
      toast.success('Class & Section created');
      setNewTeam({ open: false, gradeName: '', sectionName: '', deptId: '' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed');
    }
  };

  const confirmDeleteDept = async () => {
    if (!deleteDeptDialog.dept) return;
    try {
      await orgApi.deleteDept(currentOrg.id, deleteDeptDialog.dept.id);
      toast.success('School Wing deleted');
      setDeleteDeptDialog({ open: false, dept: null });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete School Wing');
    }
  };

  const confirmDeleteTeam = async () => {
    if (!deleteTeamDialog.team) return;
    try {
      await orgApi.deleteTeam(currentOrg.id, deleteTeamDialog.team.id);
      toast.success('Class & Section deleted');
      setDeleteTeamDialog({ open: false, team: null });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete Class & Section');
    }
  };
  const submitProject = async () => {
    try {
      const primaryTeamId = newProject.teamIds[0] || '';
      await orgApi.createProject(currentOrg.id, {
        name: newProject.name,
        description: newProject.description,
        teamId: primaryTeamId,
        teamIds: newProject.teamIds,
      });
      toast.success('Project created');
      setNewProject({ open: false, name: '', description: '', teamIds: [] });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to create project');
    }
  };

  const toggleTeamSelection = (tId) => {
    setNewProject((prev) => {
      const exists = prev.teamIds.includes(tId);
      return {
        ...prev,
        teamIds: exists ? prev.teamIds.filter((id) => id !== tId) : [...prev.teamIds, tId],
      };
    });
  };

  const handleRoleChange = async (membershipId, newRole) => {
    const targetMember = members.find((m) => m.id === membershipId);
    setMembers((prev) => prev.map((m) => (m.id === membershipId ? { ...m, role: newRole } : m)));
    try {
      await orgApi.updateMemberRole(currentOrg.id, membershipId, newRole);
      toast.success('Role updated');
      if (targetMember?.userId === user?.id && typeof refresh === 'function') {
        await refresh();
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to update role');
      load();
    }
  };

  const confirmRemoveMember = async () => {
    if (!removeDialog.member) return;
    try {
      await orgApi.removeMember(currentOrg.id, removeDialog.member.id);
      toast.success('Member removed');
      setRemoveDialog({ open: false, member: null });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleTransferStep1 = () => {
    const trimmedTarget = transferFlow.targetEmail?.trim().toLowerCase();
    if (!trimmedTarget) {
      toast.error('Please enter the target Admin email.');
      return;
    }
    const targetMem = members.find((m) => m.user?.email?.toLowerCase() === trimmedTarget);
    if (!targetMem) {
      toast.error(`No active member found with email "${trimmedTarget}" in this workspace.`);
      return;
    }
    if (!['ADMIN', 'PRINCIPAL', 'DEAN'].includes(targetMem.role)) {
      toast.error(`User "${trimmedTarget}" has role "${targetMem.role}". Ownership can only be transferred to an ADMIN member.`);
      return;
    }
    setTransferFlow((prev) => ({ ...prev, step: 2, targetMember: targetMem }));
  };

  const handleTransferStep2 = async () => {
    const trimmedVerify = transferFlow.verifyEmail?.trim().toLowerCase();
    if (!trimmedVerify) {
      toast.error('Please re-type your email address for verification.');
      return;
    }
    if (trimmedVerify !== user?.email?.toLowerCase()) {
      toast.error('Email verification failed. Re-typed email does not match your logged-in account.');
      return;
    }
    setTransferFlow((prev) => ({ ...prev, loading: true }));
    try {
      await orgApi.transferRequest(currentOrg.id, {
        targetEmail: transferFlow.targetEmail,
        verifyEmail: transferFlow.verifyEmail,
      });
      toast.success(`Ownership transfer request sent to ${transferFlow.targetEmail}`);
      setTransferFlow({ open: false, step: 1, targetEmail: '', verifyEmail: '', targetMember: null, loading: false });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to send transfer request');
      setTransferFlow((prev) => ({ ...prev, loading: false }));
    }
  };

  const ROLE_RANKS = {
    OWNER: 6,
    DIRECTOR: 6,
    PRINCIPAL: 5,
    DEAN: 4,
    HOD: 4,
    TEACHER: 2,
    STUDENT: 1,
  };

  const currentUserRole = currentOrg?.role || 'TEACHER';
  const currentRank = ROLE_RANKS[currentUserRole] ?? 0;

  const assignableRoles = ['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN'].filter(
    (r) => (ROLE_RANKS[r] ?? 0) < currentRank || (currentUserRole === 'DIRECTOR' && r !== 'DIRECTOR')
  );

  const canEditRole = (m) => {
    if (m.userId === user?.id) return false;
    if (m.role === 'DIRECTOR' || m.role === 'STUDENT' || m.userId === currentOrg?.ownerId) return false;
    const targetRank = ROLE_RANKS[m.role] ?? 0;
    if (targetRank >= currentRank && currentUserRole !== 'DIRECTOR') return false;
    return assignableRoles.length > 0;
  };

  const canRemoveMember = (m) => {
    if (m.userId === user?.id) return false;
    if (m.role === 'DIRECTOR' || m.userId === currentOrg?.ownerId) return false;
    const targetRank = ROLE_RANKS[m.role] ?? 0;
    return targetRank < currentRank || currentUserRole === 'DIRECTOR';
  };

  const isCurrentUserOwner = currentOrg?.role === 'DIRECTOR' || user?.id === currentOrg?.ownerId;
  const allTeams = departments.flatMap((d) => (d.teams || []).map((t) => ({ ...t, deptName: d.name })));

  if (orgLoading && members.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading administration workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-4" data-testid="admin-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            Admin
            {isCurrentUserOwner && (
              <Button variant="outline" size="sm" onClick={() => setRenameModalOpen(true)} className="h-8 gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Rename Institution
              </Button>
            )}
          </h1>
          <p className="text-muted-foreground">Manage members, departments, teams, and projects for {currentOrg?.name}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="members"><Users className="h-3.5 w-3.5 mr-1" /> Members</TabsTrigger>
          <TabsTrigger value="structure"><Layers className="h-3.5 w-3.5 mr-1" /> Structure</TabsTrigger>
          <TabsTrigger value="projects"><Building2 className="h-3.5 w-3.5 mr-1" /> Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 space-y-0 pb-4 border-b border-border">
              {/* Directory Sub-Tabs */}
              <div className="inline-flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-inner overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setMemberSubTab('faculty')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                    memberSubTab === 'faculty'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Faculty & Staff</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${memberSubTab === 'faculty' ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400'}`}>
                    {facultyMembers.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberSubTab('students')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                    memberSubTab === 'students'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Enrolled Students</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${memberSubTab === 'students' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                    {members.filter((m) => m.role === 'STUDENT' && m.role !== 'ALUMNI' && !m.title?.includes('Alumni')).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberSubTab('unassigned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                    memberSubTab === 'unassigned'
                      ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <UserX className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>Unassigned</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${memberSubTab === 'unassigned' ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-800 text-slate-400'}`}>
                    {unassignedMembers.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberSubTab('alumni')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                    memberSubTab === 'alumni'
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Alumni</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${memberSubTab === 'alumni' ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'}`}>
                    {alumniMembers.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberSubTab('parents')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                    memberSubTab === 'parents'
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <HeartHandshake className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  <span>Parents</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${memberSubTab === 'parents' ? 'bg-purple-500/30 text-purple-200' : 'bg-slate-800 text-slate-400'}`}>
                    {parentMembers.length}
                  </span>
                </button>
              </div>

              {/* Action Buttons Group */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {isFullAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 font-semibold shadow-sm h-8 px-3 text-xs"
                      onClick={() => setPromotionModalOpen(true)}
                    >
                      <GraduationCap className="h-3.5 w-3.5 mr-1.5 text-indigo-400" /> Academic Promotion
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 font-semibold shadow-sm h-8 px-3 text-xs"
                      onClick={() => navigate('/app/student-id-generator')}
                    >
                      <Key className="h-3.5 w-3.5 mr-1.5 text-amber-400" /> ID Generator
                    </Button>
                  </>
                )}
                {isCurrentUserOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-semibold h-8 px-3 text-xs"
                    onClick={() => setTransferFlow({ open: true, step: 1, targetEmail: '', verifyEmail: '', targetMember: null, loading: false })}
                    data-testid="transfer-ownership-header-btn"
                  >
                    <Crown className="h-3.5 w-3.5 mr-1.5" /> Transfer Owner
                  </Button>
                )}
                <Button size="sm" className="h-8 px-3.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm" onClick={() => setInvite({ ...invite, open: true })} data-testid="invite-member-btn">
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Invite Member
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {memberSubTab === 'faculty' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/20">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Faculty Name</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">Role / Position</th>
                        <th className="px-4 py-2.5 font-medium">Joined</th>
                        <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facultyMembers.map((m) => {
                        const canEdit = canEditRole(m);
                        const canRemove = canRemoveMember(m);
                        return (
                          <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={m.user?.avatarUrl} />
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                    {initials(m.user?.fullName || m.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{m.user?.fullName || m.user?.email || 'Unnamed'}</span>
                                  {(m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]) && (
                                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 font-bold bg-primary/10 text-primary border-primary/20">
                                      {m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{m.user?.email}</td>
                            <td className="px-4 py-2.5">
                              {m.role === 'DIRECTOR' ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] uppercase font-bold tracking-wide bg-amber-500/10 text-amber-500 border border-amber-500/30 font-extrabold"
                                >
                                  DIRECTOR
                                </Badge>
                              ) : (m.role === 'ACCOUNTANT' || m.user?.systemRole === 'ACCOUNTANT') ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] uppercase font-bold tracking-wide bg-teal-500/10 text-teal-400 border border-teal-500/30 font-extrabold"
                                >
                                  ACCOUNTANT
                                </Badge>
                              ) : canEdit ? (
                                <Select value={m.role} onValueChange={(r) => handleRoleChange(m.id, r)}>
                                  <SelectTrigger className="h-7 w-32 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(new Set([m.role, ...assignableRoles])).map((r) => (
                                      <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] uppercase font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 font-extrabold"
                                >
                                  {m.role}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(m.joinedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-right space-x-1">
                              {canRemove && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveDialog({ open: true, member: m })}
                                  title="Remove member"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {facultyMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                            No faculty or staff members in this department yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : memberSubTab === 'unassigned' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/20">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Student Name</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">Assign Class Section</th>
                        <th className="px-4 py-2.5 font-medium">Joined</th>
                        <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedMembers.map((m) => {
                        const canRemove = canRemoveMember(m);
                        return (
                          <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={m.user?.avatarUrl} />
                                  <AvatarFallback className="text-[10px] bg-amber-500/10 text-amber-500 font-bold">
                                    {initials(m.user?.fullName || m.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{m.user?.fullName || m.user?.email || 'Unassigned Student'}</span>
                                  {(m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]) && (
                                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 font-bold bg-amber-500/10 text-amber-400 border-amber-500/20">
                                      {m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{renderEmailCell(m.user)}</td>
                            <td className="px-4 py-2.5">
                              <select
                                defaultValue=""
                                onChange={async (e) => {
                                  const targetTeamId = e.target.value;
                                  const targetTeam = allTeams.find((t) => t.id === targetTeamId);
                                  if (!targetTeam) return;
                                  try {
                                    await orgApi.updateMemberRole(currentOrg.id, m.id, m.role, {
                                      departmentId: targetTeam.departmentId,
                                      teamId: targetTeam.id,
                                    });
                                    toast.success(`Student assigned to ${targetTeam.name}`);
                                    load();
                                  } catch (e) {
                                    toast.error('Failed to assign class section');
                                  }
                                }}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                              >
                                <option value="" disabled>Assign to Section...</option>
                                {allTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.deptName ? `${t.deptName} - ${t.name}` : t.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(m.joinedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-right space-x-1">
                              {canRemove && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveDialog({ open: true, member: m })}
                                  title="Remove student"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {unassignedMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                            No unassigned students in this workspace. All students belong to a class section!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : memberSubTab === 'alumni' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/20">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Alumni Graduate</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">Alumni Designation</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Graduated</th>
                        <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumniMembers.map((m) => {
                        const canRemove = canRemoveMember(m);
                        const batchTag = m.title?.match(/\[(.*?)\]/)?.[1] || m.title || 'Alumni Network';
                        return (
                          <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-7 w-7 border border-amber-500/30">
                                  <AvatarImage src={m.user?.avatarUrl} />
                                  <AvatarFallback className="text-[10px] bg-amber-500/15 text-amber-400 font-bold">
                                    {initials(m.user?.fullName || m.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-foreground">{m.user?.fullName || m.user?.email || 'Alumni Member'}</span>
                                  <Badge variant="outline" className="font-semibold text-[10px] px-2 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30">
                                    🎓 {batchTag}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{renderEmailCell(m.user)}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-medium text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {m.title || 'Graduated Alumni'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="secondary" className="text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                Graduated
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(m.joinedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-right space-x-1">
                              {canRemove && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveDialog({ open: true, member: m })}
                                  title="Remove alumni"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {alumniMembers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                            No graduated alumni members yet in this institution.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : memberSubTab === 'parents' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/20">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Parent / Guardian Name</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">Role Tag</th>
                        <th className="px-4 py-2.5 font-medium">Joined</th>
                        <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parentMembers.map((m) => {
                        const canRemove = canRemoveMember(m);
                        return (
                          <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={m.user?.avatarUrl} />
                                  <AvatarFallback className="text-[10px] bg-purple-500/10 text-purple-500 font-bold">
                                    {initials(m.user?.fullName || m.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{m.user?.fullName || m.user?.email || 'Parent / Guardian'}</span>
                                  {(m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]) && (
                                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 font-bold bg-purple-500/10 text-purple-400 border-purple-500/20">
                                      {m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{renderEmailCell(m.user)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wide bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                PARENT
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(m.joinedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-right space-x-1">
                              {canRemove && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveDialog({ open: true, member: m })}
                                  title="Remove parent"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {parentMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                            No parent/guardian accounts registered in this workspace yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-muted/20 p-2.5 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs font-medium text-muted-foreground">School Wing:</Label>
                      <Select
                        value={studentWingFilter}
                        onValueChange={(val) => {
                          setStudentWingFilter(val);
                          setStudentClassFilter('ALL');
                        }}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs font-medium">
                          <SelectValue placeholder="All School Wings" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All School Wings ({departments.length})</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">Class & Section:</Label>
                      <Select value={studentClassFilter} onValueChange={(val) => setStudentClassFilter(val)}>
                        <SelectTrigger className="h-8 w-52 text-xs font-medium">
                          <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Classes & Sections ({availableClassesForFilter.length})</SelectItem>
                          {availableClassesForFilter.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="ml-auto text-xs text-muted-foreground">
                      Showing <strong>{studentMembers.length}</strong> student(s)
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/20">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Student Name</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">School Wing</th>
                        <th className="px-4 py-2.5 font-medium">Class & Section</th>
                        <th className="px-4 py-2.5 font-medium">Role</th>
                        <th className="px-4 py-2.5 font-medium">Joined</th>
                        <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentMembers.map((m) => {
                        const wingName = m.department?.name || 'Unassigned Wing';
                        const className = m.team?.name ? m.team.name.replace(/^team-/, '').replace(/-/g, ' ').toUpperCase() : 'Unassigned Class';
                        return (
                          <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={m.user?.avatarUrl} />
                                  <AvatarFallback className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold">
                                    {initials(m.user?.fullName || m.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{m.user?.fullName || m.user?.email || 'Unnamed Student'}</span>
                                  {(m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]) && (
                                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                      {m.title?.match(/\[(.*?)\]/)?.[1] || m.title?.match(/([A-Z]{3}-\d{4}-\d{3,4})/i)?.[1]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{renderEmailCell(m.user)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className="text-[11px] font-medium bg-blue-500/10 text-blue-500 border-blue-500/20">
                                {wingName}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground/80">{className}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wide bg-emerald-500/10 text-emerald-500">
                                {m.role}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(m.joinedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-right space-x-1">
                              {canRemoveMember(m) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveDialog({ open: true, member: m })}
                                  title="Remove student"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {studentMembers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                            No students found matching the selected filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">School Wings & Classes with Sections</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">Manage school divisions (Wings) and assigned class sections.</CardDescription>
              </div>
              <div className="flex gap-2">
                {isFullAdmin && (
                  <Button size="sm" onClick={() => setNewDept({ ...newDept, open: true })}><Plus className="h-4 w-4 mr-1" /> School Wing</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setNewTeam({ ...newTeam, open: true })}><Plus className="h-4 w-4 mr-1" /> Class & Section</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {departments.map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-semibold text-sm flex flex-wrap items-center gap-2">
                        <span>{d.name}</span>
                        <Badge variant="secondary" className="text-[10px] uppercase">WING</Badge>
                        {d.headUser ? (
                          <Badge variant="outline" className="text-[10px] font-medium bg-amber-500/10 text-amber-500 border-amber-500/30 flex items-center gap-1">
                            <Crown className="h-3 w-3" /> HOD: {d.headUser.fullName || d.headUser.email}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                            No HOD Assigned
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={d.headId || 'unassigned'}
                          onValueChange={async (newHeadId) => {
                            try {
                              await orgApi.updateDept(currentOrg.id, d.id, { headId: newHeadId });
                              toast.success('Department HOD assigned');
                              load();
                            } catch (e) {
                              toast.error(e?.response?.data?.error || 'Failed to update HOD');
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-44 text-xs">
                            <SelectValue placeholder="Assign HOD" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">No HOD Assigned</SelectItem>
                            {facultyMembers
                              .filter((fm) => ['HOD', 'DEAN'].includes(fm.role))
                              .map((fm) => (
                                <SelectItem key={fm.user?.id || fm.userId} value={fm.user?.id || fm.userId}>
                                  {fm.user?.fullName || fm.user?.email} ({fm.role})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">{d._count?.memberships || 0} members · {d._count?.teams || 0} classes</span>
                        {isCurrentUserOwner && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); setDeleteDeptDialog({ open: true, dept: d }); }}
                            title="Delete School Wing"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {d.teams.length > 0 && (
                      <div className="mt-2 pl-3 border-l border-border space-y-1">
                        {d.teams.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => navigate(`/app/teams/${t.id}`)}
                            className="group flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-muted/50 transition-all cursor-pointer"
                          >
                            <div className="text-sm font-medium group-hover:text-primary transition-colors flex items-center gap-1.5">
                              <span>{t.name}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{t._count.memberships} members · {t._count.projects} projects</span>
                              <span className="text-primary font-medium text-[11px] group-hover:underline">Manage class &rarr;</span>
                              {isCurrentUserOwner && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTeamDialog({ open: true, team: t }); }}
                                  title="Delete Class Section"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {departments.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No school wings yet</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Projects</CardTitle><Button size="sm" onClick={() => setNewProject({ ...newProject, open: true })}><Plus className="h-4 w-4 mr-1" /> New project</Button></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.map((p) => {
                  const teamNames = p.teams?.length > 0
                    ? p.teams.map((pt) => `${pt.team?.department?.name || 'General'} / ${pt.team?.name}`).join(', ')
                    : (p.team ? `${p.team?.department?.name || 'General'} / ${p.team?.name}` : 'Unassigned');
                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/app/projects/${p.id}`)}
                      className="group rounded-md border border-border p-4 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-base group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {p.name}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{teamNames}</div>
                        {p.description && <div className="text-sm mt-2 text-muted-foreground line-clamp-2">{p.description}</div>}
                      </div>
                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p._count?.tasks || 0} tasks</span>
                        <span className="text-primary font-medium text-[11px] group-hover:underline">View workforce & details &rarr;</span>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && <div className="col-span-full text-sm text-muted-foreground text-center py-6">No projects yet</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={invite.open} onOpenChange={(o) => setInvite({ ...invite, open: o })}>
        <DialogContent><DialogHeader><DialogTitle>Invite member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="person@company.com" /></div>
            <div><Label>Full name</Label><Input value={invite.fullName} onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} placeholder="Jane Doe" /></div>
            <div>
              <Label>Role</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN', 'ACCOUNTANT'].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInvite({ ...invite, open: false })}>Cancel</Button><Button onClick={submitInvite} disabled={!invite.email}>Invite</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New School Wing Dialog */}
      <Dialog open={newDept.open} onOpenChange={(o) => setNewDept({ ...newDept, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add School Wing / Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Quick Select Preset</Label>
              <div className="flex flex-wrap gap-1.5">
                {['Playschool', 'Kindergarten', 'Primary School', 'Middle School', 'High School', 'Higher Secondary'].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => setNewDept({ ...newDept, name: preset })}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Wing / Department Name</Label>
              <Input value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} placeholder="e.g. Primary School, High School" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDept({ ...newDept, open: false })}>Cancel</Button>
            <Button onClick={submitDept} disabled={!newDept.name}>Create Wing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Class & Section Dialog */}
      <Dialog open={newTeam.open} onOpenChange={(o) => setNewTeam({ ...newTeam, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Class & Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>School Wing / Department</Label>
              <Select value={newTeam.deptId} onValueChange={(v) => setNewTeam({ ...newTeam, deptId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose school wing" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Class / Grade</Label>
                <Input
                  value={newTeam.gradeName || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, gradeName: e.target.value })}
                  placeholder="e.g. Grade 10, Grade 11"
                />
              </div>
              <div>
                <Label>Section / Stream</Label>
                <Input
                  value={newTeam.sectionName || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, sectionName: e.target.value })}
                  placeholder="e.g. Sec A, Science A"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTeam({ ...newTeam, open: false })}>Cancel</Button>
            <Button onClick={submitTeam} disabled={!newTeam.gradeName || !newTeam.deptId}>Create Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Project */}
      <Dialog open={newProject.open} onOpenChange={(o) => setNewProject({ ...newProject, open: o })}>
        <DialogContent><DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Assigned Teams (Select one or multiple)</Label>
              <div className="mt-1.5 flex flex-wrap gap-2 max-h-44 overflow-y-auto p-2 border border-border rounded-md bg-muted/20">
                {allTeams.map((t) => {
                  const isSelected = newProject.teamIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeamSelection(t.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border ${isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                    >
                      <span>{t.deptName} &rarr; {t.name}</span>
                      {isSelected && <span className="font-bold">&times;</span>}
                    </button>
                  );
                })}
                {allTeams.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center w-full">No teams available. Create a department & team first.</div>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {newProject.teamIds.length} team(s) selected
              </div>
            </div>
            <div><Label>Project name</Label><Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="E.g. Design System" /></div>
            <div><Label>Description</Label><Input value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Brief project goals..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNewProject({ ...newProject, open: false })}>Cancel</Button><Button onClick={submitProject} disabled={!newProject.name || newProject.teamIds.length === 0}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeDialog.open} onOpenChange={(o) => setRemoveDialog({ open: o, member: o ? removeDialog.member : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <strong>{removeDialog.member?.user?.fullName || removeDialog.member?.user?.email}</strong> ({removeDialog.member?.user?.email}) from this workspace?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog({ open: false, member: null })}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveMember}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Multi-Step Flow Dialog */}
      <Dialog open={transferFlow.open} onOpenChange={(o) => setTransferFlow({ open: o, step: 1, targetEmail: '', verifyEmail: '', targetMember: null, loading: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500 font-bold">
              <Crown className="h-5 w-5" /> Transfer Workspace Ownership
            </DialogTitle>
          </DialogHeader>

          {transferFlow.step === 1 && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Select the <strong>ADMIN</strong> member you want to transfer workspace ownership to:
              </p>
              <div>
                <Label className="text-xs font-medium mb-1 block">Select Admin Member</Label>
                <Select
                  value={transferFlow.targetEmail}
                  onValueChange={(val) => setTransferFlow({ ...transferFlow, targetEmail: val })}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Choose an Admin to transfer ownership..." />
                  </SelectTrigger>
                  <SelectContent>
                    {adminMembers.map((m) => (
                      <SelectItem key={m.id} value={m.user?.email}>
                        <span className="font-medium">{m.user?.fullName || m.user?.email}</span> ({m.user?.email}) - [{m.role}]
                      </SelectItem>
                    ))}
                    {adminMembers.length === 0 && (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No active Admin members found in this workspace.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md border border-border">
                Note: Only members assigned to an Admin role (*ADMIN, PRINCIPAL, DEAN*) appear in this list.
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setTransferFlow({ open: false, step: 1, targetEmail: '', verifyEmail: '', targetMember: null, loading: false })}>
                  Cancel
                </Button>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white font-semibold" onClick={handleTransferStep1} disabled={!transferFlow.targetEmail?.trim()}>
                  Next: Verify Authorization &rarr;
                </Button>
              </DialogFooter>
            </div>
          )}

          {transferFlow.step === 2 && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 space-y-1">
                <div className="font-semibold">Target Member Verified</div>
                <div>
                  <strong>{transferFlow.targetMember?.user?.fullName || transferFlow.targetMember?.user?.email}</strong> ({transferFlow.targetMember?.user?.email}) - <Badge variant="outline" className="text-[9px] uppercase border-amber-500/30 text-amber-500 font-semibold">{transferFlow.targetMember?.role}</Badge>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                For security verification, please re-enter <strong>YOUR email address</strong> (<code>{user?.email}</code>) to authorize sending this transfer request:
              </p>

              <div>
                <Label className="text-xs font-medium">Your Email (Verification)</Label>
                <Input
                  type="email"
                  placeholder={user?.email}
                  value={transferFlow.verifyEmail}
                  onChange={(e) => setTransferFlow({ ...transferFlow, verifyEmail: e.target.value })}
                  className="mt-1"
                />
              </div>

              <DialogFooter className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setTransferFlow((prev) => ({ ...prev, step: 1 }))}>
                  &larr; Back
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex-1"
                  onClick={handleTransferStep2}
                  disabled={!transferFlow.verifyEmail?.trim() || transferFlow.loading}
                >
                  {transferFlow.loading ? 'Sending Request...' : 'Send Transfer Request'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete School Wing Confirmation Dialog */}
      <Dialog open={deleteDeptDialog.open} onOpenChange={(o) => setDeleteDeptDialog({ open: o, dept: o ? deleteDeptDialog.dept : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete School Wing
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the School Wing <strong>{deleteDeptDialog.dept?.name}</strong>?
          </p>
          <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md border border-destructive/20">
            Warning: All classes and sections inside this wing will also be soft-deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDeptDialog({ open: false, dept: null })}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteDept}>Delete School Wing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Class Section Confirmation Dialog */}
      <Dialog open={deleteTeamDialog.open} onOpenChange={(o) => setDeleteTeamDialog({ open: o, team: o ? deleteTeamDialog.team : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Class & Section
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the class <strong>{deleteTeamDialog.team?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTeamDialog({ open: false, team: null })}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteTeam}>Delete Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OrgRenameModal open={renameModalOpen} onOpenChange={setRenameModalOpen} />
      <AcademicPromotionModal
        isOpen={promotionModalOpen}
        onClose={() => setPromotionModalOpen(false)}
        orgId={currentOrg?.id}
        onPromotionSuccess={load}
      />
    </motion.div>
  );
}


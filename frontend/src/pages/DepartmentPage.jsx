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
import { Building2, Users, Layers, Plus, Mail, Trash2, Crown, ChevronRight, GraduationCap, UserCheck, Filter } from 'lucide-react';
import { connectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) { return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase(); }

export default function DepartmentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'members';

  const { currentOrg, user, refresh, memberships } = useAuth();
  const { members: orgMembers, departments, projects, loading: loadingOrgData, refreshOrgData } = useOrgData();
  const members = orgMembers;
  const [invite, setInvite] = useState({ open: false, email: '', fullName: '', role: 'TEACHER' });
  const [newTeam, setNewTeam] = useState({ open: false, gradeName: '', sectionName: '', deptId: '' });
  const [newProject, setNewProject] = useState({ open: false, name: '', description: '', teamIds: [] });
  const [removeDialog, setRemoveDialog] = useState({ open: false, member: null });
  const [deleteTeamDialog, setDeleteTeamDialog] = useState({ open: false, team: null });

  // Sub-tabs for Members section: 'faculty' | 'students'
  const [memberSubTab, setMemberSubTab] = useState('faculty');
  const [studentWingFilter, setStudentWingFilter] = useState('ALL');
  const [studentClassFilter, setStudentClassFilter] = useState('ALL');

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
    (r) => (ROLE_RANKS[r] ?? 0) < currentRank
  );

  const activeMembership = useMemo(() => {
    if (!memberships) return null;
    return memberships.find((m) => m.orgId === currentOrg?.id);
  }, [memberships, currentOrg?.id]);

  const userDeptId = currentOrg?.departmentId || activeMembership?.departmentId || '';
  const userTeamId = currentOrg?.teamId || activeMembership?.teamId || '';

  const effectiveUserDeptId = useMemo(() => {
    if (userDeptId) return userDeptId;
    for (const d of departments) {
      if (d.teams?.some((t) => t.managerId === user?.id || t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id))) {
        return d.id;
      }
    }
    return '';
  }, [userDeptId, departments, user?.id]);

  const scopedDepartments = useMemo(() => {
    const roleUpper = (currentOrg?.role || '').toUpperCase();
    const titleUpper = (user?.title || '').toUpperCase();

    // Top Level Admins (Director, Principal, Admin) -> See ALL departments and ALL classes
    const isTopAdmin = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER'].some(
      (r) => roleUpper.includes(r) || titleUpper.includes(r)
    );
    if (isTopAdmin) return departments;

    const hodDeptIds = new Set(
      departments
        .filter(
          (d) =>
            d.headId === user?.id ||
            (effectiveUserDeptId && d.id === effectiveUserDeptId) ||
            d.memberships?.some(
              (m) =>
                (m.userId === user?.id || m.user?.id === user?.id) &&
                ['HOD', 'DEAN'].some((r) => (m.role || '').toUpperCase().includes(r) || titleUpper.includes(r))
            )
        )
        .map((d) => d.id)
    );

    return departments
      .filter((d) => {
        if (hodDeptIds.has(d.id)) return true;
        return d.teams?.some(
          (t) =>
            t.id === userTeamId ||
            t.managerId === user?.id ||
            t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)
        );
      })
      .map((d) => {
        const isMyDept = hodDeptIds.has(d.id);
        if (isMyDept) return d; // HOD / Dean gets ALL classes in their department!

        const myTeams = (d.teams || []).filter(
          (t) =>
            t.id === userTeamId ||
            t.managerId === user?.id ||
            t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)
        );
        return {
          ...d,
          teams: myTeams,
        };
      });
  }, [departments, effectiveUserDeptId, userTeamId, user?.id, user?.title, currentOrg?.role]);

  const scopedDeptIds = useMemo(() => new Set(scopedDepartments.map((d) => d.id)), [scopedDepartments]);
  const scopedTeamIds = useMemo(
    () => new Set(scopedDepartments.flatMap((d) => (d.teams || []).map((t) => t.id))),
    [scopedDepartments]
  );

  const displayMembers = useMemo(() => {
    return members.filter((m) => {
      if (m.departmentId && scopedDeptIds.has(m.departmentId)) return true;
      if (m.department?.id && scopedDeptIds.has(m.department.id)) return true;
      if (m.teamId && scopedTeamIds.has(m.teamId)) return true;
      if (m.team?.id && scopedTeamIds.has(m.team.id)) return true;
      if (m.userId === user?.id) return true;
      return false;
    });
  }, [members, scopedDeptIds, scopedTeamIds, user?.id]);

  const facultyMembers = useMemo(() => {
    return displayMembers.filter((m) => m.role !== 'STUDENT');
  }, [displayMembers]);

  const studentMembers = useMemo(() => {
    return displayMembers.filter((m) => {
      if (m.role !== 'STUDENT') return false;
      if (studentWingFilter !== 'ALL' && m.departmentId !== studentWingFilter && m.department?.id !== studentWingFilter) {
        return false;
      }
      if (studentClassFilter !== 'ALL' && m.teamId !== studentClassFilter && m.team?.id !== studentClassFilter) {
        return false;
      }
      return true;
    });
  }, [displayMembers, studentWingFilter, studentClassFilter]);

  const displayProjects = useMemo(() => {
    return projects.filter((p) => {
      if (p.teamId && scopedTeamIds.has(p.teamId)) return true;
      if (p.team?.id && scopedTeamIds.has(p.team.id)) return true;
      if (p.team?.departmentId && scopedDeptIds.has(p.team.departmentId)) return true;
      if (p.teams?.some((t) => scopedTeamIds.has(t.teamId || t.team?.id || t.id))) return true;
      if (p.memberships?.some((m) => m.userId === user?.id)) return true;
      return false;
    });
  }, [projects, scopedDeptIds, scopedTeamIds, user?.id]);

  const availableClassesForFilter = useMemo(() => {
    if (studentWingFilter === 'ALL') {
      return scopedDepartments.flatMap((d) => d.teams || []);
    }
    const targetDept = scopedDepartments.find((d) => d.id === studentWingFilter);
    return targetDept?.teams || [];
  }, [scopedDepartments, studentWingFilter]);

  // Data is loaded via OrgDataContext; use refreshOrgData when a manual refresh is needed

  useEffect(() => {
    let s = getSocket() || connectSocket();
    if (!s) return;
    const handleUpdate = () => {
      refreshOrgData();
      if (typeof refresh === 'function') refresh();
    };
    s.on('department:updated', handleUpdate);
    s.on('membership:updated', handleUpdate);
    return () => {
      s.off('department:updated', handleUpdate);
      s.off('membership:updated', handleUpdate);
    };
  }, [refreshOrgData, refresh]);

  const submitInvite = async () => {
    try { await orgApi.invite(currentOrg.id, invite); toast.success('Invited member to department'); setInvite({ open: false, email: '', fullName: '', role: 'STUDENT' }); refreshOrgData(); } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };

  const submitTeam = async () => {
    try {
      const targetDeptId = newTeam.deptId || scopedDepartments[0]?.id;
      if (!targetDeptId) {
        toast.error('Department ID required');
        return;
      }
      const combinedName = newTeam.sectionName?.trim()
        ? `${newTeam.gradeName.trim()} - ${newTeam.sectionName.trim()}`
        : newTeam.gradeName.trim();
      await orgApi.createTeam(currentOrg.id, targetDeptId, { name: combinedName });
      toast.success('Class & Section created');
      setNewTeam({ open: false, gradeName: '', sectionName: '', deptId: '' });
      refreshOrgData();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed');
    }
  };

  const confirmDeleteTeam = async () => {
    if (!deleteTeamDialog.team) return;
    try {
      await orgApi.deleteTeam(currentOrg.id, deleteTeamDialog.team.id);
      toast.success('Class Section deleted');
      setDeleteTeamDialog({ open: false, team: null });
      refreshOrgData();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete Class Section');
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

  const handleRoleChange = async (membershipId, newRole) => {
    try {
      await orgApi.updateMemberRole(currentOrg.id, membershipId, newRole);
      toast.success('Role updated');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to update role');
    }
  };

  const handleRemoveMember = async () => {
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

  const canEditRole = (m) => {
    return false;
  };

  const canRemoveMember = (m) => {
    if (m.userId === user?.id) return false;
    const targetRank = ROLE_RANKS[m.role] ?? 0;
    return targetRank < currentRank;
  };

  const allTeams = scopedDepartments.flatMap((d) => (d.teams || []).map((t) => ({ ...t, deptName: d.name })));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-4" data-testid="department-page">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Department Panel
        </h1>
        <p className="text-muted-foreground">Manage members, classes, and projects in your department</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="members"><Users className="h-3.5 w-3.5 mr-1" /> Department Members</TabsTrigger>
          <TabsTrigger value="structure"><Layers className="h-3.5 w-3.5 mr-1" /> Classes & Sections</TabsTrigger>
          <TabsTrigger value="projects"><Building2 className="h-3.5 w-3.5 mr-1" /> Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4 border-b border-border">
              <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setMemberSubTab('faculty')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    memberSubTab === 'faculty'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                  <span>Faculty & Staff</span>
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{facultyMembers.length}</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setMemberSubTab('students')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    memberSubTab === 'students'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Students Directory</span>
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{displayMembers.filter((m) => m.role === 'STUDENT').length}</Badge>
                </button>
              </div>

              <Button size="sm" onClick={() => setInvite({ ...invite, open: true })} data-testid="invite-member-btn">
                <Mail className="h-4 w-4 mr-1" /> Invite Member
              </Button>
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
                                <span className="font-medium">{m.user?.fullName || m.user?.email || 'Unnamed'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{m.user?.email}</td>
                            <td className="px-4 py-2.5">
                              {canEdit ? (
                                <Select value={m.role} onValueChange={(r) => handleRoleChange(m.id, r)}>
                                  <SelectTrigger className="h-7 w-32 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assignableRoles.map((r) => (
                                      <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wide">
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
              ) : (
                <div className="space-y-4">
                  {/* Filters Bar */}
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
                          <SelectItem value="ALL">All School Wings ({scopedDepartments.length})</SelectItem>
                          {scopedDepartments.map((d) => (
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
                                <span className="font-medium">{m.user?.fullName || m.user?.email || 'Unnamed Student'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{m.user?.email}</td>
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
                <CardTitle className="text-base">Classes & Sections in Your Department</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">Manage class sections assigned to your department wing.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setNewTeam({ ...newTeam, open: true })}><Plus className="h-4 w-4 mr-1" /> Class & Section</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scopedDepartments.map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
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
                      <span className="text-xs text-muted-foreground">{d._count?.memberships || 0} members · {d._count?.teams || 0} classes</span>
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
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                                onClick={(e) => { e.stopPropagation(); setDeleteTeamDialog({ open: true, team: t }); }}
                                title="Delete Class Section"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {scopedDepartments.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No department wings found</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Department Projects</CardTitle>
              <Button size="sm" onClick={() => setNewProject({ ...newProject, open: true })}><Plus className="h-4 w-4 mr-1" /> New project</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayProjects.map((p) => {
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
                        <span className="text-primary font-medium text-[11px] group-hover:underline">View details &rarr;</span>
                      </div>
                    </div>
                  );
                })}
                {displayProjects.length === 0 && <div className="col-span-full text-sm text-muted-foreground text-center py-6">No projects in your department yet</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={invite.open} onOpenChange={(o) => setInvite({ ...invite, open: o })}>
        <DialogContent><DialogHeader><DialogTitle>Invite member to department</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="person@company.com" /></div>
            <div><Label>Full name</Label><Input value={invite.fullName} onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} placeholder="Jane Doe" /></div>
            <div><Label>Role</Label><Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{(assignableRoles.length > 0 ? assignableRoles : ['TEACHER']).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInvite({ ...invite, open: false })}>Cancel</Button><Button onClick={submitInvite} disabled={!invite.email}>Invite</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Class Section Dialog */}
      <Dialog open={newTeam.open} onOpenChange={(o) => setNewTeam({ ...newTeam, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Class & Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Department Wing</Label>
              <Select value={newTeam.deptId || scopedDepartments[0]?.id} onValueChange={(val) => setNewTeam({ ...newTeam, deptId: val })}>
                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent>
                  {scopedDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Grade / Class Name</Label>
              <Input value={newTeam.gradeName} onChange={(e) => setNewTeam({ ...newTeam, gradeName: e.target.value })} placeholder="e.g. Grade 10 or Class 10" />
            </div>
            <div>
              <Label className="text-xs font-medium">Section Name</Label>
              <Input value={newTeam.sectionName} onChange={(e) => setNewTeam({ ...newTeam, sectionName: e.target.value })} placeholder="e.g. Sec A or Science A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTeam({ ...newTeam, open: false })}>Cancel</Button>
            <Button onClick={submitTeam} disabled={!newTeam.gradeName}>Create Class & Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={newProject.open} onOpenChange={(o) => setNewProject({ ...newProject, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Project Name</Label><Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="e.g. Annual Science Fair 2026" /></div>
            <div><Label>Description</Label><Input value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Project details" /></div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Assign Class Sections</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border p-2 rounded-md">
                {allTeams.map((t) => {
                  const isSelected = newProject.teamIds.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setNewProject((prev) => {
                          const exists = prev.teamIds.includes(t.id);
                          return {
                            ...prev,
                            teamIds: exists ? prev.teamIds.filter((id) => id !== t.id) : [...prev.teamIds, t.id],
                          };
                        });
                      }}
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs ${
                        isSelected ? 'bg-primary/10 font-bold text-primary' : 'hover:bg-muted/50'
                      }`}
                    >
                      <span>{t.deptName} / {t.name}</span>
                      {isSelected && <Badge variant="default" className="text-[9px] px-1 py-0">Selected</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProject({ ...newProject, open: false })}>Cancel</Button>
            <Button onClick={submitProject} disabled={!newProject.name}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

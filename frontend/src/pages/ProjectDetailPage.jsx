import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Building2, Users, ListTodo, Plus, UserPlus, CheckCircle2, Clock, Trash2, FolderGit2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [assignDialog, setAssignDialog] = useState({ open: false, selectedUserIds: [], search: '' });
  const [teamDialog, setTeamDialog] = useState({ open: false, selectedTeamId: '' });

  const loadProject = useCallback(async () => {
    if (!currentOrg?.id || !projectId) return;
    try {
      setLoading(true);
      const [projData, membersData, deptsData] = await Promise.all([
        orgApi.getProject(currentOrg.id, projectId),
        orgApi.members(currentOrg.id),
        orgApi.departments(currentOrg.id),
      ]);
      setProject(projData);
      setOrgMembers(Array.isArray(membersData) ? membersData : []);
      const allDepts = Array.isArray(deptsData) ? deptsData : [];
      const extractedTeams = allDepts.flatMap((d) => (d.teams || []).map((t) => ({ ...t, department: d })));
      setAllTeams(extractedTeams);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleAssignMember = async () => {
    if (!assignDialog.selectedUserIds?.length) return;
    try {
      await orgApi.assignProjectMember(currentOrg.id, projectId, assignDialog.selectedUserIds);
      toast.success(`${assignDialog.selectedUserIds.length} member(s) assigned to project`);
      setAssignDialog({ open: false, selectedUserIds: [], search: '' });
      loadProject();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to assign members');
    }
  };

  const handleRemoveMember = async (membershipId) => {
    try {
      await orgApi.removeProjectMember(currentOrg.id, projectId, membershipId);
      toast.success('Member removed from project');
      loadProject();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleAddTeam = async () => {
    if (!teamDialog.selectedTeamId) return;
    try {
      await orgApi.addProjectTeam(currentOrg.id, projectId, teamDialog.selectedTeamId);
      toast.success('Team added to project');
      setTeamDialog({ open: false, selectedTeamId: '' });
      loadProject();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to add team');
    }
  };

  const handleRemoveTeam = async (tId) => {
    try {
      await orgApi.removeProjectTeam(currentOrg.id, projectId, tId);
      toast.success('Team removed from project');
      loadProject();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to remove team');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading project details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Button variant="outline" onClick={() => navigate('/app/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  // Deduplicate all assigned teams (primary team + projectTeams)
  const teamsMap = new Map();
  if (project.team) teamsMap.set(project.team.id, project.team);
  (project.teams || []).forEach((pt) => {
    if (pt.team) teamsMap.set(pt.team.id, pt.team);
  });
  const allAssignedTeams = Array.from(teamsMap.values());

  // Collect members across ALL assigned teams + explicitly assigned project members
  const memberMap = new Map();
  allAssignedTeams.forEach((t) => {
    (t.memberships || []).forEach((m) => {
      if (m.user) {
        const existing = memberMap.get(m.userId);
        const teamNames = existing ? [...(existing.teamNames || [])] : [];
        if (t.name && !teamNames.includes(t.name)) {
          teamNames.push(t.name);
        }
        memberMap.set(m.userId, {
          ...(existing || m),
          isTeamMember: true,
          teamNames,
        });
      }
    });
  });

  (project.memberships || []).forEach((m) => {
    if (m.user) {
      const existing = memberMap.get(m.userId);
      memberMap.set(m.userId, {
        ...(existing || m),
        teamNames: existing?.teamNames || [],
        isProjectAssigned: true,
      });
    }
  });

  const allPeople = Array.from(memberMap.values());

  const tasks = project.tasks || [];
  const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;

  const canManage = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER', 'DIRECTOR'].includes(currentOrg?.role);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="project-detail-page">
      {/* Top Navigation & Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin')} className="mb-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Admin
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FolderGit2 className="h-5 w-5" />
              </div>
              <h1 className="font-display text-2xl font-bold">{project.name}</h1>
              <Badge variant="outline" className="uppercase text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                {project.status || 'ACTIVE'}
              </Badge>
            </div>

            {/* Assigned Teams */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">Assigned Teams:</span>
              {allAssignedTeams.map((t) => (
                <Badge key={t.id} variant="secondary" className="text-[11px] bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                  <span>{t.department?.name ? `${t.department.name} → ` : ''}{t.name}</span>
                  {canManage && allAssignedTeams.length > 1 && (
                    <button onClick={() => handleRemoveTeam(t.id)} className="ml-1 opacity-70 hover:opacity-100 text-destructive font-bold">&times;</button>
                  )}
                </Badge>
              ))}
              {allAssignedTeams.length === 0 && <span>Unassigned</span>}
              {canManage && (
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10" onClick={() => setTeamDialog({ open: true, selectedTeamId: '' })}>
                  <Plus className="h-3 w-3 mr-1" /> Add Team
                </Button>
              )}
            </div>

            {project.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" onClick={() => setAssignDialog({ open: true, userId: '' })}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Assign Member
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate('/app/tasks')}>
              <ListTodo className="h-4 w-4 mr-1.5" /> View Tasks
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Workforce / Members</div>
            <div className="text-2xl font-bold">{allPeople.length}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <ListTodo className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Tasks</div>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">In Progress</div>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold">{completedTasks}</div>
          </div>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Tabs defaultValue="people" className="space-y-4">
        <TabsList>
          <TabsTrigger value="people" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /> People Working on Project ({allPeople.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1.5">
            <ListTodo className="h-4 w-4" /> Project Tasks ({tasks.length})
          </TabsTrigger>
        </TabsList>

        {/* People Working on Project */}
        <TabsContent value="people">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Team Members & Workforce</CardTitle>
                <CardDescription className="text-xs">
                  Persons assigned to project teams ({allAssignedTeams.map((t) => t.name).join(', ')}) or explicitly assigned to this project
                </CardDescription>
              </div>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setAssignDialog({ open: true, userId: '' })}>
                  <UserPlus className="h-4 w-4 mr-1.5" /> Add Member
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Assignment Source</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allPeople.map((m) => (
                    <tr key={m.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.user?.avatarUrl} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(m.user?.fullName || m.user?.email)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground">{m.user?.fullName || 'Unnamed User'}</div>
                            {m.user?.status && (
                              <div className="text-[11px] text-muted-foreground capitalize">{m.user.status}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.user?.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="uppercase text-[10px] font-medium">
                          {m.role || 'MEMBER'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {m.teamNames && m.teamNames.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium">
                                {m.teamNames[0]}
                              </Badge>
                              {m.teamNames.length > 1 && (
                                <div className="relative group/team font-medium">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer"
                                    title={`Assigned Teams: ${m.teamNames.join(', ')}`}
                                  >
                                    +{m.teamNames.length - 1}
                                  </Badge>
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/team:block z-50 whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md border border-border">
                                    {m.teamNames.join(', ')}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {m.isProjectAssigned && (
                            <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-500 border-purple-500/20">
                              Project Workforce
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && m.isProjectAssigned && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMember(m.id)}
                            title="Remove from project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {allPeople.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No team members or assigned workforce found for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Tasks */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
                <CardDescription className="text-xs">Tasks assigned under {project.name}</CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/app/tasks')}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Task
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 font-medium">Task Title</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Assignees</th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`uppercase text-[10px] ${
                            t.status === 'DONE'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : t.status === 'IN_PROGRESS'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="uppercase text-[10px]">
                          {t.priority || 'MEDIUM'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-1 overflow-hidden">
                          {(t.assignees || []).map((a) => (
                            <Avatar key={a.id || a.user?.id} className="inline-block h-6 w-6 ring-2 ring-background">
                              <AvatarImage src={a.user?.avatarUrl} />
                              <AvatarFallback className="text-[9px]">{initials(a.user?.fullName || a.user?.email)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {(!t.assignees || t.assignees.length === 0) && (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No tasks created for this project yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Member Dialog (Multi-Select Checkboxes) */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => setAssignDialog({ open: o, selectedUserIds: [], search: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Assign Members to {project.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              placeholder="Search members by name or email..."
              value={assignDialog.search || ''}
              onChange={(e) => setAssignDialog({ ...assignDialog, search: e.target.value })}
              className="text-sm"
            />

            {/* Candidate List */}
            {(() => {
              const candidates = orgMembers
                .filter((m) => !allPeople.some((ap) => ap.userId === m.userId))
                .filter((m) => {
                  if (!assignDialog.search) return true;
                  const q = assignDialog.search.toLowerCase();
                  return (
                    (m.user?.fullName || '').toLowerCase().includes(q) ||
                    (m.user?.email || '').toLowerCase().includes(q)
                  );
                });

              const selectedUserIds = assignDialog.selectedUserIds || [];
              const selectedCount = selectedUserIds.length;
              const allSelected = candidates.length > 0 && candidates.every((m) => selectedUserIds.includes(m.userId));

              const toggleSelectAll = () => {
                if (allSelected) {
                  setAssignDialog({ ...assignDialog, selectedUserIds: [] });
                } else {
                  setAssignDialog({ ...assignDialog, selectedUserIds: candidates.map((m) => m.userId) });
                }
              };

              const toggleUser = (userId) => {
                const current = assignDialog.selectedUserIds || [];
                const updated = current.includes(userId)
                  ? current.filter((id) => id !== userId)
                  : [...current, userId];
                setAssignDialog({ ...assignDialog, selectedUserIds: updated });
              };

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>
                      {selectedCount} of {candidates.length} selected
                    </span>
                    {candidates.length > 0 && (
                      <button type="button" onClick={toggleSelectAll} className="text-primary hover:underline font-medium">
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border rounded-md p-2">
                    {candidates.map((m) => {
                      const isSelected = selectedUserIds.includes(m.userId);
                      return (
                        <div
                          key={m.userId}
                          onClick={() => toggleUser(m.userId)}
                          className={`flex items-center justify-between p-2 rounded-md border text-sm cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border hover:bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={m.user?.avatarUrl} />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {initials(m.user?.fullName || m.user?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-foreground text-xs">{m.user?.fullName || 'Unnamed'}</div>
                              <div className="text-[11px] text-muted-foreground">{m.user?.email}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] uppercase">
                            {m.role}
                          </Badge>
                        </div>
                      );
                    })}

                    {candidates.length === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No available workspace members to assign.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, selectedUserIds: [], search: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAssignMember} disabled={!assignDialog.selectedUserIds?.length}>
              Assign Selected ({assignDialog.selectedUserIds?.length || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Dialog */}
      <Dialog open={teamDialog.open} onOpenChange={(o) => setTeamDialog({ open: o, selectedTeamId: o ? teamDialog.selectedTeamId : '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Assign Team to {project.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>Select Team</Label>
            <Select value={teamDialog.selectedTeamId} onValueChange={(val) => setTeamDialog({ ...teamDialog, selectedTeamId: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                {allTeams
                  .filter((t) => !allAssignedTeams.some((at) => at.id === t.id))
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.deptName} &rarr; {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialog({ open: false, selectedTeamId: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAddTeam} disabled={!teamDialog.selectedTeamId}>
              Add Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

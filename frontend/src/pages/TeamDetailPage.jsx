import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi, channelApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Building2, Users, FolderGit2, UserPlus, UserCheck, Trash2, ChevronRight, Shield, Settings, Crown, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { currentOrg, user } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState([]);
  const [addMemberDialog, setAddMemberDialog] = useState({ open: false, selectedUserIds: [], search: '' });
  const [managerDialog, setManagerDialog] = useState({ open: false, managerId: '' });

  const loadTeam = useCallback(async () => {
    if (!currentOrg?.id || !teamId) return;
    try {
      setLoading(true);
      const [teamData, membersData] = await Promise.all([
        orgApi.getTeam(currentOrg.id, teamId),
        orgApi.members(currentOrg.id),
      ]);
      setTeam(teamData);
      setOrgMembers(Array.isArray(membersData) ? membersData : []);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to load team details');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, teamId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleAddMember = async () => {
    if (!addMemberDialog.selectedUserIds?.length) return;
    try {
      await orgApi.addTeamMember(currentOrg.id, teamId, addMemberDialog.selectedUserIds);
      toast.success(`${addMemberDialog.selectedUserIds.length} member(s) added to team`);
      setAddMemberDialog({ open: false, selectedUserIds: [], search: '' });
      loadTeam();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to add members to team');
    }
  };

  const handleRemoveMember = async (membershipId) => {
    try {
      await orgApi.removeTeamMember(currentOrg.id, teamId, membershipId);
      toast.success('Member removed from team');
      loadTeam();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleUpdateManager = async () => {
    try {
      await orgApi.updateTeam(currentOrg.id, teamId, { managerId: managerDialog.managerId || null });
      toast.success('Team manager updated');
      setManagerDialog({ open: false, managerId: '' });
      loadTeam();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to update manager');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading team details...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Team not found</h2>
        <Button variant="outline" onClick={() => navigate('/app/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  const teamMembers = team.memberships || [];
  const teamProjects = team.projects || [];
  const canManage = ['OWNER', 'ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER', 'DIRECTOR'].includes(currentOrg?.role);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="team-detail-page">
      {/* Navigation & Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin')} className="mb-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Admin
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Users className="h-5 w-5" />
              </div>
              <h1 className="font-display text-2xl font-bold">{team.name}</h1>
              <Badge variant="outline" className="uppercase text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                {team.department?.name || 'Department'}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>Department: <strong className="text-foreground">{team.department?.name}</strong></span>
              <span>•</span>
              <UserCheck className="h-3.5 w-3.5" />
              <span>Class Teacher: <strong className="text-foreground">{team.managerUser?.fullName || team.managerUser?.email || 'Unassigned'}</strong></span>
              {canManage && (
                <button onClick={() => setManagerDialog({ open: true, managerId: team.managerId || '' })} className="ml-1 text-primary hover:underline text-[11px]">
                  (Edit Class Teacher)
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" onClick={() => setAddMemberDialog({ open: true, userId: '' })}>
                <UserPlus className="h-4 w-4 mr-1.5" /> Add Member to Class
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Class Members</div>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <FolderGit2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Assigned Projects</div>
            <div className="text-2xl font-bold">{teamProjects.length}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Class Teacher</div>
            <div className="text-sm font-semibold truncate">{team.managerUser?.fullName || 'Not assigned'}</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Class Members ({teamMembers.length})
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-1.5">
            <FolderGit2 className="h-4 w-4" /> Class Projects ({teamProjects.length})
          </TabsTrigger>
        </TabsList>

        {/* Team Members List */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">People in {team.name}</CardTitle>
                <CardDescription className="text-xs">Manage workspace members assigned to this team</CardDescription>
              </div>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setAddMemberDialog({ open: true, userId: '' })}>
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
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((m) => (
                    <tr key={m.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.user?.avatarUrl} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(m.user?.fullName || m.user?.email)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1.5">
                              {m.user?.fullName || 'Unnamed User'}
                              {team.managerId === m.userId && (
                                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/20">
                                  CLASS TEACHER
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.user?.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="uppercase text-[10px] font-medium">
                          {m.role || 'MEMBER'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {m.userId !== user?.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-primary hover:bg-primary/10"
                              onClick={async () => {
                                try {
                                  const dmCh = await channelApi.dm(currentOrg.id, m.userId);
                                  navigate(`/app/channels/${dmCh.id}`);
                                } catch (e) {
                                  toast.error('Failed to start direct message');
                                }
                              }}
                              title="Send Direct Message"
                              data-testid={`dm-user-${m.userId}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveMember(m.id)}
                              title="Remove from team"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {teamMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No members in this team yet. Click "Add Member" to assign members.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Projects */}
        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Projects ({teamProjects.length})</CardTitle>
                <CardDescription className="text-xs">Projects owned by {team.name}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamProjects.map((p) => (
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
                      {p.description && <div className="text-sm mt-2 text-muted-foreground line-clamp-2">{p.description}</div>}
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p._count?.tasks || 0} tasks</span>
                      <span className="text-primary font-medium text-[11px] group-hover:underline">View workforce & details &rarr;</span>
                    </div>
                  </div>
                ))}
                {teamProjects.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No projects assigned to this team.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog (Multi-Select Checkboxes) */}
      <Dialog open={addMemberDialog.open} onOpenChange={(o) => setAddMemberDialog({ open: o, selectedUserIds: [], search: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Add Members to {team.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              placeholder="Search members by name or email..."
              value={addMemberDialog.search || ''}
              onChange={(e) => setAddMemberDialog({ ...addMemberDialog, search: e.target.value })}
              className="text-sm"
            />

            {/* Candidate List */}
            {(() => {
              const candidates = orgMembers
                .filter((m) => !teamMembers.some((tm) => tm.userId === m.userId))
                .filter((m) => {
                  if (!addMemberDialog.search) return true;
                  const q = addMemberDialog.search.toLowerCase();
                  return (
                    (m.user?.fullName || '').toLowerCase().includes(q) ||
                    (m.user?.email || '').toLowerCase().includes(q)
                  );
                });

              const selectedUserIds = addMemberDialog.selectedUserIds || [];
              const selectedCount = selectedUserIds.length;
              const allSelected = candidates.length > 0 && candidates.every((m) => selectedUserIds.includes(m.userId));

              const toggleSelectAll = () => {
                if (allSelected) {
                  setAddMemberDialog({ ...addMemberDialog, selectedUserIds: [] });
                } else {
                  setAddMemberDialog({ ...addMemberDialog, selectedUserIds: candidates.map((m) => m.userId) });
                }
              };

              const toggleUser = (userId) => {
                const current = addMemberDialog.selectedUserIds || [];
                const updated = current.includes(userId)
                  ? current.filter((id) => id !== userId)
                  : [...current, userId];
                setAddMemberDialog({ ...addMemberDialog, selectedUserIds: updated });
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
                        No available workspace members to add.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialog({ open: false, selectedUserIds: [], search: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!addMemberDialog.selectedUserIds?.length}>
              Add Selected ({addMemberDialog.selectedUserIds?.length || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Class Teacher Dialog */}
      <Dialog open={managerDialog.open} onOpenChange={(o) => setManagerDialog({ open: o, managerId: o ? managerDialog.managerId : '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Assign Class Teacher for {team.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>Select Class Teacher</Label>
            <Select value={managerDialog.managerId} onValueChange={(val) => setManagerDialog({ ...managerDialog, managerId: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class teacher (or unassign)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">None (Unassigned)</SelectItem>
                {orgMembers
                  .filter((m) => !['DIRECTOR', 'OWNER', 'STUDENT'].includes(m.role))
                  .map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user?.fullName || m.user?.email} ({m.user?.email}) - {m.role}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManagerDialog({ open: false, managerId: '' })}>
              Cancel
            </Button>
            <Button onClick={handleUpdateManager}>
              Save Class Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

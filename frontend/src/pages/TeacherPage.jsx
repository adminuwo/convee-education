import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { orgApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Users, Layers, Crown, ChevronRight, GraduationCap, UserCheck, Search, BookOpen, Sparkles, FolderGit2 } from 'lucide-react';
import { connectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function initials(n) {
  return (n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

export default function TeacherPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'students';

  const { currentOrg, user, refresh, memberships } = useAuth();
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  const load = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      const [m, d, p] = await Promise.all([
        orgApi.members(currentOrg.id).catch(() => []),
        orgApi.departments(currentOrg.id).catch(() => []),
        orgApi.projects(currentOrg.id).catch(() => []),
      ]);
      setMembers(Array.isArray(m) ? m : []);
      setDepartments(Array.isArray(d) ? d : []);
      setProjects(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error('Error in TeacherPage load:', err);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    load();
    let s = getSocket() || connectSocket();
    if (!s) return;
    const handleUpdate = () => { load(); if (typeof refresh === 'function') refresh(); };
    s.on('department:updated', handleUpdate);
    s.on('membership:updated', handleUpdate);
    return () => {
      s.off('department:updated', handleUpdate);
      s.off('membership:updated', handleUpdate);
    };
  }, [load, refresh]);

  // All Class Sections across departments
  const allTeams = useMemo(() => {
    const teamsList = [];
    departments.forEach((d) => {
      (d.teams || []).forEach((t) => {
        teamsList.push({
          ...t,
          deptId: d.id,
          deptName: d.name,
        });
      });
    });
    return teamsList;
  }, [departments]);

  // Classes where the current teacher is Class Teacher (t.managerId === user?.id)
  const myClassTeacherTeams = useMemo(() => {
    return allTeams.filter((t) => t.managerId === user?.id);
  }, [allTeams, user?.id]);

  // Classes the teacher is assigned to or part of (as Class Teacher or member)
  const myAssignedTeams = useMemo(() => {
    return allTeams.filter((t) => {
      if (t.managerId === user?.id) return true;
      if (t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)) return true;
      return false;
    });
  }, [allTeams, user?.id]);

  // Set default selected Class Teacher section
  useEffect(() => {
    if (myClassTeacherTeams.length > 0 && !selectedClassId) {
      setSelectedClassId(myClassTeacherTeams[0].id);
    }
  }, [myClassTeacherTeams, selectedClassId]);

  const activeClassTeam = useMemo(() => {
    if (!selectedClassId) return myClassTeacherTeams[0] || null;
    return myClassTeacherTeams.find((t) => t.id === selectedClassId) || myClassTeacherTeams[0] || null;
  }, [selectedClassId, myClassTeacherTeams]);

  // Students belonging to the selected Class Teacher section
  const classStudents = useMemo(() => {
    if (!activeClassTeam) return [];
    
    // Aggregate students: memberships of this team + members in team channel
    const teamMemberUserIds = new Set();
    const resultStudents = [];

    (activeClassTeam.memberships || []).forEach((m) => {
      const u = m.user || {};
      const isStudentRole = m.role === 'STUDENT';
      if (isStudentRole && u.id && !teamMemberUserIds.has(u.id)) {
        teamMemberUserIds.add(u.id);
        resultStudents.push({ ...m, user: u });
      }
    });

    // Also check global members list filtered by teamId or departmentId
    members.forEach((m) => {
      if (m.role === 'STUDENT' && (m.teamId === activeClassTeam.id || m.team?.id === activeClassTeam.id)) {
        const uId = m.userId || m.user?.id;
        if (uId && !teamMemberUserIds.has(uId)) {
          teamMemberUserIds.add(uId);
          resultStudents.push(m);
        }
      }
    });

    if (!studentSearch.trim()) return resultStudents;
    const q = studentSearch.toLowerCase().trim();
    return resultStudents.filter((s) => (s.user?.fullName || '').toLowerCase().includes(q) || (s.user?.email || '').toLowerCase().includes(q));
  }, [activeClassTeam, members, studentSearch]);

  // Projects assigned to or connected with teacher's assigned teams
  const myAssignedProjects = useMemo(() => {
    const assignedTeamIds = new Set(myAssignedTeams.map((t) => t.id));
    return projects.filter((p) => {
      if (p.teamId && assignedTeamIds.has(p.teamId)) return true;
      if (p.team?.id && assignedTeamIds.has(p.team.id)) return true;
      if (p.teams?.some((t) => assignedTeamIds.has(t.teamId || t.team?.id || t.id))) return true;
      if (p.members?.some((m) => m.userId === user?.id)) return true;
      return false;
    });
  }, [projects, myAssignedTeams, user?.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight flex items-center gap-2">
                Classroom Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage your class students, assigned class sections, and class projects.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-semibold">
            <UserCheck className="h-3.5 w-3.5 mr-1" /> {currentOrg?.role || 'TEACHER'}
          </Badge>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="students" className="text-xs font-semibold flex items-center gap-1.5" data-testid="tab-students">
            <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
            <span>Class Students</span>
          </TabsTrigger>
          <TabsTrigger value="structures" className="text-xs font-semibold flex items-center gap-1.5" data-testid="tab-structures">
            <Building2 className="h-3.5 w-3.5 text-blue-500" />
            <span>My Classes</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs font-semibold flex items-center gap-1.5" data-testid="tab-projects">
            <FolderGit2 className="h-3.5 w-3.5 text-purple-500" />
            <span>My Projects</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Class Students (Class Teacher View) */}
        <TabsContent value="students" className="space-y-4">
          {myClassTeacherTeams.length > 0 ? (
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-emerald-500" /> {activeClassTeam?.name} Students
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/30">
                      <Crown className="h-3 w-3 mr-1" /> Class Teacher
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {activeClassTeam?.deptName} Wing · Showing all students enrolled in your class section
                  </CardDescription>
                </div>

                {myClassTeacherTeams.length > 1 && (
                  <div className="w-full sm:w-64">
                    <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Select Class Section</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {myClassTeacherTeams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.deptName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Search Bar */}
                <div className="flex items-center gap-2 max-w-sm">
                  <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search students by name or email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Students Table */}
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/30">
                      <tr className="text-left text-muted-foreground text-xs font-semibold">
                        <th className="px-4 py-2.5">Student Name</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Role / Position</th>
                        <th className="px-4 py-2.5">Enrolled Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((s) => (
                        <tr key={s.id || s.userId} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8 border border-border">
                                <AvatarImage src={s.user?.avatarUrl} />
                                <AvatarFallback className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold">
                                  {initials(s.user?.fullName || s.user?.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-foreground text-xs">{s.user?.fullName || s.user?.email || 'Unnamed Student'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.user?.email}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                              STUDENT
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {s.joinedAt ? new Date(s.joinedAt).toLocaleDateString() : 'Active'}
                          </td>
                        </tr>
                      ))}
                      {classStudents.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                            No student accounts found in this class section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="py-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">No Class Teacher Assignment</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You are currently not assigned as the <strong>Class Teacher</strong> for any class section. When assigned by an HOD or Administrator, your class student directory will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Structures / My Classes */}
        <TabsContent value="structures" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" /> Assigned Classes & Sections
              </CardTitle>
              <CardDescription className="text-xs">
                Classes and academic sections you teach or lead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAssignedTeams.map((t) => {
                  const isMyClassTeacher = t.managerId === user?.id;
                  const memberCount = (t.memberships || []).length || (t._count?.memberships) || 0;
                  return (
                    <div
                      key={t.id}
                      onClick={() => navigate(`/app/teams/${t.id}`)}
                      className="group rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-base group-hover:text-primary transition-colors flex items-center gap-2">
                            {t.name}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.deptName} Wing</div>

                        {isMyClassTeacher ? (
                          <Badge variant="outline" className="mt-2.5 text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 font-semibold flex items-center gap-1 w-max">
                            <Crown className="h-3 w-3" /> Class Teacher (You)
                          </Badge>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <span>Class Teacher:</span>
                            <span className="font-medium text-foreground">{t.manager?.fullName || t.manager?.email || 'Unassigned'}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{memberCount} members</span>
                        <span className="text-primary font-medium text-[11px] group-hover:underline">View class channel &rarr;</span>
                      </div>
                    </div>
                  );
                })}

                {myAssignedTeams.length === 0 && (
                  <div className="col-span-full text-center py-10 text-xs text-muted-foreground">
                    No assigned classes or sections found for your account.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: My Projects */}
        <TabsContent value="projects" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-purple-500" /> Assigned Projects
              </CardTitle>
              <CardDescription className="text-xs">
                Academic and department projects assigned to you or your class sections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAssignedProjects.map((p) => {
                  const teamNames = p.teams?.length > 0
                    ? p.teams.map((pt) => `${pt.team?.department?.name || 'General'} / ${pt.team?.name}`).join(', ')
                    : (p.team ? `${p.team?.department?.name || 'General'} / ${p.team?.name}` : 'General');
                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/app/projects/${p.id}`)}
                      className="group rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-base group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {p.name}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{teamNames}</div>
                        {p.description && <div className="text-xs mt-2 text-muted-foreground line-clamp-2">{p.description}</div>}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p._count?.tasks || 0} tasks</span>
                        <span className="text-primary font-medium text-[11px] group-hover:underline">View workforce & details &rarr;</span>
                      </div>
                    </div>
                  );
                })}

                {myAssignedProjects.length === 0 && (
                  <div className="col-span-full text-center py-10 text-xs text-muted-foreground">
                    No assigned projects found for your account or classes.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

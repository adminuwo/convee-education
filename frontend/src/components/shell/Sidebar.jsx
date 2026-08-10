import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Home, Hash, ListTodo, Sparkles, Calendar, FolderOpen, BarChart3, Shield, ShieldCheck, Settings, Plus, ChevronDown, ChevronRight, Lock, Volume2, Users, MoreHorizontal, Building2, Check, GraduationCap, FolderGit2, BookOpen, Key, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrgData } from '@/contexts/OrgDataContext';
import { channelApi, orgApi } from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';

const PRIMARY_NAV = [
  { key: 'home', label: 'Home', icon: Home, path: '/app/home' },
  { key: 'tasks', label: 'Tasks', icon: ListTodo, path: '/app/tasks' },
  { key: 'homework', label: 'Homework', icon: BookOpen, path: '/app/homework' },
  { key: 'parent', label: 'Parent Portal', icon: UserCheck, path: '/app/parent' },
  { key: 'ai', label: 'AI Assistant', icon: Sparkles, path: '/app/ai' },
  { key: 'meetings', label: 'Meetings', icon: Calendar, path: '/app/meetings' },
  { key: 'files', label: 'Files', icon: FolderOpen, path: '/app/files' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, path: '/app/analytics' },
];

function initials(name) {
  return (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user, memberships, currentOrg, switchOrg, logout, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  
  const {
    departments,
    projects,
    channels,
    setChannels,
    members: orgMembers,
    loading: loadingOrgData,
    refreshOrgData,
  } = useOrgData();

  const loadingProjects = loadingOrgData && projects.length === 0;
  const loadingChannels = loadingOrgData && channels.length === 0;

  const [openGroups, setOpenGroups] = useState({ classes: true, projects: true, channels: true, dms: true });
  const [newCh, setNewCh] = useState({ open: false, name: '', type: 'PUBLIC' });
  const [newOrg, setNewOrg] = useState({ open: false, name: '' });
  const [newDm, setNewDm] = useState({ open: false, targetUserId: '' });

  const isAdmin = currentOrg && ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD', 'TEACHER', 'DIRECTOR'].includes(currentOrg.role);
  const isManagerPlus = isAdmin;
  const isOwner = currentOrg?.role === 'DIRECTOR';

  const [openDepts, setOpenDepts] = useState({});
  const [openGrades, setOpenGrades] = useState({});
  const [openSections, setOpenSections] = useState({});

  const currentChannelId = useMemo(() => {
    const match = location.pathname.match(/\/app\/channels\/([^/]+)/);
    return match ? match[1] : '';
  }, [location.pathname]);

  // Automatically clear unread badge when active channel changes
  useEffect(() => {
    if (currentChannelId) {
      setChannels((prev) => prev.map((x) => (x.id === currentChannelId ? { ...x, unreadCount: 0 } : x)));
      channelApi.markRead(currentChannelId).catch(() => {});
    }
  }, [currentChannelId, setChannels]);

  useEffect(() => {
    let s = getSocket() || connectSocket();
    if (!s) return;

    const handleChannelCreated = (newCh) => {
      if (!newCh || !currentOrg?.id || newCh.orgId === currentOrg.id) {
        refreshOrgData();
      }
    };

    const handleProjectUpdated = (proj) => {
      if (!proj || !currentOrg?.id || proj.orgId === currentOrg.id) {
        refreshOrgData();
      }
    };

    const handleMessageNew = (msg) => {
      setChannels((prev) => {
        const exists = prev.some((c) => c.id === msg.channelId);
        if (!exists) {
          refreshOrgData();
          return prev;
        }
        return prev.map((c) => {
          if (c.id === msg.channelId) {
            const isCurrentActive = currentChannelId === msg.channelId;
            const isFromOther = msg.senderId !== user?.id;
            const unreadCount = (isFromOther && !isCurrentActive) ? (c.unreadCount || 0) + 1 : 0;
            return { ...c, unreadCount };
          }
          return c;
        });
      });
    };

    const handlePresence = ({ userId, status }) => {
      setChannels((prev) =>
        prev.map((ch) => ({
          ...ch,
          members: (ch.members || []).map((m) =>
            m.userId === userId || m.user?.id === userId
              ? { ...m, user: { ...(m.user || {}), status } }
              : m
          ),
        }))
      );
    };

    const handleChannelDeleted = () => {
      refreshOrgData();
    };

    const handleDeptOrMemberUpdate = () => {
      refreshOrgData();
      if (typeof refresh === 'function') refresh();
    };

    s.on('channel:created', handleChannelCreated);
    s.on('channel:deleted', handleChannelDeleted);
    s.on('project:created', handleProjectUpdated);
    s.on('project:updated', handleProjectUpdated);
    s.on('message:new', handleMessageNew);
    s.on('user:presence', handlePresence);
    s.on('department:updated', handleDeptOrMemberUpdate);
    s.on('membership:updated', handleDeptOrMemberUpdate);

    return () => {
      s.off('channel:created', handleChannelCreated);
      s.off('channel:deleted', handleChannelDeleted);
      s.off('project:created', handleProjectUpdated);
      s.off('project:updated', handleProjectUpdated);
      s.off('message:new', handleMessageNew);
      s.off('user:presence', handlePresence);
      s.off('department:updated', handleDeptOrMemberUpdate);
      s.off('membership:updated', handleDeptOrMemberUpdate);
    };
  }, [refreshOrgData, setChannels, currentOrg?.id, currentChannelId, user?.id, navigate, refresh]);

  const getDMUser = (ch) => {
    if (!ch || ch.type !== 'DIRECT' || !ch.members) return null;
    const other = ch.members.find((m) => m.userId !== user?.id);
    return other?.user || null;
  };

  const handleSelectChannel = (channelId) => {
    setChannels((prev) => prev.map((x) => (x.id === channelId ? { ...x, unreadCount: 0 } : x)));
    channelApi.markRead(channelId).catch(() => {});
    go(`/app/channels/${channelId}`);
  };

  const go = (p) => { navigate(p); onNavigate?.(); };

  const active = (p) => {
    if (location.pathname === p) return true;
    if (p !== '/app' && p !== '/app/home') {
      return location.pathname.startsWith(p + '/');
    }
    return false;
  };

  const isStudent = currentOrg?.role === 'STUDENT';
  const isParent = currentOrg?.role === 'PARENT';
  const navItems = PRIMARY_NAV.filter((it) => {
    if (isParent) {
      return ['parent', 'homework', 'ai', 'meetings'].includes(it.key);
    }
    if (it.key === 'parent') return false;
    if (isStudent && (it.key === 'analytics' || it.key === 'tasks')) return false;
    return true;
  });

  const isFullAccessRole = ['DIRECTOR', 'PRINCIPAL', 'DEAN', 'ADMIN'].includes(currentOrg?.role);

  const activeMembership = useMemo(() => {
    if (!memberships) return null;
    return memberships.find((m) => m.orgId === currentOrg?.id);
  }, [memberships, currentOrg?.id]);

  const isClassTeacher = useMemo(() => {
    if (!user?.id || !departments) return false;
    return departments.some((d) =>
      (d.teams || []).some((t) => t.managerId === user?.id)
    );
  }, [departments, user?.id]);

  const userTeamId = activeMembership?.teamId || '';
  const userDeptId = activeMembership?.departmentId || '';

  const classChannels = channels.filter((c) => c.type === 'TEAM');
  const standardChannels = channels.filter((c) => {
    if (c.type === 'TEAM' || c.type === 'DIRECT' || c.type === 'PROJECT') return false;
    if (isParent) {
      return c.type === 'ANNOUNCEMENT' || c.name.toLowerCase().includes('announc');
    }
    return true;
  });
  const chDMs = channels.filter((c) => c.type === 'DIRECT');

  const displayDepartments = useMemo(() => {
    const roleUpper = (currentOrg?.role || '').toUpperCase();
    const titleUpper = (user?.title || '').toUpperCase();

    // Top Level Admins (Director, Principal, Admin) -> See ALL classes in ALL departments
    const isTopAdmin = ['ADMIN', 'DIRECTOR', 'PRINCIPAL'].some(
      (r) => roleUpper.includes(r) || titleUpper.includes(r)
    );
    if (isTopAdmin) return departments;

    const myTeamChannelNames = new Set(
      classChannels.map((c) => c.name.toLowerCase())
    );

    // Find all departments where this user is HOD or Dean
    const hodDeptIds = new Set(
      departments
        .filter(
          (d) =>
            d.headId === user?.id ||
            (userDeptId && d.id === userDeptId) ||
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
        if (d.teams?.some((t) => {
          const chName = `team-${t.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          return (
            t.id === userTeamId ||
            t.managerId === user?.id ||
            myTeamChannelNames.has(chName) ||
            t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)
          );
        })) return true;
        return false;
      })
      .map((d) => {
        const isMyDept = hodDeptIds.has(d.id);
        return {
          ...d,
          teams: d.teams?.filter((t) => {
            // HOD / Dean gets ALL classes in their own department
            if (isMyDept) return true;

            // For other departments, must be Class Teacher or assigned member
            const chName = `team-${t.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            if (userTeamId && t.id === userTeamId) return true;
            if (t.managerId === user?.id) return true;
            if (myTeamChannelNames.has(chName)) return true;
            if (user?.id && t.memberships?.some((m) => m.userId === user?.id || m.user?.id === user?.id)) return true;
            return false;
          }),
        };
      })
      .filter((d) => (d.teams || []).length > 0 || hodDeptIds.has(d.id));
  }, [departments, userDeptId, userTeamId, user?.id, user?.title, currentOrg?.role, classChannels]);

  const getGroupedGrades = (teams) => {
    const gradesMap = {};
    for (const team of teams || []) {
      const match = team.name.match(/^(.*?)\s*[-–—/|]\s*(.*)$/);
      let gradeName = '';
      let sectionName = '';

      if (match) {
        gradeName = match[1].trim();
        sectionName = match[2].trim();
      } else {
        const gradeRegex = /^(Grade\s*\d+|Class\s*\d+|\w+)\s+(.*)$/i;
        const subMatch = team.name.match(gradeRegex);
        if (subMatch) {
          gradeName = subMatch[1].trim();
          sectionName = subMatch[2].trim();
        } else {
          gradeName = team.name;
          sectionName = 'General';
        }
      }

      if (!gradesMap[gradeName]) gradesMap[gradeName] = [];
      gradesMap[gradeName].push({
        ...team,
        sectionName,
      });
    }
    return gradesMap;
  };

  const createChannel = async () => {
    try {
      const c = await channelApi.create({
        orgId: currentOrg.id,
        name: newCh.name,
        type: newCh.type,
        memberIds: newCh.memberIds || [],
      });
      setNewCh({ open: false, name: '', type: 'PUBLIC', memberIds: [] });
      toast.success('Channel created');
      await refreshOrgData();
      navigate(`/app/channels/${c.id}`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };

  const startDM = async (targetUserId) => {
    if (!targetUserId || !currentOrg?.id) return;
    try {
      const dmCh = await channelApi.dm(currentOrg.id, targetUserId);
      setNewDm({ open: false, targetUserId: '' });
      await refreshOrgData();
      navigate(`/app/channels/${dmCh.id}`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed to start direct message'); }
  };

  const createOrg = async () => {
    try {
      const o = await orgApi.create({ name: newOrg.name });
      setNewOrg({ open: false, name: '' });
      toast.success('Organization created');
      window.location.reload();
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Workspace switcher */}
      <div className="border-b border-[hsl(var(--sidebar-border))] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5"
              data-testid="workspace-switcher"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md gradient-brand text-white font-semibold text-sm">
                {initials(currentOrg?.name)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold truncate font-display">{currentOrg?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{currentOrg?.role}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem key={m.orgId} onClick={() => switchOrg(m.orgId)} data-testid={`workspace-item-${m.organization.slug}`}>
                <Building2 className="h-4 w-4 mr-2" />
                <div className="flex-1 truncate">{m.organization.name}</div>
                <Badge variant="secondary" className="ml-2 text-[10px]">{m.role}</Badge>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNewOrg({ open: true, name: '' })} data-testid="new-workspace-btn">
              <Plus className="h-4 w-4 mr-2" /> New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="pl-2 pr-3.5 py-2">
          {/* Primary nav */}
          <div className="space-y-0.5">
            {navItems.map((it) => (
              <button
                key={it.key}
                onClick={() => go(it.path)}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active(it.path)
                    ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                data-testid={`nav-${it.key}`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </button>
            ))}
            {isFullAccessRole ? (
              <>
                <button
                  onClick={() => go('/app/admin')}
                  className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active('/app/admin')
                      ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  data-testid="nav-admin"
                >
                  <Shield className="h-4 w-4" /> Admin
                </button>
                <button
                  onClick={() => go('/app/student-id-generator')}
                  className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active('/app/student-id-generator')
                      ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium text-amber-400 font-semibold'
                      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  data-testid="nav-student-id-generator"
                >
                  <Key className="h-4 w-4 text-amber-400" /> Student ID Generator
                </button>
              </>
            ) : ['DEAN', 'HOD'].includes(currentOrg?.role) ? (
              <button
                onClick={() => go('/app/department')}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active('/app/department') || active('/app/admin')
                    ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                data-testid="nav-department"
              >
                <Building2 className="h-4 w-4" /> Department
              </button>
            ) : null}
            {['TEACHER', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN', 'DIRECTOR', 'OWNER'].includes(currentOrg?.role) && currentOrg?.role !== 'STUDENT' && (
              <button
                onClick={() => go('/app/classroom')}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active('/app/classroom')
                    ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                data-testid="nav-classroom"
              >
                <GraduationCap className="h-4 w-4 text-emerald-500" /> Classroom
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => go('/app/role-permissions')}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active('/app/role-permissions')
                    ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                data-testid="nav-role-permissions"
              >
                <ShieldCheck className="h-4 w-4 text-amber-500" /> Role Permissions
              </button>
            )}
            {user?.systemRole === 'SUPER_ADMIN' && (
              <button
                onClick={() => go('/app/super-admin')}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active('/app/super-admin')
                    ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                data-testid="nav-super-admin"
              >
                <ShieldCheck className="h-4 w-4" /> Super Admin
              </button>
            )}
          </div>          {/* Classes / School Wings group */}
          {!isParent && (
            <div className="mt-4">
              <div className="flex items-center gap-1 px-2 py-1">
                <button onClick={() => setOpenGroups({ ...openGroups, classes: !openGroups.classes })} className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground tracking-wide hover:text-foreground">
                  {openGroups.classes ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>Classes</span>
                </button>
                {isManagerPlus && (
                  <button
                    onClick={() => navigate('/app/admin?tab=structure')}
                    className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-all shrink-0 ml-1"
                    title="Manage Classes & Sections"
                    data-testid="new-class-btn"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {openGroups.classes && (
                <div className="mt-1 space-y-1 pl-1">
                  {displayDepartments.map((dept) => {
                    const isDeptOpen = openDepts[dept.id] ?? isStudent;
                    const groupedGrades = getGroupedGrades(dept.teams || []);
                    const gradeNames = Object.keys(groupedGrades);

                    return (
                      <div key={dept.id} className="space-y-0.5">
                        {/* Level 1: School Wing / Department Dropdown */}
                        <button
                          onClick={() => setOpenDepts((prev) => ({ ...prev, [dept.id]: !prev[dept.id] }))}
                          className="w-full flex items-center justify-between rounded-md px-2 py-1 text-xs font-semibold text-foreground/90 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isDeptOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{dept.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-border text-muted-foreground font-medium">
                            {dept.teams?.length || 0}
                          </Badge>
                        </button>

                        {/* Level 2: Classes / Grades under Department */}
                        {isDeptOpen && (
                          <div className="ml-3 pl-2 border-l border-border/50 space-y-0.5">
                            {gradeNames.map((gradeName) => {
                              const gradeKey = `${dept.id}_${gradeName}`;
                              const isGradeOpen = openGrades[gradeKey] ?? isStudent;
                              const teamsInGrade = groupedGrades[gradeName];

                              return (
                                <div key={gradeKey} className="space-y-0.5">
                                  {/* Grade / Class Dropdown */}
                                  <button
                                    onClick={() => setOpenGrades((prev) => ({ ...prev, [gradeKey]: !prev[gradeKey] }))}
                                    className="w-full flex items-center justify-between rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {isGradeOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      <GraduationCap className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                      <span className="truncate font-semibold">{gradeName}</span>
                                    </div>
                                  </button>

                                  {/* Level 3: Sections under Grade */}
                                  {isGradeOpen && (
                                    <div className="ml-3 pl-2 border-l border-border/40 space-y-0.5">
                                      {teamsInGrade.map((team) => {
                                        const isSectionOpen = openSections[team.id] ?? false;
                                        const targetChannel = classChannels.find(
                                          (c) => c.name.toLowerCase() === `team-${team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
                                        );
                                        const isSelected = targetChannel && currentChannelId === targetChannel.id;

                                        const rawMembers = [
                                          ...(team.manager ? [{ id: `mgr-${team.manager.id}`, userId: team.manager.id, user: team.manager, role: 'TEACHER' }] : []),
                                          ...(team.memberships || []),
                                        ];

                                        if (targetChannel && targetChannel.members) {
                                          targetChannel.members.forEach((cm) => {
                                            if (cm.user) {
                                              rawMembers.push({
                                                id: `cm-${cm.userId}`,
                                                userId: cm.userId,
                                                user: cm.user,
                                                role: 'MEMBER',
                                              });
                                            }
                                          });
                                        }

                                        const uniqueMembers = Array.from(
                                          new Map(rawMembers.map((m) => [m.userId || m.user?.id || m.id, m])).values()
                                        );

                                        return (
                                          <div key={team.id} className="space-y-0.5 min-w-0">
                                            <div className="w-full flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs min-w-0">
                                              <button
                                                onClick={() => {
                                                  if (targetChannel) handleSelectChannel(targetChannel.id);
                                                  else navigate('/app/admin?tab=structure');
                                                }}
                                                className={`flex items-center gap-1.5 truncate min-w-0 text-left py-0.5 ${
                                                  isSelected ? 'text-primary font-bold' : 'text-foreground/80 hover:text-foreground'
                                                }`}
                                              >
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                <span className="truncate">{team.sectionName}</span>
                                              </button>

                                              {/* Toggle Members dropdown placed right next to Section Name */}
                                              {uniqueMembers.length > 0 && (
                                                <button
                                                  onClick={() => setOpenSections((prev) => ({ ...prev, [team.id]: !prev[team.id] }))}
                                                  className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors shrink-0 ml-0.5"
                                                  title={`${uniqueMembers.length} Member(s)`}
                                                >
                                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 flex items-center gap-0.5">
                                                    <UserIcon className="h-2.5 w-2.5" />
                                                    {uniqueMembers.length}
                                                    {isSectionOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                                                  </Badge>
                                                </button>
                                              )}
                                            </div>

                                            {/* Level 4: Enrolled Members under Section */}
                                            {isSectionOpen && (
                                              <div className="ml-2 pl-1.5 border-l border-border/30 space-y-0.5 min-w-0 overflow-hidden">
                                                {uniqueMembers.map((m) => {
                                                  const uId = m.userId || m.user?.id || m.id;
                                                  const fullName = m.user?.fullName || m.user?.email || 'User';
                                                  const hasRoleInName = /\([^)]+\)$/.test(fullName);
                                                  const roleLabel = (!hasRoleInName && m.role && m.role !== 'MEMBER') ? ` (${m.role.charAt(0) + m.role.slice(1).toLowerCase()})` : '';
                                                  return (
                                                    <div key={uId} className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-muted-foreground truncate min-w-0" title={`${fullName}${roleLabel}`}>
                                                      <Avatar className="h-3.5 w-3.5 shrink-0">
                                                        <AvatarImage src={m.user?.avatarUrl} />
                                                        <AvatarFallback className="text-[7px] bg-primary/10 text-primary font-bold">
                                                          {initials(fullName)}
                                                        </AvatarFallback>
                                                      </Avatar>
                                                      <span className="truncate min-w-0">{fullName}{roleLabel}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {displayDepartments.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No assigned classes found</div>}
                </div>
              )}
            </div>
          )}

          {/* Projects group */}
          {!isParent && (
            <div className="mt-4">
              <div className="flex items-center gap-1 px-2 py-1">
                <button onClick={() => setOpenGroups({ ...openGroups, projects: !openGroups.projects })} className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground tracking-wide hover:text-foreground">
                  {openGroups.projects ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>Projects</span>
                </button>
                {isManagerPlus && (
                  <button
                    onClick={() => navigate('/app/admin?tab=projects')}
                    className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-all shrink-0 ml-1"
                    title="Manage Projects"
                    data-testid="new-project-btn"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {openGroups.projects && (
                <div className="mt-1 space-y-0.5">
                  {loadingProjects ? (
                    <div className="space-y-1.5 px-2 py-1">
                      <div className="h-4 w-3/4 rounded bg-muted/30 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      {projects.map((p) => {
                        const isSelected = location.pathname === `/app/projects/${p.id}`;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              navigate(`/app/projects/${p.id}`);
                              onNavigate?.();
                            }}
                            className={`w-full flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors ${
                              isSelected
                                ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                                : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                            data-testid={`project-item-${p.name}`}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <FolderGit2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{p.name}</span>
                            </div>
                          </button>
                        );
                      })}
                      {projects.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No assigned projects</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Channels group */}
          <div className="mt-4">
            <div className="flex items-center gap-1 px-2 py-1">
              <button onClick={() => setOpenGroups({ ...openGroups, channels: !openGroups.channels })} className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground tracking-wide hover:text-foreground">
                {openGroups.channels ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>Announcements & Channels</span>
              </button>
              {!isParent && (
                <button
                  onClick={() => { refreshOrgData(); setNewCh({ open: true, name: '', type: 'PUBLIC', memberIds: [] }); }}
                  className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-all shrink-0 ml-1"
                  title="Create Channel"
                  data-testid="new-channel-btn"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {openGroups.channels && (
              <div className="mt-1 space-y-0.5">
                {loadingChannels ? (
                  <div className="space-y-1.5 px-2 py-1">
                    <div className="h-4 w-3/4 rounded bg-muted/30 animate-pulse" />
                    <div className="h-4 w-1/2 rounded bg-muted/30 animate-pulse" />
                  </div>
                ) : (
                  <>
                    {standardChannels.map((c) => {
                      const hasUnread = (c.unreadCount || 0) > 0;
                      const isSelected = currentChannelId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelectChannel(c.id)}
                          className={`w-full flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors ${
                            isSelected
                              ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                              : hasUnread
                              ? 'font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                              : 'text-[hsl(var(--sidebar-foreground))] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                          data-testid={`channel-item-${c.name}`}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            {c.type === 'PRIVATE' ? <Lock className="h-3.5 w-3.5 shrink-0" /> : c.type === 'ANNOUNCEMENT' ? <Volume2 className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{c.name}</span>
                          </div>
                          {hasUnread && (
                            <Badge variant="default" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] flex items-center justify-center font-bold bg-primary text-primary-foreground rounded-full animate-in zoom-in-75 shrink-0">
                              {c.unreadCount > 99 ? '99+' : c.unreadCount}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                    {standardChannels.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No channels yet</div>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* DMs */}
          <div className="mt-4">
            <div className="flex items-center gap-1 px-2 py-1">
              <button onClick={() => setOpenGroups({ ...openGroups, dms: !openGroups.dms })} className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground tracking-wide hover:text-foreground">
                {openGroups.dms ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>Direct messages</span>
              </button>
              <button
                onClick={() => { refreshOrgData(); setNewDm({ open: true, targetUserId: '' }); }}
                className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-all shrink-0 ml-1"
                title="New Direct Message"
                data-testid="new-dm-btn"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {openGroups.dms && (
              <div className="mt-1 space-y-0.5">
                {loadingChannels ? (
                  <div className="space-y-1.5 px-2 py-1">
                    <div className="h-4 w-2/3 rounded bg-muted/30 animate-pulse" />
                  </div>
                ) : (
                  <>
                    {chDMs.map((c) => {
                      const dmUser = getDMUser(c);
                      const displayName = dmUser?.fullName || c.name;
                      const hasUnread = (c.unreadCount || 0) > 0;
                      const isSelected = currentChannelId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelectChannel(c.id)}
                          className={`w-full flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors ${
                            isSelected
                              ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active))] font-medium'
                              : hasUnread
                              ? 'font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[hsl(var(--sidebar-foreground))]'
                          }`}
                          data-testid={`dm-item-${c.id}`}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            <div className="relative flex items-center justify-center shrink-0">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={dmUser?.avatarUrl} />
                                <AvatarFallback className="text-[9px]">{initials(displayName)}</AvatarFallback>
                              </Avatar>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${dmUser?.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                            </div>
                            <span className="truncate">{displayName}</span>
                          </div>
                          {hasUnread && (
                            <Badge variant="default" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] flex items-center justify-center font-bold bg-primary text-primary-foreground rounded-full animate-in zoom-in-75 shrink-0">
                              {c.unreadCount > 99 ? '99+' : c.unreadCount}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                    {chDMs.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No direct messages</div>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* User footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 flex-1 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5" data-testid="user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(user?.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium truncate">{user?.fullName}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => go('/app/profile')}><UserIcon className="h-4 w-4 mr-2" /> Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>{theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="h-4 w-4 mr-2" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle" className="h-8 w-8">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* New Channel Dialog */}
      <Dialog open={newCh.open} onOpenChange={(o) => setNewCh({ ...newCh, open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create channel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newCh.name} onChange={(e) => setNewCh({ ...newCh, name: e.target.value })} placeholder="design-team" data-testid="new-channel-name" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newCh.type} onValueChange={(v) => setNewCh({ ...newCh, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                  <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newCh.type === 'PRIVATE' && (
              <div>
                <Label>Add Members</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 mt-1 border rounded-md p-1">
                  {orgMembers
                    .filter((m) => m.userId !== user?.id)
                    .map((m) => {
                      const isSelected = (newCh.memberIds || []).includes(m.userId);
                      return (
                        <button
                          key={m.userId || m.id}
                          type="button"
                          onClick={() => {
                            const current = newCh.memberIds || [];
                            const updated = isSelected
                              ? current.filter((id) => id !== m.userId)
                              : [...current, m.userId];
                            setNewCh({ ...newCh, memberIds: updated });
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors ${
                            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
                          }`}
                          data-testid={`select-channel-member-${m.userId}`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={m.user?.avatarUrl} />
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(m.user?.fullName)}</AvatarFallback>
                            </Avatar>
                            <span>{m.user?.fullName || m.user?.email}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  {orgMembers.filter((m) => m.userId !== user?.id).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No other members in workspace</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCh({ ...newCh, open: false })}>Cancel</Button>
            <Button onClick={createChannel} disabled={!newCh.name} data-testid="create-channel-submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New DM Dialog */}
      <Dialog open={newDm.open} onOpenChange={(o) => setNewDm({ ...newDm, open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Direct Message</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Select a team member</Label>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border rounded-md p-1">
              {orgMembers
                .filter((m) => m.userId !== user?.id)
                .map((m) => (
                  <button
                    key={m.userId || m.id}
                    type="button"
                    onClick={() => startDM(m.userId)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm hover:bg-accent transition-colors group"
                    data-testid={`select-user-${m.userId}`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.user?.avatarUrl} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(m.user?.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{m.user?.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.user?.email}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                  </button>
                ))}
              {orgMembers.filter((m) => m.userId !== user?.id).length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">No other members in this workspace</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDm({ ...newDm, open: false })}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Org Dialog */}
      <Dialog open={newOrg.open} onOpenChange={(o) => setNewOrg({ ...newOrg, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create organization</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Name</Label>
            <Input value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} placeholder="My Organization" data-testid="new-org-name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrg({ ...newOrg, open: false })}>Cancel</Button>
            <Button onClick={createOrg} disabled={!newOrg.name} data-testid="create-org-submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

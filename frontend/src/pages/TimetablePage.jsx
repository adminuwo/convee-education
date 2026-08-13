import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/contexts/OrgDataContext';
import { timetableApi } from '@/lib/api';
import {
  Calendar,
  Clock,
  UserCheck,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserPlus,
  RefreshCw,
  BookOpen,
  Pencil,
  Trash2,
  Edit2,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function TimetablePage() {
  const { currentOrg, user, memberships } = useAuth();
  const { departments, members } = useOrgData();

  const [activeTab, setActiveTab] = useState('grid');
  const [loading, setLoading] = useState(true);

  // Get today's day of week & formatted date
  const todayInfo = useMemo(() => {
    const now = new Date();
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDayName = days[now.getDay()];
    // If today is Sunday (no scheduled classes), default to MONDAY for viewing
    const defaultDay = currentDayName === 'SUNDAY' ? 'MONDAY' : currentDayName;
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return { currentDayName, defaultDay, formattedDate };
  }, []);

  // Filters - automatically open today's schedule session
  const [selectedDay, setSelectedDay] = useState(todayInfo.defaultDay);
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [selectedClassName, setSelectedClassName] = useState('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState(1);

  // Helper to compute exact date for any day of the current week
  const getWeekDateForDay = useCallback((dayName) => {
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayMap = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
    const targetDayIndex = dayMap[dayName] !== undefined ? dayMap[dayName] : 1;

    const diff = targetDayIndex - currentDayIndex;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);

    return {
      formattedDate: targetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      shortDate: targetDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      isPast: diff < 0,
      isToday: diff === 0,
      isFuture: diff > 0,
    };
  }, []);

  const selectedDayInfo = useMemo(() => getWeekDateForDay(selectedDay), [selectedDay, getWeekDateForDay]);

  // Sunday Refresh: Auto reset to Monday for upcoming week on Sunday
  useEffect(() => {
    const now = new Date();
    if (now.getDay() === 0) {
      setSelectedDay('MONDAY');
    }
  }, []);

  // Data
  const [slots, setSlots] = useState([]);
  const [freeTeachers, setFreeTeachers] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [unassignedSlots, setUnassignedSlots] = useState([]);

  // Modals
  const [showReportAbsenceModal, setShowReportAbsenceModal] = useState(false);
  const [showAssignProxyModal, setShowAssignProxyModal] = useState(false);
  const [showAddEditSlotModal, setShowAddEditSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotConflictError, setSlotConflictError] = useState(null);
  const [selectedSlotForProxy, setSelectedSlotForProxy] = useState(null);
  const [slotFreeTeachers, setSlotFreeTeachers] = useState([]);
  const [loadingProxyTeachers, setLoadingProxyTeachers] = useState(false);

  // Form states
  const [slotForm, setSlotForm] = useState({
    className: 'Grade 10 - Sec A',
    dayOfWeek: 'MONDAY',
    periodNumber: 1,
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    subjectName: '',
    roomNumber: 'Room 101',
    primaryTeacherName: '',
  });

  // Form states
  // Date defaults to today in YYYY-MM-DD format (for date input)
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [newAbsence, setNewAbsence] = useState({
    teacherName: '',
    reason: 'Medical Leave',
    date: todayDateStr,
  });

  const [proxyForm, setProxyForm] = useState({
    substituteTeacherName: '',
    notes: '',
  });

  const role = currentOrg?.role || 'STUDENT';
  const roleUpper = (role || '').toUpperCase();
  const isTopManagement = ['PRINCIPAL', 'DIRECTOR', 'ADMIN', 'OWNER'].some((r) => roleUpper.includes(r));
  const isDeptLeader = ['HOD', 'DEAN'].some((r) => roleUpper.includes(r)) && !isTopManagement;
  const isManagement = isTopManagement || isDeptLeader;
  const isTeacher = !isManagement && roleUpper !== 'STUDENT' && roleUpper !== 'PARENT';
  const isStudent = roleUpper === 'STUDENT';
  const currentUserName = user?.fullName || user?.name || currentOrg?.memberName || '';

  // Derive user's department ID from active membership
  const activeMembership = useMemo(() => {
    if (!memberships || !currentOrg?.id) return null;
    return memberships.find((m) => m.orgId === currentOrg?.id);
  }, [memberships, currentOrg?.id]);

  // Derive user's assigned department ID for HOD / Dean
  const userDeptId = useMemo(() => {
    if (activeMembership?.departmentId) return activeMembership.departmentId;
    if (activeMembership?.department?.id) return activeMembership.department.id;
    const leadDept = departments.find((d) => d.headId === user?.id || d.head?.id === user?.id);
    if (leadDept) return leadDept.id;
    return '';
  }, [activeMembership, departments, user?.id]);

  // Derive student's class section
  const studentClassName = useMemo(() => {
    if (!isStudent) return '';
    const teamName = activeMembership?.team?.name;
    if (teamName) return teamName;
    const title = activeMembership?.title || '';
    const match = title.match(/(Grade \d+\s*(?:-\s*Sec\s*[A-Z])?|Playgroup|Nursery|LKG|UKG|Class \d+\s*(?:Sec\s*[A-Z])?)/i);
    if (match) return match[1].replace(/-/g, ' - ');
    return 'Grade 10 - Sec A'; // Fallback demo class for Alex Rivera
  }, [isStudent, activeMembership]);

  useEffect(() => {
    if (isStudent && studentClassName) {
      setSelectedClassName(studentClassName);
    }
  }, [isStudent, studentClassName]);

  useEffect(() => {
    if (isDeptLeader && userDeptId) {
      setSelectedDeptId(userDeptId);
    }
  }, [isDeptLeader, userDeptId]);

  // Filter slots based on role:
  // - Students: see ONLY their assigned class section (e.g. Grade 10 - Sec A)
  // - Regular Teachers: see ONLY periods where they are primary teacher or proxy
  // - HOD / Dean: see ONLY classes in their assigned department
  // - Principal / Director / Admin: see all slots with department & class filters
  const displayedSlots = useMemo(() => {
    if (isStudent && studentClassName) {
      const sNameLower = studentClassName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return slots.filter((s) => {
        const slotClassLower = (s.className || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return slotClassLower.includes(sNameLower) || sNameLower.includes(slotClassLower);
      });
    }
    if (isTeacher && currentUserName) {
      const nameLower = currentUserName.toLowerCase();
      return slots.filter((s) => {
        const matchesPrimary = s.primaryTeacherName && (
          s.primaryTeacherName.toLowerCase().includes(nameLower) ||
          nameLower.includes(s.primaryTeacherName.toLowerCase())
        );
        const matchesProxy = s.proxyInfo?.substituteTeacherName && (
          s.proxyInfo.substituteTeacherName.toLowerCase().includes(nameLower) ||
          nameLower.includes(s.proxyInfo.substituteTeacherName.toLowerCase())
        );
        return matchesPrimary || matchesProxy;
      });
    }
    if (isDeptLeader && userDeptId) {
      return slots.filter((s) => s.departmentId === userDeptId || s.department?.id === userDeptId);
    }
    return slots;
  }, [slots, isStudent, studentClassName, isTeacher, currentUserName, isDeptLeader, userDeptId]);

  // Scoped faculty list based on role & department permissions:
  // - Principal/Director/Admin/Owner: see EVERYONE in the organization assigned as a teacher
  // - Dean/HOD: see EVERYONE assigned in THEIR department as a teacher
  const scopedFacultyList = useMemo(() => {
    const roleUpper = (role || '').toUpperCase();
    const isTopAdmin = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER'].some((r) => roleUpper.includes(r));
    const isDeptLeader = ['DEAN', 'HOD'].some((r) => roleUpper.includes(r));

    // Get all organization staff/faculty members (excluding students & parents)
    let availableMembers = (members || []).filter((m) => {
      const r = (m.role || '').toUpperCase();
      return r !== 'STUDENT' && r !== 'PARENT';
    });

    // If DEAN or HOD, filter to members assigned to their department
    if (isDeptLeader && userDeptId) {
      const deptMembers = availableMembers.filter(
        (m) => m.departmentId === userDeptId || m.department?.id === userDeptId
      );
      if (deptMembers.length > 0) {
        availableMembers = deptMembers;
      }
    }

    const map = new Map();

    // Map members from orgApi.members
    availableMembers.forEach((m) => {
      const name = m.user?.fullName || m.user?.name || '';
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          name,
          email: m.user?.email || '',
          role: m.role || 'TEACHER',
          departmentId: m.departmentId || m.department?.id || '',
        });
      }
    });

    // Also include primary teachers from existing slots
    (slots || []).forEach((slot) => {
      if (slot.primaryTeacherName && !map.has(slot.primaryTeacherName.toLowerCase())) {
        if (isTopAdmin || !isDeptLeader || !userDeptId || slot.departmentId === userDeptId) {
          map.set(slot.primaryTeacherName.toLowerCase(), {
            name: slot.primaryTeacherName,
            email: '',
            role: 'TEACHER',
            departmentId: slot.departmentId || '',
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, role, userDeptId, slots]);

  // Scoped class list based on role & department permissions:
  // - Principal/Director/Admin/Owner/Accountant: see ALL departments & classes in the school
  // - Dean/HOD: see ALL classes in THEIR department/wing
  const scopedClassList = useMemo(() => {
    const roleUpper = (role || '').toUpperCase();
    const isTopAdmin = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER', 'ACCOUNTANT'].some((r) => roleUpper.includes(r));
    const isDeptLeader = ['DEAN', 'HOD'].some((r) => roleUpper.includes(r));

    let classItems = [];

    // Extract all teams/classes from departments
    (departments || []).forEach((dept) => {
      // If DEAN or HOD, filter to ONLY their department
      if (isDeptLeader && userDeptId && dept.id !== userDeptId) {
        return;
      }

      const deptTeams = (dept.teams || dept.classes || []).map((t) => ({
        id: t.id || t.name,
        name: t.name,
        deptName: dept.name || 'School Classes',
      }));

      classItems.push(...deptTeams);
    });

    // Extract unique class names from slots if any exist
    const slotClassNames = Array.from(new Set((slots || []).map((s) => s.className).filter(Boolean)));

    if (classItems.length === 0) {
      const fallbackClasses = Array.from(new Set([
        'Grade 10 - Sec A',
        'Grade 10 - Sec B',
        'Grade 11 - Science A',
        'Grade 11 - Commerce A',
        'Grade 12 - Science A',
        'Grade 6 - Sec A',
        'Grade 1 - Sec A',
        'Playgroup - Sec A',
        'Nursery - Sec A',
        ...slotClassNames,
      ]));

      classItems = fallbackClasses.map((c) => ({ id: c, name: c, deptName: 'General Classes' }));
    } else {
      // Ensure all classes currently present in slots are also available
      const existingNames = new Set(classItems.map((c) => c.name));
      slotClassNames.forEach((name) => {
        if (!existingNames.has(name)) {
          classItems.push({ id: name, name, deptName: 'Additional Classes' });
          existingNames.add(name);
        }
      });
    }

    return classItems;
  }, [role, userDeptId, departments, slots]);

  const fetchTimetableData = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes, absencesRes, freeRes] = await Promise.all([
        timetableApi.getSlots({
          dayOfWeek: selectedDay,
          departmentId: selectedDeptId,
          className: selectedClassName,
        }),
        timetableApi.getAbsences({ date: new Date().toISOString().slice(0, 10) }).catch(() => ({ absences: [], pendingProxySlots: [] })),
        timetableApi.getFreeTeachers({
          dayOfWeek: selectedDay,
          periodNumber: selectedPeriod,
          departmentId: selectedDeptId,
        }).catch(() => ({ freeTeachers: [] })),
      ]);

      setSlots(slotsRes.slots || []);
      setAbsences(absencesRes.absences || []);
      setUnassignedSlots(absencesRes.pendingProxySlots || []);
      setFreeTeachers(freeRes.freeTeachers || []);
    } catch (err) {
      console.error('Error fetching timetable data:', err);
      toast.error('Failed to load timetable and substitute data');
    } finally {
      setLoading(false);
    }
  }, [selectedDay, selectedDeptId, selectedClassName, selectedPeriod]);

  useEffect(() => {
    fetchTimetableData();
  }, [fetchTimetableData]);

  const handleReportAbsence = async (e) => {
    e.preventDefault();
    try {
      await timetableApi.reportAbsence(newAbsence);
      toast.success(`Absence reported for ${newAbsence.teacherName}`);
      setShowReportAbsenceModal(false);
      setNewAbsence({ teacherName: '', reason: 'Medical Leave', date: new Date().toISOString().slice(0, 10) });
      fetchTimetableData();
    } catch (err) {
      toast.error('Failed to report absence');
    }
  };

  const handleAssignProxy = async (e) => {
    e.preventDefault();
    if (!selectedSlotForProxy || !proxyForm.substituteTeacherName) {
      toast.error('Please select a substitute teacher');
      return;
    }
    try {
      const res = await timetableApi.assignProxy({
        slotId: selectedSlotForProxy.id,
        substituteTeacherName: proxyForm.substituteTeacherName,
        assignedByRole: role,
        notes: proxyForm.notes,
      });

      toast.success(res.message || 'Proxy teacher assigned successfully!');
      setShowAssignProxyModal(false);
      setSelectedSlotForProxy(null);
      setSlotFreeTeachers([]);
      setProxyForm({ substituteTeacherName: '', notes: '' });
      fetchTimetableData();
    } catch (err) {
      toast.error('Failed to assign proxy teacher');
    }
  };

  // Opens the assign proxy modal and fetches free teachers for that specific slot's period
  const handleOpenAssignProxy = async (slot) => {
    setSelectedSlotForProxy(slot);
    setProxyForm({ substituteTeacherName: '', notes: '' });
    setLoadingProxyTeachers(true);
    setShowAssignProxyModal(true);
    try {
      const res = await timetableApi.getFreeTeachers({
        dayOfWeek: selectedDay,
        periodNumber: slot.periodNumber,
        departmentId: selectedDeptId,
      });
      setSlotFreeTeachers(res.freeTeachers || []);
    } catch {
      setSlotFreeTeachers([]);
    } finally {
      setLoadingProxyTeachers(false);
    }
  };

  const handleOpenAddSlot = () => {
    setEditingSlot(null);
    setSlotForm({
      className: selectedClassName !== 'ALL' ? selectedClassName : (scopedClassList[0]?.name || 'Grade 10 - Sec A'),
      dayOfWeek: selectedDay || 'MONDAY',
      periodNumber: 1,
      startTime: '09:00 AM',
      endTime: '09:45 AM',
      subjectName: '',
      roomNumber: 'Room 101',
      primaryTeacherName: scopedFacultyList[0]?.name || '',
    });
    setShowAddEditSlotModal(true);
  };

  const handleOpenEditSlot = (s) => {
    setEditingSlot(s);
    setSlotForm({
      className: s.className || 'Grade 10 - Sec A',
      dayOfWeek: s.dayOfWeek || selectedDay || 'MONDAY',
      periodNumber: s.periodNumber || 1,
      startTime: s.startTime || '09:00 AM',
      endTime: s.endTime || '09:45 AM',
      subjectName: s.subjectName || '',
      roomNumber: s.roomNumber || 'Room 101',
      primaryTeacherName: s.primaryTeacherName || '',
    });
    setShowAddEditSlotModal(true);
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!slotForm.className || !slotForm.subjectName || !slotForm.primaryTeacherName) {
      return toast.error('Class, subject, and primary teacher are required');
    }
    setSlotConflictError(null);
    try {
      await timetableApi.createSlot({
        ...(editingSlot ? { id: editingSlot.id } : {}),
        ...slotForm,
      });
      toast.success(editingSlot ? 'Timetable slot updated! 📅' : 'New timetable slot added! 📅');
      setShowAddEditSlotModal(false);
      setSlotConflictError(null);
      fetchTimetableData();
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.error) {
        // Show inline conflict error in the form
        setSlotConflictError({
          type: data.conflictType,
          message: data.message,
          existing: data.existingSlot,
        });
      } else {
        toast.error('Failed to save timetable slot');
      }
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to delete this timetable slot?')) return;
    try {
      await timetableApi.deleteSlot(slotId);
      toast.success('Timetable slot deleted');
      fetchTimetableData();
    } catch (err) {
      toast.error('Failed to delete timetable slot');
    }
  };

  // Group slots by period number
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

  const uniqueClasses = Array.from(new Set(slots.map((s) => s.className)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Smart Timetable & Substitute Hub</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> {role}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              <span className="text-indigo-300 font-medium">{todayInfo.formattedDate}</span> • Live Class Timetable • 1-Click Proxy Substitution Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isManagement && (
            <>
              <button
                onClick={handleOpenAddSlot}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Timetable Slot
              </button>
              <button
                onClick={() => {
                  setNewAbsence({ teacherName: '', reason: 'Medical Leave' });
                  setShowReportAbsenceModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium rounded-xl text-sm transition-all"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Mark Teacher Leave
              </button>
            </>
          )}

          {isTeacher && (
            <button
              onClick={() => {
                setNewAbsence({ teacherName: currentUserName, reason: 'Medical Leave' });
                setShowReportAbsenceModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm transition-all shadow-md"
            >
              <AlertTriangle className="w-4 h-4 text-white" /> Mark Myself On Leave
            </button>
          )}
          <button
            onClick={fetchTimetableData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl text-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>ACTIVE DAY SESSION</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white mt-2 flex items-center gap-2">
            <span>{selectedDay}</span>
            {selectedDayInfo.isToday ? (
              <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-semibold">
                TODAY
              </span>
            ) : selectedDayInfo.isPast ? (
              <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-400 border border-slate-700 rounded-full font-semibold">
                PAST SESSION
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full font-semibold">
                UPCOMING
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1">{selectedDayInfo.formattedDate}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{displayedSlots.length} Classes Scheduled</div>
        </div>

        {isStudent ? (
          <>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>MY CLASS SECTION</span>
                <GraduationCap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 mt-2">{studentClassName || 'Grade 10 - Sec A'}</div>
              <div className="text-xs text-slate-500 mt-1">High School Academic Wing</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>DAILY PERIODS</span>
                <BookOpen className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-sky-400 mt-2">{displayedSlots.length}</div>
              <div className="text-xs text-slate-500 mt-1">Scheduled Subject Classes</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>TEACHER PROXIES</span>
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-indigo-400 mt-2">
                {displayedSlots.filter((s) => s.proxyInfo?.isProxyAssigned).length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Proxy Substitutes Assigned</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>{selectedDayInfo.isPast ? `TEACHERS ON LEAVE (${selectedDayInfo.shortDate})` : 'TEACHERS ON LEAVE TODAY'}</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-2">{absences.length}</div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedDayInfo.isPast ? `Reported leave on ${selectedDayInfo.shortDate}` : 'Reported leave of absence'}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>UNASSIGNED PROXY SLOTS</span>
                <UserPlus className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-2">
                {unassignedSlots.filter((s) => !s.isAssigned).length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Requiring HOD/Principal substitute</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>FREE FACULTY (PERIOD {selectedPeriod})</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">{freeTeachers.length}</div>
              <div className="text-xs text-slate-500 mt-1">Available for proxy assignment</div>
            </div>
          </>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Day Selector Buttons */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                  selectedDay === d ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{d.slice(0, 3)}</span>
                {d === todayInfo.currentDayName && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" title="Today" />
                )}
              </button>
            ))}
          </div>

          {/* Department Filter */}
          {!isStudent && (
            <select
              value={selectedDeptId}
              onChange={(e) => !isDeptLeader && setSelectedDeptId(e.target.value)}
              disabled={isDeptLeader}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none disabled:opacity-75"
            >
              {!isDeptLeader && <option value="ALL">All Departments</option>}
              {departments
                .filter((dept) => !isDeptLeader || dept.id === userDeptId)
                .map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
            </select>
          )}

          {/* Class Filter */}
          <select
            value={isStudent ? (studentClassName || 'Grade 10 - Sec A') : selectedClassName}
            onChange={(e) => !isStudent && setSelectedClassName(e.target.value)}
            disabled={isStudent}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none disabled:opacity-75"
          >
            {isStudent ? (
              <option value={studentClassName || 'Grade 10 - Sec A'}>{studentClassName || 'Grade 10 - Sec A'}</option>
            ) : (
              <>
                <option value="ALL">All Class Sections</option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Timetable Grid
          </button>
          {isManagement && (
            <>
              <button
                onClick={() => setActiveTab('free')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'free' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Free Teachers Grid ({freeTeachers.length})
              </button>
              <button
                onClick={() => setActiveTab('absences')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'absences' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Substitute Oversight ({unassignedSlots.filter((s) => !s.isAssigned).length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: TIMETABLE GRID */}
      {activeTab === 'grid' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> {selectedDay} Schedule Grid
            </h3>
            <span className="text-xs text-slate-400">Showing {displayedSlots.length} period slots</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3.5">Period & Time</th>
                  <th className="p-3.5">Class / Section</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Classroom</th>
                  <th className="p-3.5">Primary Teacher</th>
                  <th className="p-3.5">Substitute / Proxy Status</th>
                  {isManagement && <th className="p-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {displayedSlots.length === 0 ? (
                  <tr>
                    <td colSpan={isManagement ? 7 : 6} className="p-6 text-center text-slate-500">
                      {isTeacher
                        ? 'No scheduled classes assigned to you for the selected filters.'
                        : 'No timetable slots configured for the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  displayedSlots.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-850 transition-all">
                      <td className="p-3.5 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-md">
                            P{s.periodNumber}
                          </span>
                          <span className="text-xs text-slate-400">{s.startTime} - {s.endTime}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-200">{s.className}</td>
                      <td className="p-3.5 text-indigo-300 font-medium">{s.subjectName}</td>
                      <td className="p-3.5 text-slate-400 font-mono text-xs">{s.roomNumber || 'Room 101'}</td>
                      <td className="p-3.5 text-slate-200 font-medium">{s.primaryTeacherName}</td>
                      <td className="p-3.5">
                        {s.isProxyAssigned ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Proxy: {s.proxyInfo?.substituteTeacherName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">({s.proxyInfo?.assignedByRole})</span>
                          </div>
                        ) : absences.some((a) => a.teacherName === s.primaryTeacherName) ? (
                          <div className="flex items-center gap-2">
                            {selectedDayInfo.isPast ? (
                              <span className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Teacher Was Absent
                              </span>
                            ) : (
                              <>
                                <span className="px-2.5 py-1 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Teacher Absent
                                </span>
                                {isManagement && (
                                  <button
                                    onClick={() => handleOpenAssignProxy(s)}
                                    className="px-2 py-0.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium shadow-sm"
                                  >
                                    Assign Proxy
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Regular Class</span>
                        )}
                      </td>
                      {isManagement && (
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditSlot(s)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg transition-all"
                              title="Edit Timetable Slot"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(s.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-all"
                              title="Delete Timetable Slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FREE TEACHERS GRID */}
      {activeTab === 'free' && isManagement && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Available Free Teachers ({selectedDay})
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Faculty members who have no assigned teaching period during Period {selectedPeriod}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Select Period:</span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {periods.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedPeriod === p ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
            {freeTeachers.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500 text-sm">
                No free teachers available during Period {selectedPeriod}.
              </div>
            ) : (
              freeTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{teacher.name}</div>
                      <div className="text-xs text-slate-400">{teacher.departmentName}</div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                      {teacher.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Free for P{selectedPeriod}
                    </span>
                    <button
                      onClick={() => {
                        // Pre-fill teacher name and open modal (free teachers already loaded for selectedPeriod)
                        setProxyForm((prev) => ({ ...prev, substituteTeacherName: teacher.name }));
                        setSlotFreeTeachers(freeTeachers);
                        setShowAssignProxyModal(true);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" /> Assign
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ABSENT TEACHERS & SUBSTITUTE OVERSIGHT */}
      {activeTab === 'absences' && isManagement && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" /> Substitute Oversight & Unassigned Periods
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                HOD, Dean, and Principal 1-click proxy teacher assignment
              </p>
            </div>
            <button
              onClick={() => setShowReportAbsenceModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Report Teacher Leave
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-300">Unassigned Period Slots Requiring Substitute ({unassignedSlots.filter((s) => !s.isAssigned).length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unassignedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    slot.isAssigned
                      ? 'bg-slate-950 border-emerald-500/30'
                      : 'bg-slate-950 border-rose-500/40 shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-md">
                          Period {slot.periodNumber}
                        </span>
                        <span className="text-sm font-bold text-white">{slot.className}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Subject: <span className="text-indigo-300 font-medium">{slot.subjectName}</span> • {slot.roomNumber}
                      </div>
                    </div>
                    {slot.isAssigned ? (
                      <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                        Proxy Assigned
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full">
                        Action Required
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                    <span className="text-slate-400">
                      Absent Teacher: <strong className="text-rose-400">{slot.primaryTeacherName}</strong>
                    </span>
                    {!slot.isAssigned ? (
                      <button
                        onClick={() => handleOpenAssignProxy(slot)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Assign Proxy
                      </button>
                    ) : (
                      <span className="text-emerald-400 font-medium text-xs">
                        Covered by {slot.proxyAssignment?.substituteTeacherName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Report Teacher Absence */}
      <Dialog open={showReportAbsenceModal} onOpenChange={setShowReportAbsenceModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <AlertTriangle className="w-5 h-5 text-rose-400" /> Report Teacher Leave
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReportAbsence} className="space-y-3">
            <div>
              <div className="flex items-center justify-between pb-1">
                <label className="text-xs font-medium text-slate-300">Select Faculty / Teacher</label>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'OWNER'].some(r => (role || '').toUpperCase().includes(r)) ? 'All Organization Faculty' : 'Department Faculty'}
                </span>
              </div>
              <select
                required
                value={newAbsence.teacherName}
                onChange={(e) => setNewAbsence({ ...newAbsence, teacherName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">-- Select Teacher from list --</option>
                {scopedFacultyList.map((f, idx) => (
                  <option key={idx} value={f.name}>
                    {f.name} ({f.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Date of Absence */}
            <div>
              <div className="flex items-center justify-between pb-1">
                <label className="text-xs font-medium text-slate-300">Date of Absence</label>
                {newAbsence.date && (() => {
                  const d = new Date(newAbsence.date + 'T00:00:00');
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                  const today = new Date().toISOString().slice(0, 10);
                  const isToday = newAbsence.date === today;
                  return (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isToday
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    }`}>
                      {isToday ? '✓ Today' : dayName}
                    </span>
                  );
                })()}
              </div>
              <input
                type="date"
                required
                value={newAbsence.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setNewAbsence({ ...newAbsence, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">Absence will be marked on the timetable for this date only.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Reason for Leave</label>
              <select
                value={newAbsence.reason}
                onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="Medical Leave">Medical Leave</option>
                <option value="Casual Leave">Casual Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
                <option value="Official Duty">Official Duty</option>
                <option value="Personal Leave">Personal Leave</option>
              </select>
            </div>
            <DialogFooter className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowReportAbsenceModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-xl"
              >
                Submit Absence
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Assign Proxy Teacher */}
      <Dialog open={showAssignProxyModal} onOpenChange={setShowAssignProxyModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <UserPlus className="w-5 h-5 text-indigo-400" /> Assign Substitute Teacher
            </DialogTitle>
          </DialogHeader>
          {selectedSlotForProxy && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>Class: <strong className="text-white">{selectedSlotForProxy.className}</strong></div>
              <div>Subject: <strong className="text-indigo-300">{selectedSlotForProxy.subjectName}</strong> (Period {selectedSlotForProxy.periodNumber})</div>
              <div>Absent Teacher: <strong className="text-rose-400">{selectedSlotForProxy.primaryTeacherName}</strong></div>
            </div>
          )}
          <form onSubmit={handleAssignProxy} className="space-y-3">
            <div>
              <div className="flex items-center justify-between pb-1">
                <label className="text-xs font-medium text-slate-300">Select Substitute Teacher</label>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Free for Period {selectedSlotForProxy?.periodNumber}
                </span>
              </div>
              {loadingProxyTeachers ? (
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Loading available teachers...
                </div>
              ) : slotFreeTeachers.length === 0 ? (
                <div className="w-full bg-slate-950 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  No teachers are free during this period. All faculty are assigned.
                </div>
              ) : (
                <select
                  required
                  value={proxyForm.substituteTeacherName}
                  onChange={(e) => setProxyForm({ ...proxyForm, substituteTeacherName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">-- Select from {slotFreeTeachers.length} available teacher{slotFreeTeachers.length !== 1 ? 's' : ''} --</option>
                  {slotFreeTeachers.map((t, idx) => (
                    <option key={idx} value={t.name}>
                      {t.name} ({t.role}) — Free P{selectedSlotForProxy?.periodNumber}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300">Notes for Proxy Teacher</label>
              <input
                type="text"
                placeholder="e.g. Conduct Chapter 4 revision"
                value={proxyForm.notes}
                onChange={(e) => setProxyForm({ ...proxyForm, notes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
              />
            </div>
            <DialogFooter className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAssignProxyModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
              >
                Assign Substitute
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADD / EDIT TIMETABLE SLOT */}
      <Dialog open={showAddEditSlotModal} onOpenChange={(open) => { setShowAddEditSlotModal(open); if (!open) setSlotConflictError(null); }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5 text-indigo-400" />
              {editingSlot ? 'Edit Timetable Slot' : 'Add New Timetable Slot'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSlot} className="space-y-4 py-2">
            {/* Conflict Error Banner */}
            {slotConflictError && (
              <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {slotConflictError.type === 'CLASS_PERIOD' ? '⛔ Period Already Occupied' : '⛔ Teacher Already Scheduled'}
                </div>
                <p className="text-xs text-rose-300 leading-relaxed">{slotConflictError.message}</p>
                {slotConflictError.existing && (
                  <div className="bg-slate-900 rounded-lg p-2 mt-1 text-[11px] text-slate-400 space-y-0.5">
                    <div>📚 <span className="text-slate-200">{slotConflictError.existing.subjectName}</span> — {slotConflictError.existing.className}</div>
                    <div>👤 <span className="text-slate-200">{slotConflictError.existing.primaryTeacherName}</span></div>
                    <div>🕐 {slotConflictError.existing.startTime} – {slotConflictError.existing.endTime}</div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Class / Section</label>
                <select
                  required
                  value={slotForm.className}
                  onChange={(e) => setSlotForm({ ...slotForm, className: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Class / Section...</option>
                  {Object.entries(
                    scopedClassList.reduce((acc, c) => {
                      const group = c.deptName || 'School Classes';
                      if (!acc[group]) acc[group] = [];
                      acc[group].push(c);
                      return acc;
                    }, {})
                  ).map(([deptGroup, classes]) => (
                    <optgroup key={deptGroup} label={deptGroup}>
                      {classes.map((c, idx) => (
                        <option key={`${c.id}-${idx}`} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Day of Week</label>
                <select
                  value={slotForm.dayOfWeek}
                  onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                >
                  {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Period No.</label>
                <select
                  value={slotForm.periodNumber}
                  onChange={(e) => setSlotForm({ ...slotForm, periodNumber: parseInt(e.target.value, 10) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Start Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 09:00 AM"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">End Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 09:45 AM"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics"
                  value={slotForm.subjectName}
                  onChange={(e) => setSlotForm({ ...slotForm, subjectName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Classroom / Lab</label>
                <input
                  type="text"
                  placeholder="e.g. Room 101"
                  value={slotForm.roomNumber}
                  onChange={(e) => setSlotForm({ ...slotForm, roomNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Primary Assigned Teacher</label>
              <select
                required
                value={slotForm.primaryTeacherName}
                onChange={(e) => setSlotForm({ ...slotForm, primaryTeacherName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200"
              >
                <option value="">Select Primary Teacher...</option>
                {scopedFacultyList.map((f, idx) => (
                  <option key={`fac-${idx}`} value={f.name}>
                    {f.name} ({f.role})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddEditSlotModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
              >
                {editingSlot ? 'Update Slot' : 'Create Slot'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

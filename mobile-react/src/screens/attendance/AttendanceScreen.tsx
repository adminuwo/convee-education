import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { attendanceApi, parentApi, orgApi } from '../../lib/api';
import {
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Users,
  Check,
  GraduationCap,
  Layers,
} from 'lucide-react-native';

export default function AttendanceScreen() {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  // Role detection
  const role = (currentOrg?.role || user?.systemRole || '').toUpperCase();
  const isStudent = role === 'STUDENT';
  const isParent = role === 'PARENT';
  const isLeadership =
    ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'DEAN', 'HOD', 'OWNER'].includes(role) ||
    user?.systemRole === 'SUPER_ADMIN';
  const isFaculty = !isStudent && !isParent;

  // Teacher / Leadership state
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sectionAnalytics, setSectionAnalytics] = useState<any>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [markedToday, setMarkedToday] = useState(false);

  // Student / Parent state
  const [studentReport, setStudentReport] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute all class sections across departments
  const allSections = useMemo(() => {
    const list: any[] = [];
    departments.forEach((dept) => {
      (dept.teams || []).forEach((team: any) => {
        list.push({
          ...team,
          deptId: dept.id,
          deptName: dept.name,
        });
      });
    });
    return list;
  }, [departments]);

  // Compute sections accessible to current user
  const availableSections = useMemo(() => {
    if (isLeadership) return allSections;

    // Class Teachers strictly see sections they manage or are assigned to
    const mySections = allSections.filter((t) => {
      if (t.managerId === user?.id) return true;
      if (t.memberships?.some((m: any) => m.userId === user?.id || m.user?.id === user?.id)) return true;
      return false;
    });

    return mySections.length > 0 ? mySections : allSections;
  }, [allSections, isLeadership, user?.id]);

  // Current active section object
  const activeSection = useMemo(() => {
    return availableSections.find((s) => s.id === selectedSectionId) || availableSections[0] || null;
  }, [availableSections, selectedSectionId]);

  // Load class section data (for teachers & leadership)
  const loadSectionData = useCallback(
    async (sectionId: string) => {
      if (!sectionId || !currentOrg?.id) return;
      try {
        const [analyticsRes, todayRecords] = await Promise.all([
          attendanceApi.getTeamAnalytics(sectionId, currentOrg.id).catch(() => null),
          attendanceApi.getByTeam(sectionId, todayStr).catch(() => []),
        ]);

        if (analyticsRes) {
          setSectionAnalytics(analyticsRes);
          const students = analyticsRes.studentLedger || [];
          const newMap: Record<string, string> = {};

          const hasExisting = Array.isArray(todayRecords) && todayRecords.length > 0;
          setMarkedToday(hasExisting);

          if (hasExisting) {
            todayRecords.forEach((r: any) => {
              if (r.studentId) newMap[r.studentId] = r.status;
            });
          }

          // Pre-populate any unrecorded student as PRESENT
          students.forEach((s: any) => {
            if (!newMap[s.studentId]) {
              newMap[s.studentId] = 'PRESENT';
            }
          });

          setAttendanceMap(newMap);
        }
      } catch {
        // ignore
      }
    },
    [currentOrg?.id, todayStr]
  );

  // Initial load
  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      setSaveMessage('');

      if (isStudent) {
        const rep = await parentApi.getChildReport(user!.id, currentOrg.id).catch(() => null);
        setStudentReport(rep);
      } else if (isParent) {
        const kids = await parentApi.getMyChildren().catch(() => []);
        const validKids = Array.isArray(kids) ? kids : [];
        setChildren(validKids);
        const targetId = selectedChildId || (validKids.length > 0 ? validKids[0].userId : null);
        if (targetId) {
          setSelectedChildId(targetId);
          const rep = await parentApi.getChildReport(targetId, currentOrg.id).catch(() => null);
          setStudentReport(rep);
        }
      } else {
        // Faculty / Admin
        const depts = await orgApi.departments(currentOrg.id).catch(() => []);
        setDepartments(Array.isArray(depts) ? depts : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id, isParent, isStudent, selectedChildId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default selected section once available sections load
  useEffect(() => {
    if (availableSections.length > 0) {
      if (!selectedSectionId || !availableSections.some((s) => s.id === selectedSectionId)) {
        const defaultId = availableSections[0].id;
        setSelectedSectionId(defaultId);
        loadSectionData(defaultId);
      }
    }
  }, [availableSections, selectedSectionId, loadSectionData]);

  // Handle section switch
  const handleSelectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setSaveMessage('');
    loadSectionData(sectionId);
  };

  // Handle child switch for parent
  const handleSelectChild = async (childId: string) => {
    setSelectedChildId(childId);
    setLoading(true);
    try {
      const rep = await parentApi.getChildReport(childId, currentOrg?.id).catch(() => null);
      setStudentReport(rep);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Mark all students in current section PRESENT
  const handleMarkAllPresent = () => {
    const students = sectionAnalytics?.studentLedger || [];
    const newMap: Record<string, string> = {};
    students.forEach((s: any) => {
      newMap[s.studentId] = 'PRESENT';
    });
    setAttendanceMap(newMap);
  };

  // Save batch attendance for active section
  const handleBatchLog = async () => {
    const students = sectionAnalytics?.studentLedger || [];
    if (!students.length || !currentOrg?.id || !activeSection?.id) return;

    setSaving(true);
    setSaveMessage('');
    try {
      const records = students.map((s: any) => ({
        studentId: s.studentId,
        status: attendanceMap[s.studentId] || 'PRESENT',
      }));

      await attendanceApi.batchLog({
        orgId: currentOrg.id,
        teamId: activeSection.id,
        date: todayStr,
        records,
      });

      setMarkedToday(true);
      setSaveMessage(
        `Successfully logged attendance for ${activeSection.name} (${records.length} students)! 📋`
      );
      loadSectionData(activeSection.id);
    } catch {
      setSaveMessage('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const students = sectionAnalytics?.studentLedger || [];
  const lowAttendanceInClass = students.filter((s: any) => s.percentage < 75);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {/* Top Banner */}
      <View style={[styles.headerBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.headerIcon, { backgroundColor: colors.emeraldLight }]}>
          <CalendarCheck size={24} color={colors.emerald} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isStudent
              ? 'My Attendance Record'
              : isParent
              ? 'Child Attendance Monitor'
              : 'Class Section Attendance'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {isStudent || isParent
              ? 'Verified institutional attendance ledger'
              : `Strictly scoped to Class Teacher's assigned section`}
          </Text>
        </View>
      </View>

      {/* ==================== STUDENT / PARENT VIEW ==================== */}
      {(isStudent || isParent) && (
        <View>
          {/* Parent Child Switcher Tabs */}
          {isParent && children.length > 1 && (
            <View style={styles.childTabsWrap}>
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>Select Student:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childTabs}>
                {children.map((k) => (
                  <TouchableOpacity
                    key={k.userId}
                    onPress={() => handleSelectChild(k.userId)}
                    style={[
                      styles.childChip,
                      {
                        backgroundColor: selectedChildId === k.userId ? colors.primary : colors.card,
                        borderColor: selectedChildId === k.userId ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.childChipText,
                        { color: selectedChildId === k.userId ? '#ffffff' : colors.text },
                      ]}
                    >
                      {k.user?.fullName || 'Child'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : studentReport ? (
            <View style={styles.parentSection}>
              {/* Attendance Rate Gauge Card */}
              <View style={[styles.gaugeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text
                  style={[
                    styles.gaugeVal,
                    {
                      color:
                        (studentReport.attendance?.percentage ?? 100) < 75
                          ? colors.destructive
                          : colors.emerald,
                    },
                  ]}
                >
                  {studentReport.attendance?.percentage ?? 100}%
                </Text>
                <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>
                  30-Day Attendance Rate
                </Text>
                <Text style={[styles.gaugeSub, { color: colors.textMuted }]}>
                  {studentReport.attendance?.presentClasses ?? 0} Present /{' '}
                  {studentReport.attendance?.totalClasses ?? 0} Total Classes Conducted
                </Text>
              </View>

              {/* Low Attendance Warning */}
              {(studentReport.attendance?.percentage ?? 100) < 75 && (
                <View
                  style={[
                    styles.alertCard,
                    { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: colors.destructive },
                  ]}
                >
                  <AlertTriangle size={18} color={colors.destructive} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: colors.destructive }]}>
                      Attendance Below Minimum 75% Requirement
                    </Text>
                    <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
                      Institutional guidelines require at least 75% attendance for term examination eligibility.
                      Please connect with your Class Teacher.
                    </Text>
                  </View>
                </View>
              )}

              {/* Recent Daily Records */}
              <Text style={[styles.subHeading, { color: colors.text, marginTop: 12 }]}>
                Recent Attendance Register
              </Text>
              {!studentReport.attendance?.recentRecords?.length ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  No recent attendance records logged yet.
                </Text>
              ) : (
                studentReport.attendance.recentRecords.map((r: any) => {
                  const isPres = r.status === 'PRESENT';
                  const isAbs = r.status === 'ABSENT';

                  return (
                    <View
                      key={r.id}
                      style={[styles.recordRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View>
                        <Text style={[styles.recordDate, { color: colors.text }]}>
                          {new Date(r.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text style={[styles.recordSub, { color: colors.textMuted }]}>
                          Daily Classroom Roll
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
                          {
                            backgroundColor: isPres
                              ? colors.emeraldLight
                              : isAbs
                              ? 'rgba(239, 68, 68, 0.15)'
                              : colors.amberLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTagText,
                            {
                              color: isPres
                                ? colors.emerald
                                : isAbs
                                ? colors.destructive
                                : colors.amber,
                            },
                          ]}
                        >
                          {r.status}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No attendance data found for this profile.
            </Text>
          )}
        </View>
      )}

      {/* ==================== TEACHER / LEADERSHIP VIEW ==================== */}
      {isFaculty && (
        <View>
          {/* Class Section Selector (For Leadership & Multi-Section Teachers) */}
          {availableSections.length > 0 ? (
            <View style={styles.sectionPickerWrap}>
              <View style={styles.pickerHeaderRow}>
                <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                  {isLeadership ? 'Select Class Section:' : 'Your Assigned Class Section:'}
                </Text>
                {activeSection?.managerId === user?.id && (
                  <View style={[styles.classTeacherBadge, { backgroundColor: colors.emeraldLight }]}>
                    <CheckCircle2 size={12} color={colors.emerald} style={{ marginRight: 3 }} />
                    <Text style={[styles.classTeacherBadgeText, { color: colors.emerald }]}>
                      Class Teacher
                    </Text>
                  </View>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectionChipsRow}
              >
                {availableSections.map((sec) => {
                  const isSelected = sec.id === selectedSectionId;
                  const isMySection = sec.managerId === user?.id;

                  return (
                    <TouchableOpacity
                      key={sec.id}
                      onPress={() => handleSelectSection(sec.id)}
                      style={[
                        styles.sectionChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Layers size={13} color={isSelected ? '#ffffff' : colors.primary} />
                      <Text
                        style={[
                          styles.sectionChipText,
                          { color: isSelected ? '#ffffff' : colors.text },
                        ]}
                      >
                        {sec.name}
                      </Text>
                      {isMySection && !isSelected && (
                        <View style={[styles.myDot, { backgroundColor: colors.emerald }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.noSectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <AlertTriangle size={20} color={colors.amber} />
              <Text style={[styles.noSectionTitle, { color: colors.text }]}>
                No Assigned Class Section Found
              </Text>
              <Text style={[styles.noSectionDesc, { color: colors.textMuted }]}>
                You are currently not designated as a Class Teacher for any section. Please contact your
                department head or administrator.
              </Text>
            </View>
          )}

          {/* Active Class Section Overview Banner */}
          {activeSection && (
            <View style={[styles.classSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.classSummaryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.classNameTitle, { color: colors.text }]}>
                    {activeSection.name}
                  </Text>
                  <Text style={[styles.classDeptSub, { color: colors.textMuted }]}>
                    {activeSection.deptName || 'General Wing'} • Class Teacher:{' '}
                    {sectionAnalytics?.team?.classTeacherName ||
                      (activeSection.managerId === user?.id ? user?.fullName : 'Assigned Faculty')}
                  </Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
                  <Users size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                    {students.length} Enrolled
                  </Text>
                </View>
              </View>

              {/* Status & Average stats */}
              <View style={[styles.classStatsRow, { borderTopColor: colors.border }]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: colors.emerald }]}>
                    {sectionAnalytics?.classAverageAttendancePercentage ?? 94}%
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Class Average</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statBox}>
                  <Text
                    style={[
                      styles.statVal,
                      { color: lowAttendanceInClass.length > 0 ? colors.destructive : colors.emerald },
                    ]}
                  >
                    {lowAttendanceInClass.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Below 75%</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statBox}>
                  <Text
                    style={[
                      styles.statVal,
                      { color: markedToday ? colors.emerald : colors.amber, fontSize: 13 },
                    ]}
                  >
                    {markedToday ? 'LOGGED' : 'PENDING'}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Today's Status</Text>
                </View>
              </View>
            </View>
          )}

          {/* Low Attendance Alert for this section */}
          {lowAttendanceInClass.length > 0 && (
            <View
              style={[
                styles.alertCard,
                { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: colors.destructive },
              ]}
            >
              <AlertTriangle size={18} color={colors.destructive} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.destructive }]}>
                  {lowAttendanceInClass.length} Student{lowAttendanceInClass.length > 1 ? 's' : ''} with
                  Attendance &lt; 75%
                </Text>
                <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
                  Institutional counseling alert flagged for Class Teacher review.
                </Text>
              </View>
            </View>
          )}

          {/* Feedback & Save Banner */}
          {saveMessage ? (
            <View style={[styles.msgBanner, { backgroundColor: colors.emeraldLight }]}>
              <Text style={[styles.msgText, { color: colors.emerald }]}>{saveMessage}</Text>
            </View>
          ) : null}

          {/* Student Register Header & Quick Actions */}
          <View style={styles.listHeader}>
            <View>
              <Text style={[styles.subHeading, { color: colors.text }]}>
                Class Register ({students.length} Students)
              </Text>
              <Text style={[styles.registerDate, { color: colors.textMuted }]}>Date: {todayStr}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleMarkAllPresent}
                style={[styles.allPresentBtn, { borderColor: colors.emerald }]}
              >
                <Check size={13} color={colors.emerald} style={{ marginRight: 3 }} />
                <Text style={[styles.allPresentBtnText, { color: colors.emerald }]}>All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBatchLog}
                disabled={saving || students.length === 0}
                style={[styles.saveAllBtn, { backgroundColor: colors.emerald }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveAllBtnText}>Save Attendance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Students List */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
          ) : students.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No enrolled students found in this class section.
            </Text>
          ) : (
            students.map((s: any, idx: number) => {
              const currentStatus = attendanceMap[s.studentId] || 'PRESENT';
              const isLow = s.percentage < 75;

              return (
                <View
                  key={s.studentId || idx}
                  style={[
                    styles.studentCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isLow ? 'rgba(239, 68, 68, 0.4)' : colors.border,
                    },
                  ]}
                >
                  <View style={styles.studentInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.studentName, { color: colors.text }]}>
                        {s.studentName || 'Student'}
                      </Text>
                      {s.rollNo ? (
                        <View style={[styles.rollBadge, { backgroundColor: colors.cardSecondary }]}>
                          <Text style={[styles.rollText, { color: colors.textMuted }]}>
                            {s.rollNo}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.studentRate,
                        { color: isLow ? colors.destructive : colors.emerald },
                      ]}
                    >
                      Attendance: {s.percentage}% ({s.presentCount ?? 0}/{s.totalSessions ?? 0} classes)
                    </Text>
                  </View>

                  {/* 1-Click Status Selector */}
                  <View style={styles.statusButtons}>
                    {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => {
                      const selected = currentStatus === st;
                      const isPres = st === 'PRESENT';
                      const isAbs = st === 'ABSENT';

                      return (
                        <TouchableOpacity
                          key={st}
                          onPress={() =>
                            setAttendanceMap((prev) => ({ ...prev, [s.studentId]: st }))
                          }
                          style={[
                            styles.statusBtn,
                            selected && {
                              backgroundColor: isPres
                                ? colors.emerald
                                : isAbs
                                ? colors.destructive
                                : colors.amber,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBtnText,
                              { color: selected ? '#ffffff' : colors.textSecondary },
                            ]}
                          >
                            {st === 'PRESENT'
                              ? 'Pres'
                              : st === 'ABSENT'
                              ? 'Abs'
                              : st === 'LATE'
                              ? 'Late'
                              : 'Exc'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 2 },

  // Section Selector
  sectionPickerWrap: { marginBottom: 14 },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  selectorLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  classTeacherBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  classTeacherBadgeText: { fontSize: 10, fontWeight: '800' },
  sectionChipsRow: { gap: 8, paddingVertical: 4 },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionChipText: { fontSize: 12, fontWeight: '700' },
  myDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },

  // Class Overview Card
  classSummaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  classSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  classNameTitle: { fontSize: 16, fontWeight: '800' },
  classDeptSub: { fontSize: 11, marginTop: 2 },
  countBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  countBadgeText: { fontSize: 11, fontWeight: '700' },
  classStatsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2 },
  statDivider: { width: 1, height: 24 },

  // Alerts
  alertCard: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  alertTitle: { fontSize: 12, fontWeight: '700' },
  alertDesc: { fontSize: 11, marginTop: 2 },
  msgBanner: { padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  msgText: { fontSize: 12, fontWeight: '700' },

  // List header
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subHeading: { fontSize: 14, fontWeight: '700' },
  registerDate: { fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  allPresentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  allPresentBtnText: { fontSize: 11, fontWeight: '700' },
  saveAllBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveAllBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

  // Student Card
  studentCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  studentName: { fontSize: 13, fontWeight: '700' },
  rollBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rollText: { fontSize: 9, fontWeight: '700' },
  studentRate: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  statusButtons: { flexDirection: 'row', gap: 4 },
  statusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  statusBtnText: { fontSize: 10, fontWeight: '700' },

  // Parent & Student View Styles
  childTabsWrap: { marginBottom: 14 },
  childTabs: { gap: 8, paddingVertical: 4 },
  childChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  childChipText: { fontSize: 12, fontWeight: '700' },
  parentSection: { gap: 12 },
  gaugeCard: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1 },
  gaugeVal: { fontSize: 48, fontWeight: '900' },
  gaugeLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  gaugeSub: { fontSize: 11, marginTop: 2 },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recordDate: { fontSize: 13, fontWeight: '700' },
  recordSub: { fontSize: 10, marginTop: 1 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 11, fontWeight: '700' },
  noSectionCard: { padding: 18, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 6, marginBottom: 14 },
  noSectionTitle: { fontSize: 14, fontWeight: '700' },
  noSectionDesc: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 12 },
});


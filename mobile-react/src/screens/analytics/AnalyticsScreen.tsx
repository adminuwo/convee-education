import React, { useEffect, useState, useCallback } from 'react';
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
import { analyticsApi, parentApi, homeworkApi } from '../../lib/api';
import {
  TrendingUp,
  Award,
  CalendarCheck,
  BookOpen,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  GraduationCap,
} from 'lucide-react-native';

export default function AnalyticsScreen({ navigation }: any) {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Faculty / Campus stats
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [orgAnalytics, setOrgAnalytics] = useState<any>(null);

  // Student / Parent stats
  const [studentReport, setStudentReport] = useState<any>(null);

  const role = currentOrg?.role || user?.systemRole || 'MEMBER';
  const isStudentOrParent = role === 'STUDENT' || role === 'PARENT';

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      if (isStudentOrParent) {
        if (role === 'STUDENT') {
          const report = await parentApi.getChildReport(user!.id, currentOrg.id).catch(() => null);
          setStudentReport(report);
        } else {
          // Parent: fetch first linked child or child report
          const children = await parentApi.getMyChildren().catch(() => []);
          if (Array.isArray(children) && children.length > 0) {
            const firstChildId = children[0].userId;
            const report = await parentApi.getChildReport(firstChildId, currentOrg.id).catch(() => null);
            setStudentReport(report);
          }
        }
      } else {
        // Faculty / Admin
        const [attRes, orgRes] = await Promise.all([
          analyticsApi.getAttendanceStats(currentOrg.id).catch(() => null),
          analyticsApi.getOrgAnalytics(currentOrg.id).catch(() => null),
        ]);
        if (attRes) setAttendanceStats(attRes);
        if (orgRes) setOrgAnalytics(orgRes);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id, isStudentOrParent, role, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : isStudentOrParent ? (
        /* ==================== STUDENT / PARENT VIEW ==================== */
        <View>
          {/* Header Card */}
          <View style={[styles.profileHeaderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatarBox, { backgroundColor: colors.primary }]}>
              <GraduationCap size={24} color="#ffffff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.studentTitle, { color: colors.text }]}>
                {studentReport?.student?.user?.fullName || user?.fullName || 'Student Progress'}
              </Text>
              <Text style={[styles.studentSub, { color: colors.textMuted }]}>
                {studentReport?.student?.team?.name || 'Class Section'} • {studentReport?.student?.department?.name || 'Academic Wing'}
              </Text>
            </View>
          </View>

          {/* Key Metrics Grid */}
          <View style={styles.kpiRow}>
            {/* Attendance % */}
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.emeraldLight }]}>
                <CalendarCheck size={18} color={colors.emerald} />
              </View>
              <Text style={[styles.kpiVal, { color: colors.text }]}>
                {studentReport?.attendance?.percentage !== undefined
                  ? `${studentReport.attendance.percentage}%`
                  : '—'}
              </Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>30-Day Attendance</Text>
              <Text style={[styles.kpiFoot, { color: colors.emerald }]}>
                {studentReport?.attendance?.presentClasses ?? 0} / {studentReport?.attendance?.totalClasses ?? 0} Classes
              </Text>
            </View>

            {/* Homework Submissions */}
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <BookOpen size={18} color={colors.primary} />
              </View>
              <Text style={[styles.kpiVal, { color: colors.text }]}>
                {studentReport?.homeworkReport?.filter((h: any) => h.submission)?.length ?? 0} /{' '}
                {studentReport?.homeworkReport?.length ?? 0}
              </Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>Homework Completed</Text>
              <Text style={[styles.kpiFoot, { color: colors.primary }]}>
                {studentReport?.homeworkReport?.filter((h: any) => !h.submission)?.length ?? 0} Pending
              </Text>
            </View>
          </View>

          {/* Attendance Health Progress Bar */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Attendance Health Status</Text>
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor:
                      (studentReport?.attendance?.percentage ?? 100) >= 75
                        ? colors.emeraldLight
                        : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgePillText,
                    {
                      color:
                        (studentReport?.attendance?.percentage ?? 100) >= 75
                          ? colors.emerald
                          : colors.destructive,
                    },
                  ]}
                >
                  {(studentReport?.attendance?.percentage ?? 100) >= 75 ? 'GOOD STANDING' : 'LOW ATTENDANCE'}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(studentReport?.attendance?.percentage ?? 100, 100)}%`,
                    backgroundColor:
                      (studentReport?.attendance?.percentage ?? 100) >= 75 ? colors.emerald : colors.destructive,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barFootnote, { color: colors.textMuted }]}>
              Minimum institutional threshold is 75% attendance across term sessions.
            </Text>
          </View>

          {/* Recent Homework Grades & Feedback */}
          <Text style={[styles.groupTitle, { color: colors.text }]}>Recent Assignment Grades</Text>
          {studentReport?.homeworkReport?.length === 0 ? (
            <Text style={[styles.emptyNotice, { color: colors.textMuted }]}>No homework items assigned yet.</Text>
          ) : (
            studentReport?.homeworkReport?.slice(0, 5).map((hw: any) => {
              const sub = hw.submission;
              const hasScore = sub?.gradeScore !== undefined && sub?.gradeScore !== null;
              return (
                <View
                  key={hw.id}
                  style={[styles.reportItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.reportTop}>
                    <Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>
                      {hw.title}
                    </Text>
                    {hasScore ? (
                      <View style={[styles.gradePill, { backgroundColor: colors.emeraldLight }]}>
                        <Award size={12} color={colors.emerald} style={{ marginRight: 4 }} />
                        <Text style={[styles.gradePillText, { color: colors.emerald }]}>
                          {sub.gradeScore} / {sub.gradeMax || 100}
                        </Text>
                      </View>
                    ) : sub ? (
                      <View style={[styles.gradePill, { backgroundColor: colors.amberLight }]}>
                        <Text style={[styles.gradePillText, { color: colors.amber }]}>Under Review</Text>
                      </View>
                    ) : (
                      <View style={[styles.gradePill, { backgroundColor: colors.cardSecondary }]}>
                        <Text style={[styles.gradePillText, { color: colors.textMuted }]}>Not Submitted</Text>
                      </View>
                    )}
                  </View>

                  {sub?.feedbackNotes ? (
                    <Text style={[styles.feedbackSnippet, { color: colors.textSecondary }]}>
                      Feedback: "{sub.feedbackNotes}"
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : (
        /* ==================== FACULTY / ADMIN VIEW ==================== */
        <View>
          {/* Top Campus Summary Banner */}
          <View style={[styles.campusBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.campusBannerHeader}>
              <View>
                <Text style={[styles.bannerTitle, { color: colors.text }]}>Campus Academic Analytics</Text>
                <Text style={[styles.bannerSub, { color: colors.textMuted }]}>
                  {currentOrg?.name || 'Convee Academy'} • Real-Time Metrics
                </Text>
              </View>
              <View style={[styles.healthBadge, { backgroundColor: colors.emeraldLight }]}>
                <CheckCircle2 size={13} color={colors.emerald} style={{ marginRight: 4 }} />
                <Text style={[styles.healthBadgeText, { color: colors.emerald }]}>HEALTHY</Text>
              </View>
            </View>

            {/* Overall Attendance KPI */}
            <View style={[styles.bannerStatsRow, { borderTopColor: colors.border }]}>
              <View style={styles.bannerStatItem}>
                <Text style={[styles.statVal, { color: colors.emerald }]}>
                  {attendanceStats?.overallCampusPercentage !== undefined
                    ? `${attendanceStats.overallCampusPercentage}%`
                    : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Campus Attendance</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.bannerStatItem}>
                <Text style={[styles.statVal, { color: colors.primary }]}>
                  {attendanceStats?.studentStats?.length ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Enrolled Students</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.bannerStatItem}>
                <Text style={[styles.statVal, { color: colors.destructive }]}>
                  {attendanceStats?.lowAttendanceAlerts?.length ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Low Att. Alerts</Text>
              </View>
            </View>
          </View>

          {/* Homework & Tasks Pipeline */}
          <Text style={[styles.groupTitle, { color: colors.text }]}>Homework Assignment Pipeline</Text>
          <View style={styles.pipelineGrid}>
            <View style={[styles.pipelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.pipelineVal, { color: colors.primary }]}>
                {orgAnalytics?.taskCompletion?.find((t: any) => t.status === 'TODO')?._count?._all ?? 0}
              </Text>
              <Text style={[styles.pipelineLabel, { color: colors.textSecondary }]}>To Do</Text>
            </View>
            <View style={[styles.pipelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.pipelineVal, { color: colors.amber }]}>
                {orgAnalytics?.taskCompletion?.find((t: any) => t.status === 'REVIEW')?._count?._all ?? 0}
              </Text>
              <Text style={[styles.pipelineLabel, { color: colors.textSecondary }]}>In Review</Text>
            </View>
            <View style={[styles.pipelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.pipelineVal, { color: colors.emerald }]}>
                {orgAnalytics?.taskCompletion?.find((t: any) => t.status === 'COMPLETED')?._count?._all ?? 0}
              </Text>
              <Text style={[styles.pipelineLabel, { color: colors.textSecondary }]}>Graded & Done</Text>
            </View>
          </View>

          {/* Low Attendance Watchlist */}
          <View style={styles.watchlistHeaderRow}>
            <Text style={[styles.groupTitle, { color: colors.text, marginBottom: 0 }]}>
              {'At-Risk Attendance Watchlist (< 75%)'}
            </Text>
            <AlertTriangle size={16} color={colors.destructive} />
          </View>

          {!attendanceStats?.lowAttendanceAlerts || attendanceStats.lowAttendanceAlerts.length === 0 ? (
            <View style={[styles.emptyAlertBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <CheckCircle2 size={24} color={colors.emerald} />
              <Text style={[styles.emptyAlertText, { color: colors.textSecondary }]}>
                Excellent! No students currently fall below the 75% attendance threshold.
              </Text>
            </View>
          ) : (
            attendanceStats.lowAttendanceAlerts.map((student: any) => (
              <View
                key={student.studentId}
                style={[styles.alertCard, { backgroundColor: colors.card, borderColor: 'rgba(239, 68, 68, 0.25)' }]}
              >
                <View style={styles.alertHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertStudentName, { color: colors.text }]}>{student.studentName}</Text>
                    <Text style={[styles.alertStudentMeta, { color: colors.textMuted }]}>
                      {student.className} • {student.wingName}
                    </Text>
                  </View>
                  <View style={[styles.alertPctBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Text style={[styles.alertPctText, { color: colors.destructive }]}>
                      {student.percentage}% ATTENDANCE
                    </Text>
                  </View>
                </View>
                <Text style={[styles.alertFoot, { color: colors.textSecondary }]}>
                  Attended {student.presentClasses} of {student.totalClasses} total classes recorded.
                </Text>
              </View>
            ))
          )}

          {/* Faculty Workload Activity */}
          {orgAnalytics?.workload && orgAnalytics.workload.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.groupTitle, { color: colors.text }]}>Active Faculty Workload</Text>
              {orgAnalytics.workload.slice(0, 4).map((w: any, idx: number) => (
                <View
                  key={idx}
                  style={[styles.workloadRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.workloadName, { color: colors.text }]}>
                    {w.user?.fullName || 'Faculty Member'}
                  </Text>
                  <View style={[styles.workloadPill, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.workloadPillText, { color: colors.primary }]}>
                      {w.count} Active Tasks
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  profileHeaderCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  avatarBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  studentTitle: { fontSize: 16, fontWeight: '800' },
  studentSub: { fontSize: 12, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  kpiCard: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1 },
  iconCircle: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiVal: { fontSize: 20, fontWeight: '800' },
  kpiSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  kpiFoot: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  sectionCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeading: { fontSize: 13, fontWeight: '700' },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgePillText: { fontSize: 9, fontWeight: '800' },
  progressBarBg: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 5 },
  barFootnote: { fontSize: 10, marginTop: 8 },
  groupTitle: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  emptyNotice: { fontSize: 12, fontStyle: 'italic', marginVertical: 8 },
  reportItem: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportTitle: { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  gradePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  gradePillText: { fontSize: 10, fontWeight: '800' },
  feedbackSnippet: { fontSize: 11, fontStyle: 'italic', marginTop: 6 },

  // Campus / Faculty styles
  campusBanner: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  campusBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  bannerSub: { fontSize: 11, marginTop: 2 },
  healthBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  healthBadgeText: { fontSize: 9, fontWeight: '800' },
  bannerStatsRow: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1 },
  bannerStatItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, height: '80%' },
  pipelineGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pipelineCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  pipelineVal: { fontSize: 20, fontWeight: '800' },
  pipelineLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  watchlistHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 },
  emptyAlertBox: { padding: 18, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyAlertText: { fontSize: 12, textAlign: 'center' },
  alertCard: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  alertStudentName: { fontSize: 13, fontWeight: '700' },
  alertStudentMeta: { fontSize: 11, marginTop: 1 },
  alertPctBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  alertPctText: { fontSize: 9, fontWeight: '800' },
  alertFoot: { fontSize: 11 },
  workloadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  workloadName: { fontSize: 12, fontWeight: '600' },
  workloadPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  workloadPillText: { fontSize: 10, fontWeight: '700' },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { parentApi, channelApi } from '../../lib/api';
import {
  User,
  GraduationCap,
  CalendarCheck,
  BookOpen,
  Mail,
  MessageSquare,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react-native';

export default function ParentStudentPortalScreen({ navigation }: any) {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Parent linked children
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Student Comprehensive Report
  const [report, setReport] = useState<any>(null);

  const role = currentOrg?.role || user?.systemRole || 'MEMBER';
  const isParent = role === 'PARENT';

  const loadPortalData = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      if (isParent) {
        const kids = await parentApi.getMyChildren().catch(() => []);
        const validKids = Array.isArray(kids) ? kids : [];
        setChildren(validKids);

        const targetId = selectedStudentId || (validKids.length > 0 ? validKids[0].userId : null);
        if (targetId) {
          setSelectedStudentId(targetId);
          const rep = await parentApi.getChildReport(targetId, currentOrg.id).catch(() => null);
          setReport(rep);
        } else {
          setReport(null);
        }
      } else {
        // Student or Faculty viewing self portal
        const rep = await parentApi.getChildReport(user!.id, currentOrg.id).catch(() => null);
        setReport(rep);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id, isParent, selectedStudentId, user?.id]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const handleSelectChild = async (childUserId: string) => {
    if (!currentOrg?.id || childUserId === selectedStudentId) return;
    setSelectedStudentId(childUserId);
    setLoading(true);
    try {
      const rep = await parentApi.getChildReport(childUserId, currentOrg.id).catch(() => null);
      setReport(rep);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleMessageUser = async (targetUserId: string, targetName: string) => {
    if (!currentOrg?.id) return;
    try {
      const dmChannel = await channelApi.dm(currentOrg.id, targetUserId);
      if (dmChannel?.id) {
        navigation.navigate('ChatRoom', {
          channelId: dmChannel.id,
          channelName: targetName,
        });
      }
    } catch {
      Alert.alert('Notice', `Unable to initiate direct message with ${targetName}.`);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPortalData();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* If Parent has multiple linked children, render tab switcher */}
      {isParent && children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll}>
          {children.map((child: any) => {
            const isSelected = child.userId === selectedStudentId;
            const childName = child.user?.fullName || child.user?.email || 'Child';
            return (
              <TouchableOpacity
                key={child.userId}
                onPress={() => handleSelectChild(child.userId)}
                style={[
                  styles.childChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <GraduationCap size={15} color={isSelected ? '#ffffff' : colors.textSecondary} />
                <Text
                  style={[
                    styles.childChipText,
                    { color: isSelected ? '#ffffff' : colors.text },
                  ]}
                >
                  {childName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : isParent && children.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ShieldAlert size={44} color={colors.amber} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Linked Student Profiles</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Your parent account is active, but no student profiles are linked yet. Please contact your school
            administration to link your child's student enrollment account.
          </Text>
        </View>
      ) : !isParent && role !== 'STUDENT' ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <GraduationCap size={44} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Learner & Family Portal</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            This portal is designated for students and parents to review personal report cards, attendance records, and mentors.
            As a faculty member ({role}), your institutional tools are located under Class Attendance, Homework & Rubrics, and Academic Analytics.
          </Text>
          <TouchableOpacity
            style={[styles.msgBtn, { alignSelf: 'center', marginTop: 14, backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          >
            <Text style={styles.msgBtnText}>Go to Home Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : !report ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <GraduationCap size={44} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Student Academic Records</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Academic report is currently updating. Please refresh in a moment.
          </Text>
        </View>
      ) : (
        <View>
          {/* Student Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarLetter}>
                {(report.student?.user?.fullName || 'S')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.studentFullName, { color: colors.text }]}>
                {report.student?.user?.fullName || report.student?.user?.email || 'Student'}
              </Text>
              <Text style={[styles.studentEmail, { color: colors.textMuted }]}>
                {report.student?.user?.email}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.miniBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.miniBadgeText, { color: colors.primary }]}>
                    {report.student?.team?.name || 'Class Section'}
                  </Text>
                </View>
                <View style={[styles.miniBadge, { backgroundColor: colors.cardSecondary }]}>
                  <Text style={[styles.miniBadgeText, { color: colors.textSecondary }]}>
                    {report.student?.department?.name || 'Academic Wing'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Mentors & Key Faculty Contacts */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Faculty & Mentors</Text>
          <View style={styles.mentorList}>
            {/* Class Teacher */}
            {report.classTeacher ? (
              <View style={[styles.mentorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.mentorInfo}>
                  <Text style={[styles.mentorRole, { color: colors.primary }]}>CLASS TEACHER</Text>
                  <Text style={[styles.mentorName, { color: colors.text }]}>
                    {report.classTeacher.fullName || 'Assigned Teacher'}
                  </Text>
                  <Text style={[styles.mentorEmail, { color: colors.textMuted }]}>
                    {report.classTeacher.email}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleMessageUser(report.classTeacher.id, report.classTeacher.fullName || 'Teacher')}
                  style={[styles.msgBtn, { backgroundColor: colors.primary }]}
                >
                  <MessageSquare size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.msgBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* HOD */}
            {report.hodUser ? (
              <View style={[styles.mentorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.mentorInfo}>
                  <Text style={[styles.mentorRole, { color: colors.purple }]}>HEAD OF DEPARTMENT</Text>
                  <Text style={[styles.mentorName, { color: colors.text }]}>
                    {report.hodUser.fullName || 'Academic Head'}
                  </Text>
                  <Text style={[styles.mentorEmail, { color: colors.textMuted }]}>
                    {report.hodUser.email}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleMessageUser(report.hodUser.id, report.hodUser.fullName || 'HOD')}
                  style={[styles.msgBtn, { backgroundColor: colors.purple }]}
                >
                  <MessageSquare size={14} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.msgBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Attendance Health */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>30-Day Attendance Record</Text>
          <View style={[styles.attendanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.attendanceHeader}>
              <View style={styles.attIconRow}>
                <CalendarCheck size={20} color={colors.emerald} />
                <Text style={[styles.attScore, { color: colors.text }]}>
                  {report.attendance?.percentage !== undefined ? `${report.attendance.percentage}%` : '—'}
                </Text>
              </View>
              {report.attendance?.percentage !== undefined ? (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        report.attendance.percentage >= 75
                          ? colors.emeraldLight
                          : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          report.attendance.percentage >= 75
                            ? colors.emerald
                            : colors.destructive,
                      },
                    ]}
                  >
                    {report.attendance.percentage >= 75 ? 'REGULAR' : 'ATTENDANCE ALERT'}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.attDetails, { color: colors.textSecondary }]}>
              Attended {report.attendance?.presentClasses ?? 0} out of {report.attendance?.totalClasses ?? 0} total
              class sessions conducted in the past 30 days.
            </Text>

            {/* Recent Attendance Logs */}
            {report.attendance?.recentRecords && report.attendance.recentRecords.length > 0 && (
              <View style={[styles.recordsList, { borderTopColor: colors.border }]}>
                <Text style={[styles.recordsHeading, { color: colors.textMuted }]}>Recent Session Logs:</Text>
                {report.attendance.recentRecords.slice(0, 5).map((r: any) => {
                  const isPresent = r.status === 'PRESENT';
                  const isLate = r.status === 'LATE';
                  return (
                    <View key={r.id} style={styles.recordRow}>
                      <Text style={[styles.recordDate, { color: colors.text }]}>
                        {new Date(r.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <View
                        style={[
                          styles.recPill,
                          {
                            backgroundColor: isPresent
                              ? colors.emeraldLight
                              : isLate
                              ? colors.amberLight
                              : 'rgba(239, 68, 68, 0.15)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.recPillText,
                            {
                              color: isPresent
                                ? colors.emerald
                                : isLate
                                ? colors.amber
                                : colors.destructive,
                            },
                          ]}
                        >
                          {r.status}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Homework & Academic Progress */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Homework & Rubric Grades</Text>
          {report.homeworkReport?.length === 0 ? (
            <Text style={[styles.emptyNotice, { color: colors.textMuted }]}>No homework records found.</Text>
          ) : (
            report.homeworkReport?.map((hw: any) => {
              const sub = hw.submission;
              const hasScore = sub?.gradeScore !== undefined && sub?.gradeScore !== null;
              return (
                <View
                  key={hw.id}
                  style={[styles.hwCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.hwCardHeader}>
                    <Text style={[styles.hwTitle, { color: colors.text }]}>{hw.title}</Text>
                    {hasScore ? (
                      <View style={[styles.scoreBadge, { backgroundColor: colors.emeraldLight }]}>
                        <Award size={12} color={colors.emerald} style={{ marginRight: 4 }} />
                        <Text style={[styles.scoreBadgeText, { color: colors.emerald }]}>
                          {sub.gradeScore} / {sub.gradeMax || 100}
                        </Text>
                      </View>
                    ) : sub ? (
                      <View style={[styles.scoreBadge, { backgroundColor: colors.amberLight }]}>
                        <Text style={[styles.scoreBadgeText, { color: colors.amber }]}>Under Review</Text>
                      </View>
                    ) : (
                      <View style={[styles.scoreBadge, { backgroundColor: colors.cardSecondary }]}>
                        <Text style={[styles.scoreBadgeText, { color: colors.textMuted }]}>Pending</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.hwDueRow}>
                    <Clock size={12} color={colors.textMuted} />
                    <Text style={[styles.hwDueText, { color: colors.textMuted }]}>
                      Due: {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : 'Next Class'}
                    </Text>
                  </View>

                  {sub?.feedbackNotes ? (
                    <View style={[styles.feedbackBox, { backgroundColor: colors.cardSecondary }]}>
                      <Text style={[styles.feedbackLabel, { color: colors.textMuted }]}>Teacher Feedback:</Text>
                      <Text style={[styles.feedbackText, { color: colors.text }]}>"{sub.feedbackNotes}"</Text>
                    </View>
                  ) : null}
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
  content: { padding: 16, paddingBottom: 40 },
  childScroll: { flexDirection: 'row', marginBottom: 14 },
  childChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  childChipText: { fontSize: 12, fontWeight: '700' },
  emptyBox: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 10, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyDesc: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  studentFullName: { fontSize: 17, fontWeight: '800' },
  studentEmail: { fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  miniBadgeText: { fontSize: 10, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 10 },
  mentorList: { gap: 10, marginBottom: 16 },
  mentorCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1 },
  mentorInfo: { flex: 1, marginRight: 10 },
  mentorRole: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  mentorName: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  mentorEmail: { fontSize: 11, marginTop: 1 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  msgBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  attendanceCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  attIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attScore: { fontSize: 22, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  attDetails: { fontSize: 12, lineHeight: 18 },
  recordsList: { borderTopWidth: 1, paddingTop: 10, marginTop: 12, gap: 6 },
  recordsHeading: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordDate: { fontSize: 12, fontWeight: '500' },
  recPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  recPillText: { fontSize: 9, fontWeight: '800' },
  emptyNotice: { fontSize: 12, fontStyle: 'italic', marginVertical: 8 },
  hwCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  hwCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hwTitle: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  scoreBadgeText: { fontSize: 10, fontWeight: '800' },
  hwDueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  hwDueText: { fontSize: 11 },
  feedbackBox: { padding: 8, borderRadius: 8, marginTop: 8 },
  feedbackLabel: { fontSize: 10, fontWeight: '600' },
  feedbackText: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});

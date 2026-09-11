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
import { attendanceApi, parentApi } from '../../lib/api';
import {
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react-native';

export default function AttendanceScreen() {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [stats, setStats] = useState<any>(null);
  const [parentReport, setParentReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const isParent = currentOrg?.role === 'PARENT';

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      if (isParent) {
        const children = await parentApi.getMyChildren();
        if (children?.length > 0) {
          const childId = children[0].userId || children[0].user?.id;
          const rep = await parentApi.getChildReport(childId, currentOrg.id);
          setParentReport(rep);
        }
      } else {
        const st = await attendanceApi.getStats(currentOrg.id);
        setStats(st);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id, isParent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBatchLog = async () => {
    if (!stats?.studentStats?.length || !currentOrg?.id) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const records = stats.studentStats.map((s: any) => ({
        studentId: s.studentId,
        status: attendanceMap[s.studentId] || 'PRESENT',
      }));

      await attendanceApi.batchLog({
        orgId: currentOrg.id,
        teamId: 'default-section',
        records,
      });

      setSaveMessage(`Successfully logged today's attendance for ${records.length} students! 📋`);
      loadData();
    } catch {
      setSaveMessage('Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const students = stats?.studentStats || [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
    >
      {/* Top Banner */}
      <View style={[styles.headerBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.headerIcon, { backgroundColor: colors.emeraldLight }]}>
          <CalendarCheck size={24} color={colors.emerald} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isParent ? "Child Attendance Record" : "Class Attendance Tracker"}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {isParent ? "Real-time monthly attendance monitoring" : "1-Click daily attendance logging for faculty"}
          </Text>
        </View>
      </View>

      {/* Low Attendance Alert Banner */}
      {stats?.lowAttendanceCount > 0 && !isParent ? (
        <View style={[styles.alertCard, { backgroundColor: colors.amberLight, borderColor: colors.amber }]}>
          <AlertTriangle size={18} color={colors.amber} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.amber }]}>
              Low Attendance Warning ({stats.lowAttendanceCount} Students &lt;75%)
            </Text>
            <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
              Flagged to HODs and Principals for academic counseling.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Parent Child Attendance View */}
      {isParent && parentReport ? (
        <View style={styles.parentSection}>
          <View style={[styles.gaugeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.gaugeVal, { color: colors.emerald }]}>
              {parentReport.attendance?.percentage ?? 100}%
            </Text>
            <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>30-Day Attendance Rate</Text>
            <Text style={[styles.gaugeSub, { color: colors.textMuted }]}>
              {parentReport.attendance?.presentClasses ?? 0} Present / {parentReport.attendance?.totalClasses ?? 0} Total Classes
            </Text>
          </View>

          <Text style={[styles.subHeading, { color: colors.text }]}>Recent Class Records</Text>
          {parentReport.attendance?.recentRecords?.map((r: any) => (
            <View key={r.id} style={[styles.recordRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.recordDate, { color: colors.text }]}>
                {new Date(r.date).toLocaleDateString()}
              </Text>
              <View style={[styles.statusTag, { backgroundColor: r.status === 'PRESENT' ? colors.emeraldLight : colors.amberLight }]}>
                <Text style={[styles.statusTagText, { color: r.status === 'PRESENT' ? colors.emerald : colors.amber }]}>
                  {r.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Teacher Attendance Tracking List */}
      {!isParent ? (
        <View>
          {saveMessage ? (
            <View style={[styles.msgBanner, { backgroundColor: colors.emeraldLight }]}>
              <Text style={[styles.msgText, { color: colors.emerald }]}>{saveMessage}</Text>
            </View>
          ) : null}

          <View style={styles.listHeader}>
            <Text style={[styles.subHeading, { color: colors.text }]}>Enrolled Students ({students.length})</Text>
            <TouchableOpacity
              onPress={handleBatchLog}
              disabled={saving}
              style={[styles.saveAllBtn, { backgroundColor: colors.emerald }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveAllBtnText}>Save Today's Attendance</Text>
              )}
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
          ) : students.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No enrolled student records found.</Text>
          ) : (
            students.map((s: any) => {
              const currentStatus = attendanceMap[s.studentId] || 'PRESENT';

              return (
                <View key={s.studentId} style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, { color: colors.text }]}>{s.studentName}</Text>
                    <Text style={[styles.studentRate, { color: s.percentage < 75 ? colors.destructive : colors.emerald }]}>
                      Monthly: {s.percentage}%
                    </Text>
                  </View>

                  {/* 1-Click Status Selector */}
                  <View style={styles.statusButtons}>
                    {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => {
                      const selected = currentStatus === st;
                      const isPresent = st === 'PRESENT';
                      const isAbsent = st === 'ABSENT';

                      return (
                        <TouchableOpacity
                          key={st}
                          onPress={() => setAttendanceMap((prev) => ({ ...prev, [s.studentId]: st }))}
                          style={[
                            styles.statusBtn,
                            selected && {
                              backgroundColor: isPresent
                                ? colors.emerald
                                : isAbsent
                                ? colors.destructive
                                : colors.amber,
                            },
                          ]}
                        >
                          <Text style={[styles.statusBtnText, { color: selected ? '#ffffff' : colors.textSecondary }]}>
                            {st === 'PRESENT' ? 'Pres' : st === 'ABSENT' ? 'Abs' : st === 'LATE' ? 'Late' : 'Exc'}
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
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  headerBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 2 },
  alertCard: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  alertTitle: { fontSize: 12, fontWeight: '700' },
  alertDesc: { fontSize: 11, marginTop: 2 },
  msgBanner: { padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  msgText: { fontSize: 12, fontWeight: '700' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  subHeading: { fontSize: 14, fontWeight: '700' },
  saveAllBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveAllBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  studentCard: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 13, fontWeight: '700' },
  studentRate: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  statusButtons: { flexDirection: 'row', gap: 4 },
  statusBtn: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 6, backgroundColor: 'rgba(150,150,150,0.1)' },
  statusBtnText: { fontSize: 10, fontWeight: '700' },
  parentSection: { gap: 12 },
  gaugeCard: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1 },
  gaugeVal: { fontSize: 44, fontWeight: '900' },
  gaugeLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  gaugeSub: { fontSize: 11, marginTop: 2 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
  recordDate: { fontSize: 13, fontWeight: '600' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 11, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 12 },
});

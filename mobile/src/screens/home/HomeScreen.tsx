import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { aiApi, dashboardApi, attendanceApi } from '../../lib/api';
import {
  Sparkles,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  RefreshCw,
  Bell,
  ArrowRight,
  GraduationCap,
} from 'lucide-react-native';

export default function HomeScreen({ navigation }: any) {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [briefing, setBriefing] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setBriefingLoading(true);
      const [bRes, aRes, dRes] = await Promise.all([
        aiApi.dailyBriefing(currentOrg.id).catch(() => null),
        attendanceApi.getStats(currentOrg.id).catch(() => null),
        dashboardApi.employee(currentOrg.id).catch(() => null),
      ]);
      if (bRes?.briefing) setBriefing(bRes.briefing);
      if (aRes) setAttendanceStats(aRes);
      if (dRes) setDashboardData(dRes);
    } catch {
      // ignore
    } finally {
      setBriefingLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const userRole = currentOrg?.role || 'MEMBER';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.fullName || user?.email?.split('@')[0] || 'Member'}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <Text style={[styles.roleText, { color: colors.primary }]}>{userRole}</Text>
        </View>
      </View>

      <Text style={[styles.orgName, { color: colors.textMuted }]}>
        {currentOrg?.name || 'Demo International Academy'}
      </Text>

      {/* AI Executive Daily Briefing Card */}
      <View style={[styles.briefingCard, { backgroundColor: colors.card, borderColor: colors.purpleLight }]}>
        <View style={styles.briefingHeader}>
          <View style={styles.briefingTitleRow}>
            <View style={[styles.sparkleIcon, { backgroundColor: colors.purpleLight }]}>
              <Sparkles size={16} color={colors.purple} />
            </View>
            <Text style={[styles.briefingTitle, { color: colors.text }]}>AI Daily Campus Briefing</Text>
          </View>
          <TouchableOpacity onPress={loadData} disabled={briefingLoading} style={styles.refreshIconBtn}>
            {briefingLoading ? (
              <ActivityIndicator size="small" color={colors.purple} />
            ) : (
              <RefreshCw size={15} color={colors.purple} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={[styles.briefingContent, { color: colors.textSecondary }]}>
          {briefing ||
            `${currentOrg?.name || 'Academy'} operations running smoothly. Active assignments and real-time attendance tracking are in sync.`}
        </Text>
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        {/* Attendance KPI */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Attendance')}
          style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.kpiIcon, { backgroundColor: colors.emeraldLight }]}>
            <CalendarCheck size={20} color={colors.emerald} />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {attendanceStats?.overallCampusPercentage ?? 98}%
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Attendance Rate</Text>
        </TouchableOpacity>

        {/* Homework / Tasks KPI */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Homework')}
          style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.kpiIcon, { backgroundColor: colors.primaryLight }]}>
            <BookOpen size={20} color={colors.primary} />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {dashboardData?.myTasks?.length ?? 4}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Active Tasks</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Navigation */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.actionsList}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Homework')}
          style={[styles.actionItem, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.actionLeft}>
            <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
              <BookOpen size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.actionName, { color: colors.text }]}>Homework & Rubrics</Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                {userRole === 'STUDENT' ? 'Submit assignment solutions' : 'Grade assignments with rubrics'}
              </Text>
            </View>
          </View>
          <ArrowRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Attendance')}
          style={[styles.actionItem, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.actionLeft}>
            <View style={[styles.actionIcon, { backgroundColor: colors.emeraldLight }]}>
              <CalendarCheck size={18} color={colors.emerald} />
            </View>
            <View>
              <Text style={[styles.actionName, { color: colors.text }]}>Class Attendance</Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                {userRole === 'PARENT' ? "Check child's attendance rate" : '1-Click section attendance logger'}
              </Text>
            </View>
          </View>
          <ArrowRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('AI')}
          style={[styles.actionItem, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.actionLeft}>
            <View style={[styles.actionIcon, { backgroundColor: colors.purpleLight }]}>
              <Sparkles size={18} color={colors.purple} />
            </View>
            <View>
              <Text style={[styles.actionName, { color: colors.text }]}>AI Academic Assistant</Text>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Generate quiz questions & study help
              </Text>
            </View>
          </View>
          <ArrowRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  userName: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  roleText: { fontSize: 11, fontWeight: '800' },
  orgName: { fontSize: 12, fontWeight: '500', marginTop: 4, marginBottom: 16 },
  briefingCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  briefingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  briefingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkleIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  briefingTitle: { fontSize: 13, fontWeight: '700' },
  refreshIconBtn: { padding: 4 },
  briefingContent: { fontSize: 12, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  kpiCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16 },
  kpiIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  actionsList: { gap: 10 },
  actionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, padding: 14 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionName: { fontSize: 13, fontWeight: '700' },
  actionDesc: { fontSize: 11, marginTop: 2 },
});

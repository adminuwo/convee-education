import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { meetingApi } from '../../lib/api';
import {
  Video,
  Calendar,
  Clock,
  Users,
  Plus,
  X,
  ExternalLink,
  MapPin,
  Sparkles,
} from 'lucide-react-native';

export default function MeetingsScreen({ navigation }: any) {
  const { user, currentOrg } = useAuth();
  const { colors } = useTheme();

  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  // Create Meeting Modal
  const [createModal, setCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [customUrl, setCustomUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const isStudent = currentOrg?.role === 'STUDENT';

  const loadMeetings = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const res = await meetingApi.list(currentOrg.id);
      setMeetings(Array.isArray(res) ? res : []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleJoinMeeting = async (meeting: any) => {
    const url = meeting.meetingUrl?.trim() || `https://meet.jit.si/convee-${meeting.id}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open meeting link', url);
      }
    } catch {
      Alert.alert('Unable to open meeting link', url);
    }
  };

  const handleCreateMeeting = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a meeting title.');
      return;
    }
    if (!currentOrg?.id) return;

    setCreating(true);
    try {
      const startDateTime = new Date(`${meetingDate}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${meetingDate}T${endTime}:00`).toISOString();

      await meetingApi.create({
        orgId: currentOrg.id,
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        meetingUrl: customUrl.trim() || undefined,
      });

      setCreateModal(false);
      setTitle('');
      setDescription('');
      setCustomUrl('');
      loadMeetings();
      Alert.alert('Success', 'Meeting scheduled successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to schedule meeting. Please ensure start time is in the future.';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const now = new Date();
  const upcomingMeetings = meetings.filter((m) => {
    const end = m.endTime ? new Date(m.endTime) : new Date(m.startTime);
    return end >= now;
  });
  const pastMeetings = meetings.filter((m) => {
    const end = m.endTime ? new Date(m.endTime) : new Date(m.startTime);
    return end < now;
  });

  const displayedMeetings = tab === 'upcoming' ? upcomingMeetings : pastMeetings;

  const formatSchedule = (startStr: string, endStr?: string) => {
    try {
      const s = new Date(startStr);
      const dayStr = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      if (endStr) {
        const e = new Date(endStr);
        const endTimeStr = e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `${dayStr} • ${timeStr} - ${endTimeStr}`;
      }
      return `${dayStr} • ${timeStr}`;
    } catch {
      return startStr;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setTab('upcoming')}
          style={[styles.tabItem, tab === 'upcoming' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
        >
          <Text style={[styles.tabText, { color: tab === 'upcoming' ? colors.primary : colors.textSecondary }]}>
            UPCOMING ({upcomingMeetings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('past')}
          style={[styles.tabItem, tab === 'past' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
        >
          <Text style={[styles.tabText, { color: tab === 'past' ? colors.primary : colors.textSecondary }]}>
            PAST ({pastMeetings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Bar for Faculty */}
      {!isStudent && (
        <View style={[styles.actionBanner, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>Faculty Live Classroom</Text>
            <Text style={[styles.bannerSub, { color: colors.textMuted }]}>
              Schedule video classes or staff huddles with 1-click Jitsi rooms.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setCreateModal(true)}
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
          >
            <Plus size={16} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.createBtnText}>Schedule</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMeetings();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : displayedMeetings.length === 0 ? (
          <View style={styles.emptyView}>
            <Video size={42} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {tab === 'upcoming' ? 'No upcoming live meetings scheduled' : 'No past meeting history'}
            </Text>
          </View>
        ) : (
          displayedMeetings.map((m) => {
            const isLiveNow = () => {
              const s = new Date(m.startTime).getTime();
              const e = m.endTime ? new Date(m.endTime).getTime() : s + 3600000;
              const cur = Date.now();
              return cur >= s - 600000 && cur <= e;
            };

            const liveNow = isLiveNow();

            return (
              <View
                key={m.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: liveNow ? colors.emerald : colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{m.title}</Text>
                    <View style={styles.timeRow}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {formatSchedule(m.startTime, m.endTime)}
                      </Text>
                    </View>
                  </View>
                  {liveNow ? (
                    <View style={[styles.liveBadge, { backgroundColor: colors.emeraldLight }]}>
                      <Text style={[styles.liveBadgeText, { color: colors.emerald }]}>LIVE NOW</Text>
                    </View>
                  ) : null}
                </View>

                {m.description ? (
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {m.description}
                  </Text>
                ) : null}

                <View style={[styles.cardMetaRow, { borderTopColor: colors.border }]}>
                  <View style={styles.hostRow}>
                    <Users size={13} color={colors.textMuted} />
                    <Text style={[styles.hostText, { color: colors.textSecondary }]} numberOfLines={1}>
                      Host: {m.createdBy?.fullName || 'Faculty'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleJoinMeeting(m)}
                    style={[styles.joinBtn, { backgroundColor: liveNow ? colors.emerald : colors.primary }]}
                  >
                    <Video size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.joinBtnText}>{liveNow ? 'Join Now' : 'Join Link'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Schedule Meeting Modal */}
      <Modal visible={createModal} animationType="slide" transparent onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Video size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule Live Class</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModal(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Meeting / Class Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Grade 10 Mathematics Revision"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.cardSecondary, color: colors.text }]}
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Description / Agenda</Text>
              <TextInput
                multiline
                numberOfLines={2}
                value={description}
                onChangeText={setDescription}
                placeholder="Topics covered, prerequisite notes..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.cardSecondary, color: colors.text, height: 65 }]}
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                value={meetingDate}
                onChangeText={setMeetingDate}
                placeholder="2026-09-15"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.cardSecondary, color: colors.text }]}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Start Time (HH:MM) *</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="10:00"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { backgroundColor: colors.cardSecondary, color: colors.text }]}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>End Time (HH:MM) *</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="11:00"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { backgroundColor: colors.cardSecondary, color: colors.text }]}
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>
                Custom Meeting URL (Leave empty for Convee Jitsi Room)
              </Text>
              <TextInput
                value={customUrl}
                onChangeText={setCustomUrl}
                placeholder="https://meet.google.com/... or auto-generate"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: colors.cardSecondary, color: colors.text }]}
              />

              <TouchableOpacity
                onPress={handleCreateMeeting}
                disabled={creating}
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Schedule Meeting</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '700' },
  actionBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, margin: 14, marginBottom: 0, borderRadius: 12, borderWidth: 1 },
  bannerTitle: { fontSize: 13, fontWeight: '700' },
  bannerSub: { fontSize: 11, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  list: { padding: 14 },
  emptyView: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 13 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  timeText: { fontSize: 11, fontWeight: '500' },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveBadgeText: { fontSize: 9, fontWeight: '800' },
  cardDesc: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  hostText: { fontSize: 11, fontWeight: '500' },
  joinBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  joinBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 18, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 8, padding: 10, fontSize: 13 },
  rowInputs: { flexDirection: 'row' },
  submitBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});

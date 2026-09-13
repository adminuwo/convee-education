import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';
import { notifApi } from '../lib/api';
import {
  Bell,
  X,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  Sparkles,
  CheckCheck,
  Video,
} from 'lucide-react-native';

export default function NotificationsModal() {
  const { colors } = useTheme();
  const { isNotificationsOpen, closeNotifications, refreshUnreadCount } = useDrawer();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notifApi.list();
      setNotifications(Array.isArray(res?.notifications) ? res.notifications : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isNotificationsOpen) {
      loadNotifications();
    }
  }, [isNotificationsOpen, loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await notifApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      refreshUnreadCount();
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notifApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } catch {
      // ignore
    }
  };

  const getNotifIcon = (type?: string, title?: string) => {
    const t = (type || '').toUpperCase();
    const titleLower = (title || '').toLowerCase();
    if (t.includes('TASK') || titleLower.includes('homework') || titleLower.includes('assignment')) {
      return { icon: BookOpen, color: colors.primary, bg: colors.primaryLight };
    }
    if (t.includes('MEETING') || titleLower.includes('meeting') || titleLower.includes('class')) {
      return { icon: Video, color: colors.purple, bg: colors.purpleLight };
    }
    if (t.includes('ATTENDANCE') || titleLower.includes('attendance')) {
      return { icon: CalendarCheck, color: colors.emerald, bg: colors.emeraldLight };
    }
    if (t.includes('CHAT') || t.includes('MESSAGE') || titleLower.includes('message')) {
      return { icon: MessageSquare, color: colors.amber, bg: colors.amberLight };
    }
    return { icon: Bell, color: colors.primary, bg: colors.primaryLight };
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <Modal
      visible={isNotificationsOpen}
      animationType="slide"
      transparent
      onRequestClose={closeNotifications}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <Bell size={18} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
            </View>
            <View style={styles.headerActions}>
              {hasUnread && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
                  <CheckCheck size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={closeNotifications} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <ScrollView contentContainerStyle={styles.list}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
            ) : notifications.length === 0 ? (
              <View style={styles.emptyView}>
                <Bell size={36} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  You're all caught up! When assignments, attendance, or announcements occur, they'll appear here.
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                const { icon: IconComp, color, bg } = getNotifIcon(item.type, item.title);
                const isUnread = !item.isRead;

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => isUnread && handleMarkRead(item.id)}
                    activeOpacity={isUnread ? 0.7 : 1}
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: isUnread ? colors.cardSecondary : colors.card,
                        borderColor: isUnread ? colors.primaryLight : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: bg }]}>
                      <IconComp size={18} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTopRow}>
                        <Text
                          style={[
                            styles.itemTitle,
                            { color: colors.text, fontWeight: isUnread ? '800' : '600' },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                            {formatTime(item.createdAt)}
                          </Text>
                          {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                        </View>
                      </View>
                      {item.body ? (
                        <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>
                          {item.body}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
    minHeight: '40%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6 },
  markAllText: { fontSize: 11, fontWeight: '700' },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 4 },
  list: { padding: 16, gap: 10 },
  emptyView: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTitle: { fontSize: 13, flex: 1, marginRight: 8 },
  itemTime: { fontSize: 10 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  itemDesc: { fontSize: 12, lineHeight: 16 },
});

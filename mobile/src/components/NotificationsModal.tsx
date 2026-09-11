import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';
import {
  Bell,
  X,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';

export default function NotificationsModal() {
  const { colors } = useTheme();
  const { isNotificationsOpen, closeNotifications } = useDrawer();

  const NOTIFICATIONS = [
    {
      id: '1',
      title: 'New Homework Assigned',
      desc: 'Trigonometric Identical Equations posted by Mathematics department.',
      time: '15m ago',
      icon: BookOpen,
      iconColor: colors.primary,
      bgColor: colors.primaryLight,
    },
    {
      id: '2',
      title: 'Attendance Verified',
      desc: 'Class attendance for today has been recorded and synced to parent portal.',
      time: '1h ago',
      icon: CalendarCheck,
      iconColor: colors.emerald,
      bgColor: colors.emeraldLight,
    },
    {
      id: '3',
      title: 'AI Daily Briefing Ready',
      desc: 'Daily campus academic summary generated for Director & Faculty review.',
      time: '3h ago',
      icon: Sparkles,
      iconColor: colors.purple,
      bgColor: colors.purpleLight,
    },
    {
      id: '4',
      title: 'Class Section Message',
      desc: 'New discussion in #general by Academic Office regarding exam schedule.',
      time: 'Yesterday',
      icon: MessageSquare,
      iconColor: colors.primary,
      bgColor: colors.primaryLight,
    },
  ];

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
            <TouchableOpacity onPress={closeNotifications} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <ScrollView contentContainerStyle={styles.list}>
            {NOTIFICATIONS.map((item) => {
              const IconComp = item.icon;
              return (
                <View
                  key={item.id}
                  style={[styles.itemCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <View style={[styles.itemIcon, { backgroundColor: item.bgColor }]}>
                    <IconComp size={18} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemTopRow}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.itemTime, { color: colors.textMuted }]}>{item.time}</Text>
                    </View>
                    <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                  </View>
                </View>
              );
            })}
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
    maxHeight: '75%',
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
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 4 },
  list: { padding: 16, gap: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  itemTitle: { fontSize: 13, fontWeight: '700' },
  itemTime: { fontSize: 10 },
  itemDesc: { fontSize: 12, lineHeight: 16 },
});

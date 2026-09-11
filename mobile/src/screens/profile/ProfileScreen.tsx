import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  User as UserIcon,
  Building2,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Smartphone,
  ChevronRight,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, currentOrg, logout } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <UserIcon size={32} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.fullName || 'User Profile'}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.roleText, { color: colors.primary }]}>{currentOrg?.role || 'STUDENT'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.infoRow}>
          <Building2 size={16} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {currentOrg?.name || 'Demo International Academy'}
          </Text>
        </View>
      </View>

      {/* Account Security Info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account & Security</Text>
        <View style={styles.infoRow}>
          <ShieldCheck size={18} color={colors.emerald} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.securityTitle, { color: colors.text }]}>Verified Institutional Identity</Text>
            <Text style={[styles.securitySub, { color: colors.textSecondary }]}>Managed by campus administrator</Text>
          </View>
        </View>
      </View>

      {/* Appearance Settings */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
        <TouchableOpacity onPress={toggleTheme} style={styles.settingItem}>
          <View style={styles.settingLeft}>
            {isDark ? <Moon size={20} color={colors.purple} /> : <Sun size={20} color={colors.amber} />}
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {isDark ? 'Dark Theme Active' : 'Light Theme Active'}
            </Text>
          </View>
          <Text style={[styles.switchText, { color: colors.primary }]}>Toggle</Text>
        </TouchableOpacity>
      </View>

      {/* App Version Info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Smartphone size={18} color={colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.versionTitle, { color: colors.text }]}>Convee Education Mobile</Text>
            <Text style={[styles.versionSub, { color: colors.textMuted }]}>Version 1.0.0 (Build 52)</Text>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={logout}
        style={[styles.logoutBtn, { borderColor: colors.destructive }]}
      >
        <LogOut size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 18, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 6 },
  roleText: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  securityTitle: { fontSize: 13, fontWeight: '600' },
  securitySub: { fontSize: 11, marginTop: 2 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: 13, fontWeight: '600' },
  switchText: { fontSize: 12, fontWeight: '700' },
  versionTitle: { fontSize: 13, fontWeight: '600' },
  versionSub: { fontSize: 11, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  logoutText: { fontSize: 14, fontWeight: '700' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getBaseUrl, setBaseUrl, LIVE_BACKEND_URL, LOCAL_BACKEND_URL } from '../../lib/api';
import {
  User as UserIcon,
  Building2,
  Server,
  Sun,
  Moon,
  LogOut,
  Shield,
  CheckCircle2,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, currentOrg, logout } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();

  const [currentServer, setCurrentServer] = useState(getBaseUrl());
  const [customIp, setCustomIp] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setCurrentServer(getBaseUrl());
  }, []);

  const handleSwitchServer = async (target: 'live' | 'local' | 'custom') => {
    let url = `${LIVE_BACKEND_URL}/api/v1`;
    if (target === 'local') {
      url = `${LOCAL_BACKEND_URL}/api/v1`;
    } else if (target === 'custom' && customIp.trim()) {
      const clean = customIp.trim();
      url = clean.startsWith('http') ? `${clean}/api/v1` : `http://${clean}:8001/api/v1`;
    }

    await setBaseUrl(url);
    setCurrentServer(url);
    setSavedMsg(`Target server switched to: ${url}`);
    setTimeout(() => setSavedMsg(''), 4000);
  };

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

      {/* Theme Toggle */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        <TouchableOpacity onPress={toggleTheme} style={styles.settingItem}>
          <View style={styles.settingLeft}>
            {isDark ? <Moon size={20} color={colors.purple} /> : <Sun size={20} color={colors.amber} />}
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {isDark ? 'Dark Mode Active' : 'Light Mode Active'}
            </Text>
          </View>
          <Text style={[styles.switchText, { color: colors.primary }]}>Toggle</Text>
        </TouchableOpacity>
      </View>

      {/* Server Environment Switcher */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Backend Server Connection</Text>
        <Text style={[styles.serverActiveText, { color: colors.textSecondary }]}>
          Current: <Text style={{ color: colors.primary, fontWeight: '700' }}>{currentServer}</Text>
        </Text>

        {savedMsg ? (
          <View style={[styles.savedBanner, { backgroundColor: colors.emeraldLight }]}>
            <Text style={[styles.savedText, { color: colors.emerald }]}>{savedMsg}</Text>
          </View>
        ) : null}

        <View style={styles.serverOptions}>
          <TouchableOpacity
            onPress={() => handleSwitchServer('live')}
            style={[
              styles.serverBtn,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              currentServer.includes('run.app') && { borderColor: colors.primary, borderWidth: 2 },
            ]}
          >
            <Server size={16} color={colors.primary} />
            <Text style={[styles.serverBtnText, { color: colors.text }]}>Cloud Run (Live)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwitchServer('local')}
            style={[
              styles.serverBtn,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              currentServer.includes('10.0.2.2') && { borderColor: colors.primary, borderWidth: 2 },
            ]}
          >
            <Server size={16} color={colors.emerald} />
            <Text style={[styles.serverBtnText, { color: colors.text }]}>Local Emulator</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.customIpRow}>
          <TextInput
            value={customIp}
            onChangeText={setCustomIp}
            placeholder="Custom IP: e.g. 192.168.1.5"
            placeholderTextColor={colors.textMuted}
            style={[styles.customIpInput, { backgroundColor: colors.cardSecondary, color: colors.text }]}
          />
          <TouchableOpacity
            onPress={() => handleSwitchServer('custom')}
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
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
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: 13, fontWeight: '600' },
  switchText: { fontSize: 12, fontWeight: '700' },
  serverActiveText: { fontSize: 11, marginBottom: 10 },
  savedBanner: { padding: 8, borderRadius: 8, marginBottom: 10 },
  savedText: { fontSize: 11, fontWeight: '700' },
  serverOptions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  serverBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  serverBtnText: { fontSize: 11, fontWeight: '700' },
  customIpRow: { flexDirection: 'row', gap: 8 },
  customIpInput: { flex: 1, height: 38, borderRadius: 8, paddingHorizontal: 10, fontSize: 12 },
  applyBtn: { paddingHorizontal: 16, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  logoutText: { fontSize: 14, fontWeight: '700' },
});

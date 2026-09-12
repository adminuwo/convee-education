import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Sparkles, GraduationCap, UserCheck, ShieldCheck, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();

  const [portalMode, setPortalMode] = useState<'faculty' | 'student' | 'parent'>('faculty');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email/ID and password.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      await login({ email: email.trim(), password: password.trim(), portalMode });
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.error || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text style={[styles.brandTitle, { color: colors.text }]}>Convee Education</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
              Digital Campus & Academic Portal
            </Text>
          </View>

          {/* Portal Switcher Tabs */}
          <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setPortalMode('faculty')}
              style={[
                styles.tabButton,
                portalMode === 'faculty' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
            >
              <UserCheck size={16} color={portalMode === 'faculty' ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, { color: portalMode === 'faculty' ? colors.primary : colors.textMuted }]}>
                Faculty
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPortalMode('student')}
              style={[
                styles.tabButton,
                portalMode === 'student' && { backgroundColor: colors.emeraldLight, borderColor: colors.emerald },
              ]}
            >
              <GraduationCap size={16} color={portalMode === 'student' ? colors.emerald : colors.textMuted} />
              <Text style={[styles.tabText, { color: portalMode === 'student' ? colors.emerald : colors.textMuted }]}>
                Student
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPortalMode('parent')}
              style={[
                styles.tabButton,
                portalMode === 'parent' && { backgroundColor: colors.purpleLight, borderColor: colors.purple },
              ]}
            >
              <ShieldCheck size={16} color={portalMode === 'parent' ? colors.purple : colors.textMuted} />
              <Text style={[styles.tabText, { color: portalMode === 'parent' ? colors.purple : colors.textMuted }]}>
                Parent
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardHeading, { color: colors.text }]}>
              {portalMode === 'faculty' ? 'Faculty & Staff Sign In' : portalMode === 'student' ? 'Student Portal Sign In' : 'Parent Portal Sign In'}
            </Text>
            <Text style={[styles.cardSubheading, { color: colors.textSecondary }]}>
              Sign in with your institutional credentials.
            </Text>

            {errorMsg ? (
              <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: colors.destructive }]}>
                <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {portalMode === 'student' ? 'Student ID or Email' : portalMode === 'parent' ? 'Registered Parent Email' : 'Institutional Email'}
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Mail size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. director@demo.edu"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { color: colors.text }]}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In to Portal</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, justifyContent: 'center', minHeight: '100%' },
  brandHeader: { alignItems: 'center', marginBottom: 24, marginTop: 12 },
  brandIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 13, marginTop: 4 },
  tabContainer: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 16 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardHeading: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSubheading: { fontSize: 12, marginBottom: 16 },
  errorBanner: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 14 },
  errorText: { fontSize: 12, fontWeight: '600' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 46 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, height: '100%' },
  eyeButton: { padding: 4 },
  submitButton: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});

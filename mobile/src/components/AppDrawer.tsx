import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Home,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  Sparkles,
  User,
  Moon,
  Sun,
  LogOut,
  X,
  ChevronRight,
  GraduationCap,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../navigation/navigationRef';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.8), 340);

export default function AppDrawer() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const { user, currentOrg, logout } = useAuth();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isDrawerOpen]);

  const handleClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      closeDrawer();
      if (callback) {
        callback();
      }
    });
  };

  const handleNavigate = (screen: string, params?: any) => {
    handleClose(() => {
      navigate(screen, params);
    });
  };

  const handleLogout = () => {
    const performLogout = () => {
      handleClose(() => {
        logout();
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        performLogout();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: performLogout },
      ]);
    }
  };

  if (!isDrawerOpen) {
    return null;
  }

  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Academic User');
  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const userRole = currentOrg?.role || user?.systemRole || 'FACULTY';

  const menuItems = [
    {
      id: 'home',
      label: 'Home Dashboard',
      subtitle: 'Overview & quick metrics',
      icon: Home,
      onPress: () => handleNavigate('MainTabs', { screen: 'Home' }),
    },
    {
      id: 'homework',
      label: 'Homework & Rubrics',
      subtitle: 'Assignments & submissions',
      icon: BookOpen,
      onPress: () => handleNavigate('MainTabs', { screen: 'Homework' }),
    },
    {
      id: 'attendance',
      label: 'Class Attendance',
      subtitle: 'Register & records',
      icon: CalendarCheck,
      onPress: () => handleNavigate('MainTabs', { screen: 'Attendance' }),
    },
    {
      id: 'messages',
      label: 'Messages & Channels',
      subtitle: 'Classroom chat & staff',
      icon: MessageSquare,
      onPress: () => handleNavigate('MainTabs', { screen: 'Messages' }),
    },
    {
      id: 'ai',
      label: 'Convee AI Assistant',
      subtitle: 'Smart lesson & grading helper',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: colors.purple,
      onPress: () => handleNavigate('AIScreen'),
    },
    {
      id: 'profile',
      label: 'My Profile & Settings',
      subtitle: 'Preferences & security',
      icon: User,
      onPress: () => handleNavigate('Profile'),
    },
  ];

  return (
    <Modal
      visible={isDrawerOpen}
      transparent
      animationType="none"
      onRequestClose={() => handleClose()}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={() => handleClose()}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.55],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sliding Panel */}
        <Animated.View
          style={[
            styles.drawerContent,
            {
              width: DRAWER_WIDTH,
              backgroundColor: colors.card,
              borderRightColor: colors.border,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header Profile Section */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTopRow}>
              <View style={[styles.campusBadge, { backgroundColor: colors.primaryLight }]}>
                <GraduationCap size={14} color={colors.primary} />
                <Text style={[styles.campusText, { color: colors.primary }]}>CONVEE ACADEMY</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleClose()}
                style={[styles.closeButton, { backgroundColor: colors.cardSecondary }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.userInfoRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
              <View style={styles.userTextCol}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.userEmail, { color: colors.textMuted }]} numberOfLines={1}>
                  {user?.email || 'user@convee.edu'}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: colors.emeraldLight }]}>
                  <Text style={[styles.roleText, { color: colors.emerald }]}>
                    {userRole}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Navigation Links */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.menuSection}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NAVIGATION</Text>
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, { borderColor: colors.border }]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIconWrap, { backgroundColor: colors.cardSecondary }]}>
                      <IconComponent size={18} color={colors.primary} />
                    </View>
                    <View style={styles.menuLabelCol}>
                      <View style={styles.menuTitleRow}>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                        {item.badge && (
                          <View
                            style={[
                              styles.itemBadge,
                              { backgroundColor: item.badgeColor || colors.primary },
                            ]}
                          >
                            <Text style={styles.itemBadgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Settings Section */}
            <View style={[styles.menuSection, { marginTop: 8 }]}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>
              <TouchableOpacity
                style={[styles.menuItem, { borderColor: colors.border }]}
                onPress={toggleTheme}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: colors.cardSecondary }]}>
                  {isDark ? (
                    <Sun size={18} color={colors.amber} />
                  ) : (
                    <Moon size={18} color={colors.purple} />
                  )}
                </View>
                <View style={styles.menuLabelCol}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>
                    {isDark ? 'Light Theme' : 'Dark Theme'}
                  </Text>
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                    Switch visual appearance
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer with Logout */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={16} color={colors.destructive} />
              <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={[styles.versionText, { color: colors.textMuted }]}>
              Convee Education • Mobile & Web v1.0.0
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  drawerContent: {
    flex: 1,
    height: '100%',
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  campusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  campusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  userTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 14,
  },
  menuSection: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabelCol: {
    flex: 1,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  itemBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
  },
});

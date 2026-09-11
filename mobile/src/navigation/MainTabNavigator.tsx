import React from 'react';
import { Platform, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';
import { Menu, Bell, Home, BookOpen, CalendarCheck, MessageSquare } from 'lucide-react-native';

import HomeScreen from '../screens/home/HomeScreen';
import HomeworkScreen from '../screens/homework/HomeworkScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import ChannelsScreen from '../screens/chat/ChannelsScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { colors } = useTheme();
  const { openDrawer, openNotifications, unreadCount } = useDrawer();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '700',
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={openDrawer}
            style={styles.headerButtonLeft}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Open navigation drawer"
          >
            <Menu size={22} color={colors.text} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={openNotifications}
            style={styles.headerButtonRight}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Open notifications"
          >
            <Bell size={21} color={colors.text} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { borderColor: colors.card }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 72,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          headerTitle: 'Convee Education',
          tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} />,
        }}
      />

      <Tab.Screen
        name="Homework"
        component={HomeworkScreen}
        options={{
          title: 'Homework',
          headerTitle: 'Homework & Rubrics',
          tabBarIcon: ({ color, size }) => <BookOpen size={size - 2} color={color} />,
        }}
      />

      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          title: 'Attendance',
          headerTitle: 'Class Attendance',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size - 2} color={color} />,
        }}
      />

      <Tab.Screen
        name="Messages"
        component={ChannelsScreen}
        options={{
          title: 'Messages',
          headerTitle: 'Channels & Direct Chats',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size - 2} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerButtonLeft: {
    marginLeft: 16,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonRight: {
    marginRight: 16,
    padding: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});

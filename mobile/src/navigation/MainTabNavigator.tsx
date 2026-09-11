import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { Home, BookOpen, CalendarCheck, MessageSquare, User } from 'lucide-react-native';

import HomeScreen from '../screens/home/HomeScreen';
import HomeworkScreen from '../screens/homework/HomeworkScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import ChannelsScreen from '../screens/chat/ChannelsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 68,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
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

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: 'Account & Settings',
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

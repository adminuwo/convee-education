import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { navigationRef } from './navigationRef';

import LoginScreen from '../screens/auth/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import AIScreen from '../screens/ai/AIScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { isDark, colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          primary: colors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          primary: colors.primary,
        },
      };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
              }}
            />
            <Stack.Screen
              name="AIScreen"
              component={AIScreen}
              options={{
                headerShown: true,
                title: 'Convee AI Assistant',
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
              }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: true,
                title: 'My Profile & Settings',
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

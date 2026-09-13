import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { DrawerProvider } from './src/contexts/DrawerContext';
import RootNavigator from './src/navigation/RootNavigator';
import AppDrawer from './src/components/AppDrawer';
import NotificationsModal from './src/components/NotificationsModal';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor="transparent"
      translucent
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DrawerProvider>
            <ThemedStatusBar />
            <RootNavigator />
            <AppDrawer />
            <NotificationsModal />
          </DrawerProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

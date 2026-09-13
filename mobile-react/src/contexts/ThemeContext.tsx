import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../lib/storage';

export interface ThemeColors {
  background: string;
  card: string;
  cardSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  emerald: string;
  emeraldLight: string;
  amber: string;
  amberLight: string;
  purple: string;
  purpleLight: string;
  destructive: string;
}

export const darkColors: ThemeColors = {
  background: '#090d16',
  card: '#111827',
  cardSecondary: '#1a2234',
  border: '#1f293d',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  primary: '#3b82f6',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  emerald: '#10b981',
  emeraldLight: 'rgba(16, 185, 129, 0.15)',
  amber: '#f59e0b',
  amberLight: 'rgba(245, 158, 11, 0.15)',
  purple: '#8b5cf6',
  purpleLight: 'rgba(139, 92, 246, 0.15)',
  destructive: '#ef4444',
};

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  card: '#ffffff',
  cardSecondary: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#2563eb',
  primaryLight: 'rgba(37, 99, 235, 0.1)',
  emerald: '#059669',
  emeraldLight: 'rgba(5, 150, 105, 0.1)',
  amber: '#d97706',
  amberLight: 'rgba(217, 119, 6, 0.1)',
  purple: '#7c3aed',
  purpleLight: 'rgba(124, 58, 237, 0.1)',
  destructive: '#dc2626',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    storage.get('app_theme').then((saved) => {
      if (saved) setIsDark(saved === 'dark');
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      storage.set('app_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

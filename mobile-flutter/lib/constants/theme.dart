import 'package:flutter/material.dart';

class ConveeColors {
  static const Color background = Color(0xFF090D16);
  static const Color card = Color(0xFF111827);
  static const Color cardSecondary = Color(0xFF1A2234);
  static const Color border = Color(0xFF1F293D);
  static const Color text = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);
  
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryLight = Color(0x263B82F6);
  
  static const Color emerald = Color(0xFF10B981);
  static const Color emeraldLight = Color(0x2610B981);
  
  static const Color amber = Color(0xFFF59E0B);
  static const Color amberLight = Color(0x26F59E0B);
  
  static const Color purple = Color(0xFF8B5CF6);
  static const Color purpleLight = Color(0x268B5CF6);
  
  static const Color destructive = Color(0xFFEF4444);
}

ThemeData get conVeeDarkTheme {
  return ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: ConveeColors.background,
    primaryColor: ConveeColors.primary,
    colorScheme: const ColorScheme.dark(
      primary: ConveeColors.primary,
      secondary: ConveeColors.purple,
      surface: ConveeColors.card,
      error: ConveeColors.destructive,
    ),
    cardColor: ConveeColors.card,
    dividerColor: ConveeColors.border,
    appBarTheme: const AppBarTheme(
      backgroundColor: ConveeColors.background,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: ConveeColors.text,
        fontSize: 20,
        fontWeight: FontWeight.bold,
      ),
    ),
  );
}

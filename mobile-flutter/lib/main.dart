import 'package:flutter/material.dart';
import 'constants/theme.dart';
import 'screens/login_screen.dart';

import '../services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.init();
  runApp(const ConveeEducationApp());
}

class ConveeEducationApp extends StatelessWidget {
  const ConveeEducationApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Convee Education',
      debugShowCheckedModeBanner: false,
      theme: conVeeDarkTheme,
      home: const LoginScreen(),
    );
  }
}

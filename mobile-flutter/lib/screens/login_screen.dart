import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../constants/theme.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String _portalMode = 'faculty';
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;
  bool _loading = false;
  String? _errorMsg;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMsg = 'Please enter your email/ID and password.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMsg = null;
    });

    try {
      final res = await ApiService.login(
        email: email,
        password: password,
        portalMode: _portalMode,
      );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => HomeScreen(userData: res['user'], orgData: res['org']),
          ),
        );
      }
    } on DioException catch (e) {
      String msg = 'Authentication failed. Please check credentials.';
      if (e.response?.data is Map && e.response?.data['error'] != null) {
        msg = e.response!.data['error'].toString();
      } else if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.connectionError) {
        msg = 'Cannot reach campus servers. Check network connection.';
      }
      setState(() {
        _errorMsg = msg;
      });
    } catch (_) {
      setState(() {
        _errorMsg = 'An unexpected error occurred. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final heading = _portalMode == 'faculty'
        ? 'Faculty & Staff Sign In'
        : _portalMode == 'student'
            ? 'Student Portal Sign In'
            : 'Parent Portal Sign In';

    return Scaffold(
      backgroundColor: ConveeColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 28.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Real Brand Header
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.asset(
                    'assets/logo.png',
                    width: 72,
                    height: 72,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: ConveeColors.cardSecondary,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(Icons.school, color: ConveeColors.primary, size: 36),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Convee Education',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: ConveeColors.text,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Digital Campus & Academic Portal',
                  style: TextStyle(
                    fontSize: 14,
                    color: ConveeColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 24),

                // Portal Switcher Tabs
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: ConveeColors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: ConveeColors.border),
                  ),
                  child: Row(
                    children: [
                      _buildPortalTab('faculty', 'Faculty', Icons.verified_user_outlined, ConveeColors.primary),
                      _buildPortalTab('student', 'Student', Icons.school_outlined, ConveeColors.emerald),
                      _buildPortalTab('parent', 'Parent', Icons.family_restroom_outlined, ConveeColors.purple),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Login Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: ConveeColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: ConveeColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        heading,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: ConveeColors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Sign in with your institutional credentials.',
                        style: TextStyle(
                          fontSize: 13,
                          color: ConveeColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 18),

                      if (_errorMsg != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0x1AEF4444),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: ConveeColors.destructive),
                          ),
                          child: Text(
                            _errorMsg!,
                            style: const TextStyle(color: ConveeColors.destructive, fontSize: 13),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Email / ID Input
                      const Text(
                        'Email or Institutional ID',
                        style: TextStyle(color: ConveeColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _emailController,
                        style: const TextStyle(color: ConveeColors.text),
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          hintText: 'name@institution.edu',
                          hintStyle: const TextStyle(color: ConveeColors.textMuted, fontSize: 14),
                          prefixIcon: const Icon(Icons.mail_outline, color: ConveeColors.textSecondary, size: 20),
                          filled: true,
                          fillColor: ConveeColors.cardSecondary,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: ConveeColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: ConveeColors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: ConveeColors.primary, width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Password Input
                      const Text(
                        'Password',
                        style: TextStyle(color: ConveeColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        style: const TextStyle(color: ConveeColors.text),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          hintStyle: const TextStyle(color: ConveeColors.textMuted, fontSize: 14),
                          prefixIcon: const Icon(Icons.lock_outline, color: ConveeColors.textSecondary, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: ConveeColors.textSecondary,
                              size: 20,
                            ),
                            onPressed: () {
                              setState(() {
                                _showPassword = !_showPassword;
                              });
                            },
                          ),
                          filled: true,
                          fillColor: ConveeColors.cardSecondary,
                          contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: ConveeColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: ConveeColors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: ConveeColors.primary, width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Sign In Button
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _loading ? null : _handleLogin,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: ConveeColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                          ),
                          child: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Text(
                                  'Sign In',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPortalTab(String mode, String label, IconData icon, Color color) {
    final isSelected = _portalMode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _portalMode = mode;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: isSelected ? Border.all(color: color.withOpacity(0.5)) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isSelected ? color : ConveeColors.textMuted),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? color : ConveeColors.textMuted,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

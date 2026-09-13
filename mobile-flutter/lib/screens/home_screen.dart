import 'package:flutter/material.dart';
import '../constants/theme.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic>? userData;
  final Map<String, dynamic>? orgData;

  const HomeScreen({super.key, this.userData, this.orgData});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _org;
  String? _briefing;
  bool _briefingLoading = false;
  Map<String, dynamic>? _attendanceStats;
  Map<String, dynamic>? _dashboardData;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _user = widget.userData;
    _org = widget.orgData;
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _briefingLoading = true;
    });

    try {
      // If user/org wasn't passed, fetch from /auth/me
      if (_user == null || _org == null) {
        final me = await ApiService.getMe();
        if (me != null) {
          _user = me['user'] ?? (me.containsKey('email') ? me : null);
          if (me['memberships'] is List && (me['memberships'] as List).isNotEmpty) {
            final firstMem = (me['memberships'] as List).first;
            _org = firstMem['organization'] ?? {'id': firstMem['orgId'], 'name': 'Institution', 'role': firstMem['role']};
          }
        }
      }

      final orgId = _org?['id']?.toString();
      if (orgId != null && orgId.isNotEmpty) {
        final results = await Future.wait([
          ApiService.getDailyBriefing(orgId),
          ApiService.getDashboard(orgId),
          ApiService.getAttendanceStats(orgId),
        ]);

        if (mounted) {
          setState(() {
            _briefing = results[0] as String?;
            _dashboardData = results[1] as Map<String, dynamic>?;
            _attendanceStats = results[2] as Map<String, dynamic>?;
          });
        }
      }
    } catch (_) {
      // Handle network errors gracefully
    } finally {
      if (mounted) {
        setState(() {
          _briefingLoading = false;
          _refreshing = false;
        });
      }
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final userName = _user?['fullName'] ?? _user?['email']?.toString().split('@').first ?? 'Faculty';
    final orgName = _org?['name'] ?? 'Institution';
    final role = _org?['role'] ?? _user?['systemRole'] ?? 'MEMBER';

    return Scaffold(
      backgroundColor: ConveeColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/logo.png',
                width: 28,
                height: 28,
                errorBuilder: (_, __, ___) => const Icon(Icons.school, color: ConveeColors.primary, size: 24),
              ),
            ),
            const SizedBox(width: 10),
            Text(orgName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: ConveeColors.textSecondary),
            onPressed: () {
              setState(() => _refreshing = true);
              _loadData();
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: ConveeColors.textSecondary),
            onPressed: () async {
              await ApiService.logout();
              if (mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: ConveeColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Greeting Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ConveeColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: ConveeColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${_getGreeting()},',
                            style: const TextStyle(color: ConveeColors.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            userName,
                            style: const TextStyle(color: ConveeColors.text, fontSize: 20, fontWeight: FontWeight.bold),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: ConveeColors.primaryLight,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ConveeColors.primary.withOpacity(0.4)),
                      ),
                      child: Text(
                        role.toString().toUpperCase(),
                        style: const TextStyle(color: ConveeColors.primary, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // AI Daily Academic Briefing Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [const Color(0xFF1E1B4B), ConveeColors.card],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: ConveeColors.purple.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.auto_awesome, color: ConveeColors.purple, size: 18),
                            SizedBox(width: 6),
                            Text(
                              'AI Daily Academic Briefing',
                              style: TextStyle(color: ConveeColors.text, fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                          ],
                        ),
                        if (_briefingLoading)
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(color: ConveeColors.purple, strokeWidth: 2),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _briefing != null && _briefing!.isNotEmpty
                          ? _briefing!
                          : _briefingLoading
                              ? 'Connecting to campus intelligence engine...'
                              : 'No urgent announcements or scheduling updates for your cohort today.',
                      style: TextStyle(
                        color: _briefing != null ? ConveeColors.text : ConveeColors.textSecondary,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Attendance Overview (if available from live API)
              if (_attendanceStats != null) ...[
                const Text(
                  'Campus Attendance Stats',
                  style: TextStyle(color: ConveeColors.text, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _buildStatCard(
                      label: 'Present',
                      value: '${_attendanceStats?['present'] ?? _attendanceStats?['presentCount'] ?? '--'}',
                      color: ConveeColors.emerald,
                    ),
                    const SizedBox(width: 10),
                    _buildStatCard(
                      label: 'Absent',
                      value: '${_attendanceStats?['absent'] ?? _attendanceStats?['absentCount'] ?? '--'}',
                      color: ConveeColors.destructive,
                    ),
                    const SizedBox(width: 10),
                    _buildStatCard(
                      label: 'Rate',
                      value: _attendanceStats?['percentage'] != null ? '${_attendanceStats!['percentage']}%' : '--',
                      color: ConveeColors.primary,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],

              // Quick Actions Grid
              const Text(
                'Academic Modules',
                style: TextStyle(color: ConveeColors.text, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),

              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.35,
                children: [
                  _buildModuleItem('Class Channels', 'Messaging & Chat', Icons.chat_bubble_outline, ConveeColors.primary),
                  _buildModuleItem('AI Campus Tutor', 'Interactive Q&A', Icons.smart_toy_outlined, ConveeColors.purple),
                  _buildModuleItem('Daily Attendance', 'Roster & Records', Icons.fact_check_outlined, ConveeColors.emerald),
                  _buildModuleItem('Homework', 'Assignments & Tests', Icons.assignment_outlined, ConveeColors.amber),
                  _buildModuleItem('Live Meetings', 'Classroom Video', Icons.videocam_outlined, ConveeColors.destructive),
                  _buildModuleItem('Campus Portal', 'Parent & Student', Icons.badge_outlined, ConveeColors.textSecondary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({required String label, required String value, required Color color}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: ConveeColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ConveeColors.border),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: ConveeColors.textSecondary, fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleItem(String title, String subtitle, IconData icon, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: ConveeColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ConveeColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const Spacer(),
            Text(title, style: const TextStyle(color: ConveeColors.text, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(color: ConveeColors.textMuted, fontSize: 10)),
          ],
        ),
      ),
    );
  }
}

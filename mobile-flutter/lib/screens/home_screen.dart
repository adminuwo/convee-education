import 'package:flutter/material.dart';
import '../constants/theme.dart';
import 'login_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ConveeColors.background,
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.school, color: ConveeColors.primary, size: 24),
            SizedBox(width: 8),
            Text('Convee Campus'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none, color: ConveeColors.textSecondary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('No new notifications')),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: ConveeColors.textSecondary),
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          '16 KB Page Aligned',
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Welcome to Convee',
                    style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Connected learning and collaboration on Android 15+',
                    style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'Quick Modules',
              style: TextStyle(
                color: ConveeColors.text,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            // Grid of Modules
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.35,
              children: [
                _buildModuleCard(
                  title: 'AI Assistant',
                  subtitle: 'Tutor & Q&A',
                  icon: Icons.auto_awesome,
                  color: ConveeColors.purple,
                  onTap: () {},
                ),
                _buildModuleCard(
                  title: 'Chat Channels',
                  subtitle: 'Class discussions',
                  icon: Icons.chat_bubble_outline,
                  color: ConveeColors.primary,
                  onTap: () {},
                ),
                _buildModuleCard(
                  title: 'Attendance',
                  subtitle: 'Daily tracking',
                  icon: Icons.fact_check_outlined,
                  color: ConveeColors.emerald,
                  onTap: () {},
                ),
                _buildModuleCard(
                  title: 'Homework',
                  subtitle: 'Submissions',
                  icon: Icons.assignment_outlined,
                  color: ConveeColors.amber,
                  onTap: () {},
                ),
                _buildModuleCard(
                  title: 'Live Meetings',
                  subtitle: 'WebRTC calls',
                  icon: Icons.videocam_outlined,
                  color: ConveeColors.destructive,
                  onTap: () {},
                ),
                _buildModuleCard(
                  title: 'Portal',
                  subtitle: 'Student/Parent',
                  icon: Icons.badge_outlined,
                  color: ConveeColors.textSecondary,
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: ConveeColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ConveeColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const Spacer(),
              Text(
                title,
                style: const TextStyle(
                  color: ConveeColors.text,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  color: ConveeColors.textMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

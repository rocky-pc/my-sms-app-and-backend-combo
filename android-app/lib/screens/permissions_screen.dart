import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/native_bridge.dart';
import 'dashboard_screen.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  bool _smsGranted = false;
  bool _phoneStateGranted = false;
  bool _notificationGranted = false;
  bool _batteryOptimizationIgnored = false;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _refreshPermissions();
  }

  Future<void> _refreshPermissions() async {
    setState(() => _checking = true);

    final sms = await Permission.sms.isGranted;
    final phone = await Permission.phone.isGranted;
    final notif = await Permission.notification.isGranted;
    final battery = await NativeBridge.isIgnoringBatteryOptimizations();

    if (mounted) {
      setState(() {
        _smsGranted = sms;
        _phoneStateGranted = phone;
        _notificationGranted = notif;
        _batteryOptimizationIgnored = battery;
        _checking = false;
      });
    }
  }

  Future<void> _requestSms() async {
    final status = await Permission.sms.request();
    setState(() {
      _smsGranted = status.isGranted;
    });
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    }
  }

  Future<void> _requestPhoneState() async {
    final status = await Permission.phone.request();
    setState(() {
      _phoneStateGranted = status.isGranted;
    });
  }

  Future<void> _requestNotification() async {
    final status = await Permission.notification.request();
    setState(() {
      _notificationGranted = status.isGranted;
    });
  }

  Future<void> _requestBatteryExemption() async {
    await NativeBridge.requestIgnoreBatteryOptimizations();
    await Future.delayed(const Duration(milliseconds: 500));
    final battery = await NativeBridge.isIgnoringBatteryOptimizations();
    setState(() {
      _batteryOptimizationIgnored = battery;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('App Permissions'),
        centerTitle: true,
      ),
      body: _checking
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Icon(
                  Icons.shield_outlined,
                  size: 64,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  'Permission Setup',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'MySMS requires explicit permissions to detect incoming SMS on this device and synchronize them to your Supabase backend.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),

                // SMS Permission Card
                _buildPermissionCard(
                  icon: Icons.sms_rounded,
                  title: 'Receive SMS (Mandatory)',
                  subtitle:
                      'Allows capturing incoming SMS in real-time. No inbox history or outgoing SMS is read.',
                  isGranted: _smsGranted,
                  onRequest: _requestSms,
                ),
                const SizedBox(height: 12),

                // Multi-SIM Detection Card
                _buildPermissionCard(
                  icon: Icons.sim_card_outlined,
                  title: 'Phone State (SIM Slot Info)',
                  subtitle:
                      'Identifies whether the SMS was received on SIM 1 or SIM 2.',
                  isGranted: _phoneStateGranted,
                  onRequest: _requestPhoneState,
                ),
                const SizedBox(height: 12),

                // Battery Optimization Exemption
                _buildPermissionCard(
                  icon: Icons.battery_charging_full_rounded,
                  title: 'Background Battery Exemption',
                  subtitle:
                      'Prevents Android from putting the synchronization process to sleep.',
                  isGranted: _batteryOptimizationIgnored,
                  onRequest: _requestBatteryExemption,
                ),
                const SizedBox(height: 12),

                // Notifications
                _buildPermissionCard(
                  icon: Icons.notifications_active_outlined,
                  title: 'Notifications',
                  subtitle: 'Show background sync status and alerts.',
                  isGranted: _notificationGranted,
                  onRequest: _requestNotification,
                ),
                const SizedBox(height: 32),

                ElevatedButton(
                  onPressed: _smsGranted
                      ? () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                                builder: (_) => const DashboardScreen()),
                          );
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    _smsGranted
                        ? 'Proceed to Dashboard'
                        : 'Grant SMS Permission to Proceed',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: openAppSettings,
                  icon: const Icon(Icons.settings),
                  label: const Text('Open System App Settings'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPermissionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isGranted,
    required VoidCallback onRequest,
  }) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isGranted
              ? Colors.green.withOpacity(0.4)
              : theme.colorScheme.outlineVariant,
        ),
      ),
      color: isGranted
          ? Colors.green.withOpacity(0.05)
          : theme.colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isGranted
                    ? Colors.green.withOpacity(0.15)
                    : theme.colorScheme.surfaceVariant,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isGranted ? Colors.green : theme.colorScheme.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                      ),
                      if (isGranted)
                        const Icon(
                          Icons.check_circle_rounded,
                          color: Colors.green,
                          size: 20,
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (!isGranted)
                    ElevatedButton(
                      onPressed: onRequest,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        backgroundColor: theme.colorScheme.primaryContainer,
                        foregroundColor: theme.colorScheme.onPrimaryContainer,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text('Allow Permission'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

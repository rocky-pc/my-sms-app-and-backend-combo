import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/native_bridge.dart';
import '../services/sync_service.dart';
import 'dashboard_screen.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen>
    with WidgetsBindingObserver {
  bool _smsGranted = false;
  bool _phoneStateGranted = false;
  bool _notificationGranted = false;
  bool _batteryOptimizationIgnored = false;
  bool _notifListenerGranted = false;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshPermissions();
    }
  }

  Future<void> _refreshPermissions() async {
    setState(() => _checking = true);

    final sms = await Permission.sms.isGranted;
    final phone = await Permission.phone.isGranted;
    final notif = await Permission.notification.isGranted;
    final battery = await NativeBridge.isIgnoringBatteryOptimizations();
    final notifListener = await NativeBridge.isNotificationListenerEnabled();

    if (mounted) {
      setState(() {
        _smsGranted = sms;
        _phoneStateGranted = phone;
        _notificationGranted = notif;
        _batteryOptimizationIgnored = battery;
        _notifListenerGranted = notifListener;
        _checking = false;
      });
    }
  }

  Future<void> _requestNotificationListener() async {
    await NativeBridge.openNotificationListenerSettings();
  }

  Future<void> _requestSms() async {
    final status = await Permission.sms.request();
    setState(() {
      _smsGranted = status.isGranted;
    });
    if (_smsGranted) {
      // Automatically initialize 24/7 real-time background sync engine!
      await NativeBridge.startForegroundSync();
      await NativeBridge.catchUpRecentSms();
      SyncService().syncNow();
    } else {
      // If permission is not granted (e.g. Android 13/14 Restricted Settings)
      if (mounted) {
        _showRestrictedSettingsGuide(context);
      }
    }
  }

  void _showRestrictedSettingsGuide(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.lock_open_rounded, color: Colors.blueAccent, size: 40),
        title: const Text('Allow Restricted Permission', textAlign: TextAlign.center),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'On Android 13, 14, and 15, sideloaded apps require one-time approval in phone settings:',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              SizedBox(height: 12),
              Text('1. Tap "Open App Settings" below.'),
              SizedBox(height: 4),
              Text('2. Tap the 3 dots (⋮) in the top-right corner of App Info.'),
              SizedBox(height: 4),
              Text('3. Tap "Allow restricted settings".'),
              SizedBox(height: 4),
              Text('4. Confirm with your PIN or fingerprint.'),
              SizedBox(height: 4),
              Text('5. Go to Permissions → SMS → Select "Allow".'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Got it'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            icon: const Icon(Icons.settings),
            label: const Text('Open App Settings'),
          ),
        ],
      ),
    );
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
                const SizedBox(height: 12),

                // Notification Access for RCS and Person-to-Person messages
                _buildPermissionCard(
                  icon: Icons.mark_chat_unread_rounded,
                  title: 'Notification Access (RCS & Personal SMS)',
                  subtitle:
                      'Required to capture Google Messages RCS chats, personal messages, and notification alerts.',
                  isGranted: _notifListenerGranted,
                  onRequest: _requestNotificationListener,
                ),
                const SizedBox(height: 32),

                if (!_smsGranted)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.blue.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.blue.withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, color: Colors.blueAccent),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Android 13/14 restricted access? Tap the 3 dots (⋮) in App Settings to allow.',
                            style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.onSurface,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () => _showRestrictedSettingsGuide(context),
                          child: const Text('Guide', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ),

                ElevatedButton(
                  onPressed: _smsGranted
                      ? () async {
                          // Start instant 24/7 foreground sync & catch up any messages
                          await NativeBridge.startForegroundSync();
                          await NativeBridge.catchUpRecentSms();
                          SyncService().syncNow();

                          if (!context.mounted) return;
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

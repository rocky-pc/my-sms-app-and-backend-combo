import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/sms_model.dart';
import '../services/auth_service.dart';
import '../services/sync_service.dart';

class SyncStatusScreen extends StatefulWidget {
  const SyncStatusScreen({super.key});

  @override
  State<SyncStatusScreen> createState() => _SyncStatusScreenState();
}

class _SyncStatusScreenState extends State<SyncStatusScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final SyncService _syncService = SyncService();
  final AuthService _auth = AuthService();

  List<Map<String, dynamic>> _remoteLogs = [];
  bool _loadingLogs = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadRemoteLogs();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadRemoteLogs() async {
    if (!_auth.isAuthenticated) return;
    setState(() => _loadingLogs = true);
    try {
      final res = await _auth.client
          .from('sync_logs')
          .select()
          .order('created_at', ascending: false)
          .limit(30);
      setState(() {
        _remoteLogs = List<Map<String, dynamic>>.from(res);
      });
    } catch (e) {
      debugPrint('Error loading sync logs: $e');
    } finally {
      if (mounted) setState(() => _loadingLogs = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sync Status & Logs'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Local Queue'),
            Tab(text: 'Cloud Sync Logs'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              await _syncService.refreshDashboardStats();
              await _loadRemoteLogs();
            },
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildLocalQueueTab(),
          _buildCloudLogsTab(),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: ElevatedButton.icon(
            onPressed: _syncService.isSyncing
                ? null
                : () async {
                    await _syncService.syncNow();
                    await _loadRemoteLogs();
                  },
            icon: _syncService.isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.sync_rounded),
            label: Text(_syncService.isSyncing ? 'Synchronizing...' : 'Sync Pending SMS Now'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLocalQueueTab() {
    final list = _syncService.localMessages;
    if (list.isEmpty) {
      return const Center(
        child: Text('No local SMS messages captured yet.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final sms = list[index];
        final isSynced = sms.syncStatus == 'SYNCED';

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: isSynced ? Colors.green.withOpacity(0.3) : Colors.orange.withOpacity(0.4),
            ),
          ),
          child: ListTile(
            onTap: () => _showSmsDetailsDialog(sms),
            leading: CircleAvatar(
              backgroundColor: isSynced ? Colors.green.withOpacity(0.15) : Colors.orange.withOpacity(0.15),
              child: Icon(
                isSynced ? Icons.cloud_done : Icons.cloud_upload_outlined,
                color: isSynced ? Colors.green : Colors.orange,
              ),
            ),
            title: Row(
              children: [
                Text(
                  sms.sender,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    sms.simSlot,
                    style: const TextStyle(fontSize: 10),
                  ),
                ),
              ],
            ),
            subtitle: Text(
              sms.messageBody,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12),
            ),
            trailing: Text(
              DateFormat('hh:mm a').format(sms.receivedAt.toLocal()),
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCloudLogsTab() {
    if (_loadingLogs) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_remoteLogs.isEmpty) {
      return const Center(
        child: Text('No cloud synchronization logs found.'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _remoteLogs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final log = _remoteLogs[index];
        final status = log['sync_status']?.toString() ?? 'UNKNOWN';
        final synced = log['synced_count'] ?? 0;
        final failed = log['failed_count'] ?? 0;
        final createdAt = DateTime.tryParse(log['created_at']?.toString() ?? '');
        final timeStr = createdAt != null
            ? DateFormat('hh:mm a, dd MMM yyyy').format(createdAt.toLocal())
            : 'Unknown';

        final isSuccess = status == 'SUCCESS';

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.withOpacity(0.2)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(
                  isSuccess ? Icons.check_circle : Icons.warning_amber_rounded,
                  color: isSuccess ? Colors.green : Colors.amber,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Status: $status (Synced: $synced, Failed: $failed)',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        timeStr,
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showSmsDetailsDialog(SmsModel sms) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(sms.sender),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('SIM Slot: ${sms.simSlot}', style: const TextStyle(fontWeight: FontWeight.bold)),
              Text('Received: ${DateFormat('dd MMM yyyy, hh:mm:ss a').format(sms.receivedAt.toLocal())}'),
              Text('Status: ${sms.syncStatus}'),
              const SizedBox(height: 8),
              const Text('Message Hash:', style: TextStyle(fontWeight: FontWeight.bold)),
              SelectableText(
                sms.messageHash,
                style: const TextStyle(fontSize: 10, fontFamily: 'monospace'),
              ),
              const Divider(height: 20),
              const Text('Message Body:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              SelectableText(sms.messageBody),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: sms.messageBody));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Message copied to clipboard')),
              );
            },
            child: const Text('Copy Body'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}

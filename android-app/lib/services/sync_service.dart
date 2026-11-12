import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/sms_model.dart';
import 'auth_service.dart';
import 'native_bridge.dart';

class SyncService extends ChangeNotifier {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  final AuthService _auth = AuthService();
  StreamSubscription? _connectivitySubscription;
  StreamSubscription? _smsSubscription;
  StreamSubscription? _nativeSyncSubscription;

  bool _isSyncing = false;
  bool get isSyncing => _isSyncing;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  int _totalCount = 0;
  int get totalCount => _totalCount;

  int _todayCount = 0;
  int get todayCount => _todayCount;

  int _pendingCount = 0;
  int get pendingCount => _pendingCount;

  DateTime? _lastSyncTime;
  DateTime? get lastSyncTime => _lastSyncTime;

  List<SmsModel> _localMessages = [];
  List<SmsModel> get localMessages => _localMessages;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final lastSyncEpoch = prefs.getInt('last_successful_sync_epoch');
    if (lastSyncEpoch != null) {
      _lastSyncTime = DateTime.fromMillisecondsSinceEpoch(lastSyncEpoch);
    }

    // Check initial connectivity
    final connectivityResult = await Connectivity().checkConnectivity();
    _isOnline = !connectivityResult.contains(ConnectivityResult.none);

    // Listen to network changes
    _connectivitySubscription =
        Connectivity().onConnectivityChanged.listen((results) {
      final online = !results.contains(ConnectivityResult.none);
      final wasOffline = !_isOnline;
      _isOnline = online;
      notifyListeners();

      if (wasOffline && _isOnline && _auth.isAuthenticated) {
        // Automatically sync pending messages when internet returns!
        syncNow();
      }
    });

    // Listen to incoming SMS from native BroadcastReceiver
    _smsSubscription = NativeBridge.onSmsReceived.listen((sms) async {
      _pendingCount++;
      _localMessages.insert(0, sms);
      notifyListeners();

      // Trigger automatic sync if online and authenticated
      if (_isOnline && _auth.isAuthenticated) {
        await syncNow();
      } else {
        await refreshDashboardStats();
      }
    });

    // Listen to native worker completions
    _nativeSyncSubscription =
        NativeBridge.onSyncCompleted.listen((result) async {
      await refreshDashboardStats();
    });

    await refreshDashboardStats();
  }

  Future<void> refreshDashboardStats() async {
    final counts = await NativeBridge.getLocalCounts();
    _totalCount = counts['total'] ?? 0;
    _pendingCount = counts['pending'] ?? 0;
    _todayCount = counts['today'] ?? 0;

    _localMessages = await NativeBridge.getLocalMessages(limit: 50);

    // If authenticated, also fetch count from Supabase for sync verification
    if (_auth.isAuthenticated && _isOnline) {
      try {
        final remoteCount = await _auth.client
            .from('sms_messages')
            .count(CountOption.exact);
        if (remoteCount > _totalCount) {
          _totalCount = remoteCount;
        }
      } catch (e) {
        // fallback to local counts
      }
    }

    notifyListeners();
  }

  Future<bool> syncNow() async {
    if (_isSyncing) return false;
    _isSyncing = true;
    notifyListeners();

    int synced = 0;
    int failed = 0;

    try {
      if (!_auth.isAuthenticated) {
        _isSyncing = false;
        notifyListeners();
        return false;
      }

      final user = _auth.currentUser!;
      final pendingList = await NativeBridge.getLocalMessages(limit: 100);
      final pendingToUpload =
          pendingList.where((m) => m.syncStatus == 'PENDING').toList();

      for (final msg in pendingToUpload) {
        try {
          var body = msg.messageBody;
          if (_auth.filterSensitive) {
            body = body.replaceAll(RegExp(r'\b\d{4,8}\b'), '[REDACTED OTP]');
          }

          await _auth.client.from('sms_messages').upsert(
            {
              'user_id': user.id,
              if (_auth.deviceId != null) 'device_id': _auth.deviceId,
              'sender': msg.sender,
              'message_body': body,
              'received_at': msg.receivedAt.toUtc().toIso8601String(),
              'sim_slot': msg.simSlot,
              'message_hash': msg.messageHash,
            },
            onConflict: 'user_id,message_hash',
          );

          await NativeBridge.markMessageSynced(msg.messageHash);
          synced++;
        } catch (e) {
          debugPrint('Upload failure for hash ${msg.messageHash}: $e');
          failed++;
        }
      }

      // Also trigger native WorkManager so OS handles any missed items
      await NativeBridge.triggerSyncNow();

      if (synced > 0 || (failed == 0 && pendingToUpload.isEmpty)) {
        _lastSyncTime = DateTime.now();
        final prefs = await SharedPreferences.getInstance();
        await prefs.setInt(
            'last_successful_sync_epoch', _lastSyncTime!.millisecondsSinceEpoch);

        // Update device record
        if (_auth.deviceId != null) {
          try {
            await _auth.client.from('devices').update({
              'last_sync_at': _lastSyncTime!.toUtc().toIso8601String(),
            }).eq('id', _auth.deviceId!);
          } catch (_) {}
        }

        // Record sync log
        if (synced > 0 || failed > 0) {
          try {
            await _auth.client.from('sync_logs').insert({
              'user_id': user.id,
              if (_auth.deviceId != null) 'device_id': _auth.deviceId,
              'sync_status': failed == 0
                  ? 'SUCCESS'
                  : (synced > 0 ? 'PARTIAL' : 'FAILED'),
              'synced_count': synced,
              'failed_count': failed,
            });
          } catch (_) {}
        }
      }
    } catch (e) {
      debugPrint('SyncNow error: $e');
    } finally {
      _isSyncing = false;
      await refreshDashboardStats();
      notifyListeners();
    }

    return synced > 0 || failed == 0;
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _smsSubscription?.cancel();
    _nativeSyncSubscription?.cancel();
    super.dispose();
  }
}

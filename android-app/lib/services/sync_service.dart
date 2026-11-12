import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/sms_model.dart';
import 'auth_service.dart';
import 'native_bridge.dart';

class SyncResult {
  final bool success;
  final String message;
  final int synced;
  final int failed;
  final int pending;

  SyncResult({
    required this.success,
    required this.message,
    this.synced = 0,
    this.failed = 0,
    this.pending = 0,
  });
}

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
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      _isOnline = !connectivityResult.contains(ConnectivityResult.none);
    } catch (_) {
      _isOnline = true;
    }

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

  Future<SyncResult> syncNow() async {
    if (_isSyncing) {
      return SyncResult(
        success: false,
        message: 'A synchronization is already in progress.',
      );
    }
    _isSyncing = true;
    notifyListeners();

    int synced = 0;
    int failed = 0;
    String? errorMessage;

    try {
      if (!_auth.isAuthenticated) {
        return SyncResult(
          success: false,
          message: 'Please log in to synchronize messages.',
        );
      }

      final user = _auth.currentUser!;

      // Ensure device registration is active
      if (_auth.deviceId == null) {
        await _auth.registerDeviceAgain();
      }

      final pendingList = await NativeBridge.getLocalMessages(limit: 100);
      final pendingToUpload =
          pendingList.where((m) => m.syncStatus == 'PENDING').toList();

      if (pendingToUpload.isEmpty) {
        _lastSyncTime = DateTime.now();
        final prefs = await SharedPreferences.getInstance();
        await prefs.setInt(
            'last_successful_sync_epoch', _lastSyncTime!.millisecondsSinceEpoch);

        if (_auth.deviceId != null) {
          try {
            await _auth.client.from('devices').update({
              'last_sync_at': _lastSyncTime!.toUtc().toIso8601String(),
            }).eq('id', _auth.deviceId!);
          } catch (_) {}
        }

        // Trigger native worker so WorkManager is synchronized
        await NativeBridge.triggerSyncNow();

        return SyncResult(
          success: true,
          message: 'All messages are up to date (0 pending).',
          pending: 0,
        );
      }

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
          errorMessage = e.toString().replaceAll('PostgrestException', '').replaceAll('Exception: ', '').trim();
          failed++;
        }
      }

      // Also trigger native WorkManager so OS handles any missed items
      await NativeBridge.triggerSyncNow();

      if (synced > 0) {
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
        try {
          await _auth.client.from('sync_logs').insert({
            'user_id': user.id,
            if (_auth.deviceId != null) 'device_id': _auth.deviceId,
            'sync_status': failed == 0 ? 'SUCCESS' : 'PARTIAL',
            'synced_count': synced,
            'failed_count': failed,
          });
        } catch (_) {}

        return SyncResult(
          success: true,
          message: failed == 0
              ? 'Successfully synced $synced message(s)!'
              : 'Synced $synced message(s), $failed failed.',
          synced: synced,
          failed: failed,
        );
      } else {
        return SyncResult(
          success: false,
          message: errorMessage != null
              ? 'Sync failed: $errorMessage'
              : 'Sync failed: check network connection',
          failed: failed,
        );
      }
    } catch (e) {
      debugPrint('SyncNow error: $e');
      return SyncResult(
        success: false,
        message: 'Sync error: ${e.toString().replaceAll('Exception: ', '')}',
      );
    } finally {
      _isSyncing = false;
      await refreshDashboardStats();
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _smsSubscription?.cancel();
    _nativeSyncSubscription?.cancel();
    super.dispose();
  }
}

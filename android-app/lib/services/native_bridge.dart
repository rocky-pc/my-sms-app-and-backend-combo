import 'dart:async';
import 'package:flutter/services.dart';
import '../models/sms_model.dart';

class NativeBridge {
  static const MethodChannel _channel =
      MethodChannel('com.jegathesh.mysms/sms_bridge');

  static final StreamController<SmsModel> _smsStreamController =
      StreamController<SmsModel>.broadcast();
  static final StreamController<Map<String, int>> _syncStreamController =
      StreamController<Map<String, int>>.broadcast();

  static Stream<SmsModel> get onSmsReceived => _smsStreamController.stream;
  static Stream<Map<String, int>> get onSyncCompleted =>
      _syncStreamController.stream;

  static void initialize() {
    _channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'onSmsReceived':
          if (call.arguments is Map) {
            final sms = SmsModel.fromNativeMap(call.arguments as Map);
            _smsStreamController.add(sms);
          }
          break;
        case 'onSyncCompleted':
          if (call.arguments is Map) {
            final map = Map<String, dynamic>.from(call.arguments as Map);
            _syncStreamController.add({
              'synced': map['synced'] ?? 0,
              'failed': map['failed'] ?? 0,
            });
          }
          break;
      }
    });
  }

  static Future<String> getInstallationId() async {
    try {
      final String? id = await _channel.invokeMethod('getInstallationId');
      return id ?? 'unknown-device-id';
    } catch (e) {
      return 'fallback-device-id';
    }
  }

  static Future<bool> saveCredentials({
    required String supabaseUrl,
    required String supabaseAnonKey,
    required String accessToken,
    required String refreshToken,
    required String userId,
    required String? deviceId,
    required bool filterSensitive,
  }) async {
    try {
      final bool? res = await _channel.invokeMethod('saveCredentials', {
        'supabaseUrl': supabaseUrl,
        'supabaseAnonKey': supabaseAnonKey,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'userId': userId,
        'deviceId': deviceId ?? '',
        'filterSensitive': filterSensitive,
      });
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> clearCredentials() async {
    try {
      final bool? res = await _channel.invokeMethod('clearCredentials');
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> triggerSyncNow() async {
    try {
      final bool? res = await _channel.invokeMethod('triggerSyncNow');
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<Map<String, int>> getLocalCounts() async {
    try {
      final Map? res = await _channel.invokeMethod('getLocalCounts');
      if (res != null) {
        return {
          'total': res['total'] ?? 0,
          'pending': res['pending'] ?? 0,
          'today': res['today'] ?? 0,
        };
      }
    } catch (e) {
      // ignore
    }
    return {'total': 0, 'pending': 0, 'today': 0};
  }

  static Future<List<SmsModel>> getLocalMessages({int limit = 100}) async {
    try {
      final List? res =
          await _channel.invokeMethod('getLocalMessages', {'limit': limit});
      if (res != null) {
        return res
            .map((item) => SmsModel.fromNativeMap(Map.from(item as Map)))
            .toList();
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  static Future<bool> markMessageSynced(String messageHash) async {
    try {
      final bool? res = await _channel.invokeMethod(
          'markMessageSynced', {'messageHash': messageHash});
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> startForegroundSync() async {
    try {
      final bool? res = await _channel.invokeMethod('startForegroundSync');
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<int> catchUpRecentSms() async {
    try {
      final int? count = await _channel.invokeMethod('catchUpRecentSms');
      return count ?? 0;
    } catch (e) {
      return 0;
    }
  }

  static Future<bool> isIgnoringBatteryOptimizations() async {
    try {
      final bool? res =
          await _channel.invokeMethod('isIgnoringBatteryOptimizations');
      return res ?? true;
    } catch (e) {
      return true;
    }
  }

  static Future<bool> requestIgnoreBatteryOptimizations() async {
    try {
      final bool? res =
          await _channel.invokeMethod('requestIgnoreBatteryOptimizations');
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> isNotificationListenerEnabled() async {
    try {
      final bool? res =
          await _channel.invokeMethod('isNotificationListenerEnabled');
      return res ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> openNotificationListenerSettings() async {
    try {
      final bool? res =
          await _channel.invokeMethod('openNotificationListenerSettings');
      return res ?? false;
    } catch (e) {
      return false;
    }
  }
}

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../config/supabase_config.dart';
import 'native_bridge.dart';

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  SupabaseClient get client => Supabase.instance.client;
  User? get currentUser => client.auth.currentUser;
  bool get isAuthenticated => currentUser != null;

  String? _deviceId;
  String? get deviceId => _deviceId;

  String? _installationId;
  String? get installationId => _installationId;

  String _deviceName = 'Android Device';
  String get deviceName => _deviceName;

  bool _filterSensitive = false;
  bool get filterSensitive => _filterSensitive;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString('saved_device_id');
    _filterSensitive = prefs.getBool('filter_sensitive') ?? false;

    _installationId = await NativeBridge.getInstallationId();
    await _detectDeviceName();

    client.auth.onAuthStateChange.listen((data) async {
      final session = data.session;
      if (session != null) {
        await _registerDeviceAndSyncCredentials(session);
      } else {
        await NativeBridge.clearCredentials();
      }
      notifyListeners();
    });

    if (isAuthenticated && client.auth.currentSession != null) {
      await _registerDeviceAndSyncCredentials(client.auth.currentSession!);
    }
  }

  Future<void> _detectDeviceName() async {
    try {
      if (Platform.isAndroid) {
        final deviceInfo = DeviceInfoPlugin();
        final androidInfo = await deviceInfo.androidInfo;
        final manufacturer = androidInfo.manufacturer;
        final model = androidInfo.model;
        _deviceName = '$manufacturer $model'.trim();
      }
    } catch (e) {
      _deviceName = 'Android Device';
    }
  }

  Future<void> setFilterSensitive(bool value) async {
    _filterSensitive = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('filter_sensitive', value);

    if (isAuthenticated && client.auth.currentSession != null) {
      await _syncNativeCredentials(client.auth.currentSession!);
    }
    notifyListeners();
  }

  Future<void> signIn({required String email, required String password}) async {
    final response = await client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
    if (response.session != null) {
      await _registerDeviceAndSyncCredentials(response.session!);
    }
    notifyListeners();
  }

  Future<void> signUp({required String email, required String password}) async {
    final response = await client.auth.signUp(
      email: email.trim(),
      password: password,
    );
    if (response.session != null) {
      await _registerDeviceAndSyncCredentials(response.session!);
    }
    notifyListeners();
  }

  Future<void> signOut() async {
    await client.auth.signOut();
    await NativeBridge.clearCredentials();
    notifyListeners();
  }

  Future<void> _registerDeviceAndSyncCredentials(Session session) async {
    final user = session.user;
    final installId = _installationId ?? await NativeBridge.getInstallationId();

    try {
      // Upsert device record in Supabase
      final response = await client
          .from('devices')
          .upsert(
            {
              'user_id': user.id,
              'device_name': _deviceName,
              'installation_id': installId,
              'last_sync_at': DateTime.now().toUtc().toIso8601String(),
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            },
            onConflict: 'user_id,installation_id',
          )
          .select('id')
          .single();

      _deviceId = response['id']?.toString();
      final prefs = await SharedPreferences.getInstance();
      if (_deviceId != null) {
        await prefs.setString('saved_device_id', _deviceId!);
      }
    } catch (e) {
      debugPrint('Device registration error: $e');
    }

    await _syncNativeCredentials(session);
  }

  Future<void> _syncNativeCredentials(Session session) async {
    await NativeBridge.saveCredentials(
      supabaseUrl: SupabaseConfig.url,
      supabaseAnonKey: SupabaseConfig.anonKey,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? '',
      userId: session.user.id,
      deviceId: _deviceId,
      filterSensitive: _filterSensitive,
    );
  }
}

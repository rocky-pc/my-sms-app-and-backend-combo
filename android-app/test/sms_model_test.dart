import 'package:flutter_test/flutter_test.dart';
import 'package:mysms/models/sms_model.dart';

void main() {
  group('SmsModel Tests', () {
    test('Correctly parses from native Android map', () {
      final nowMillis = DateTime.now().millisecondsSinceEpoch;
      final nativeMap = {
        'id': 1,
        'sender': '+1234567890',
        'message_body': 'Your verification code is 492810. Do not share.',
        'received_at': nowMillis,
        'sim_slot': 'SIM 1',
        'message_hash': 'abc123hash',
        'sync_status': 'PENDING',
        'created_at': nowMillis,
      };

      final sms = SmsModel.fromNativeMap(nativeMap);

      expect(sms.localId, 1);
      expect(sms.sender, '+1234567890');
      expect(sms.messageBody, 'Your verification code is 492810. Do not share.');
      expect(sms.simSlot, 'SIM 1');
      expect(sms.messageHash, 'abc123hash');
      expect(sms.syncStatus, 'PENDING');
    });

    test('Correctly serializes to Supabase JSON payload', () {
      final receivedAt = DateTime.utc(2026, 11, 12, 14, 30, 0);
      final sms = SmsModel(
        localId: 42,
        sender: 'BANK-ALERT',
        messageBody: 'INR 5,000 debited from A/C XX1234 on 12-Nov-26.',
        receivedAt: receivedAt,
        simSlot: 'SIM 2',
        messageHash: 'mock_hash_xyz',
        syncStatus: 'PENDING',
      );

      final json = sms.toSupabaseJson(
        userId: 'user-uuid-1234',
        deviceId: 'device-uuid-5678',
      );

      expect(json['user_id'], 'user-uuid-1234');
      expect(json['device_id'], 'device-uuid-5678');
      expect(json['sender'], 'BANK-ALERT');
      expect(json['message_body'], 'INR 5,000 debited from A/C XX1234 on 12-Nov-26.');
      expect(json['received_at'], '2026-11-12T14:30:00.000Z');
      expect(json['sim_slot'], 'SIM 2');
      expect(json['message_hash'], 'mock_hash_xyz');
    });

    test('Handles missing SIM slot with fallback', () {
      final nativeMap = {
        'sender': 'PROMO',
        'message_body': '50% off on your next purchase!',
        'received_at': 1700000000000,
        'message_hash': 'promohash',
      };

      final sms = SmsModel.fromNativeMap(nativeMap);
      expect(sms.simSlot, 'SIM 1');
      expect(sms.syncStatus, 'PENDING');
    });
  });

  group('Sensitive OTP & Banking Redaction Tests', () {
    test('Regex correctly redacts 4 to 8 digit OTP codes', () {
      const input = 'Your secret OTP for transaction is 849201. Valid for 10 mins.';
      final redacted = input.replaceAll(RegExp(r'\b\d{4,8}\b'), '[REDACTED OTP]');
      expect(redacted, 'Your secret OTP for transaction is [REDACTED OTP]. Valid for 10 mins.');
    });

    test('Does not redact standard short numbers or dates', () {
      const input = 'Account balance is \$50 on 12/11/26.';
      final redacted = input.replaceAll(RegExp(r'\b\d{4,8}\b'), '[REDACTED OTP]');
      // 50 is 2 digits, 12, 11, 26 are 2 digits -> should not match \b\d{4,8}\b
      expect(redacted, 'Account balance is \$50 on 12/11/26.');
    });
  });
}

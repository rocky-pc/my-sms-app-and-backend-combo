class SmsModel {
  final int? localId;
  final String? remoteId;
  final String sender;
  final String messageBody;
  final DateTime receivedAt;
  final String simSlot;
  final String messageHash;
  final String syncStatus; // 'PENDING', 'SYNCED', 'FAILED'
  final DateTime? createdAt;

  SmsModel({
    this.localId,
    this.remoteId,
    required this.sender,
    required this.messageBody,
    required this.receivedAt,
    required this.simSlot,
    required this.messageHash,
    required this.syncStatus,
    this.createdAt,
  });

  factory SmsModel.fromNativeMap(Map<dynamic, dynamic> map) {
    return SmsModel(
      localId: (map['id'] is int)
          ? map['id']
          : int.tryParse(map['id']?.toString() ?? ''),
      sender: map['sender']?.toString() ?? 'Unknown',
      messageBody: map['message_body']?.toString() ?? '',
      receivedAt: DateTime.fromMillisecondsSinceEpoch(
        (map['received_at'] is int)
            ? map['received_at']
            : int.tryParse(map['received_at']?.toString() ?? '0') ?? 0,
        isUtc: true,
      ),
      simSlot: map['sim_slot']?.toString() ?? 'SIM 1',
      messageHash: map['message_hash']?.toString() ?? '',
      syncStatus: map['sync_status']?.toString() ?? 'PENDING',
      createdAt: map['created_at'] != null
          ? DateTime.fromMillisecondsSinceEpoch(
              (map['created_at'] is int)
                  ? map['created_at']
                  : int.tryParse(map['created_at']?.toString() ?? '0') ?? 0,
              isUtc: true,
            )
          : null,
    );
  }

  factory SmsModel.fromSupabase(Map<String, dynamic> json) {
    return SmsModel(
      remoteId: json['id']?.toString(),
      sender: json['sender']?.toString() ?? 'Unknown',
      messageBody: json['message_body']?.toString() ?? '',
      receivedAt: DateTime.tryParse(json['received_at']?.toString() ?? '') ??
          DateTime.now(),
      simSlot: json['sim_slot']?.toString() ?? 'SIM 1',
      messageHash: json['message_hash']?.toString() ?? '',
      syncStatus: 'SYNCED',
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toSupabaseJson({
    required String userId,
    String? deviceId,
  }) {
    return {
      'user_id': userId,
      if (deviceId != null) 'device_id': deviceId,
      'sender': sender,
      'message_body': messageBody,
      'received_at': receivedAt.toUtc().toIso8601String(),
      'sim_slot': simSlot,
      'message_hash': messageHash,
    };
  }
}

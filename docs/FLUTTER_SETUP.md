# Flutter Android Application Setup & Native Integration

This document details the configuration, permissions, background synchronization engine, and architecture of the **MySMS** Android application (`com.jegathesh.mysms`).

---

## 1. Android Manifest Permissions

The application requires specific permissions configured in `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Intercept incoming SMS broadcasts -->
<uses-permission android:name="android.permission.RECEIVE_SMS" />

<!-- Read multi-SIM subscription information to identify SIM 1 / SIM 2 -->
<uses-permission android:name="android.permission.READ_PHONE_STATE" />

<!-- Network connectivity for Supabase REST API & Realtime -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Reschedule sync worker on device reboot -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Android 13+ background notification alerts -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Keep CPU awake during WorkManager sync task -->
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Prompt exemption from OEM battery killers (Doze mode) -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

---

## 2. Native SMS Receiver (`SmsReceiver.kt`)

The receiver registers high priority (`priority="999"`) on `android.provider.Telephony.SMS_RECEIVED`:

### Key Implementation Details:
1. **Multipart SMS Assembly**: Uses `Telephony.Sms.Intents.getMessagesFromIntent(intent)` to assemble split SMS fragments by sender into a single contiguous string.
2. **SIM Slot Detection**: Resolves active subscription ID via `SubscriptionManager.getActiveSubscriptionInfo(subId)` to detect `SIM 1` vs `SIM 2`.
3. **Message Hashing**:
   Computes SHA-256 digest:
   ```kotlin
   val hash = MessageDigest.getInstance("SHA-256")
       .digest("$sender|$timestampMillis|$messageBody".toByteArray(Charsets.UTF_8))
       .joinToString("") { "%02x".format(it) }
   ```
4. **Immediate Offline Staging**: Inserts the message with status `PENDING` into the local SQLite database (`mysms.db`) inside `SmsDatabaseHelper`.
5. **WorkManager Trigger**: Automatically enqueues a `OneTimeWorkRequestBuilder<SmsSyncWorker>` constrained to active network connectivity (`NetworkType.CONNECTED`).

---

## 3. Background Synchronization Worker (`SmsSyncWorker.kt`)

Inherits from `androidx.work.CoroutineWorker`:
- Reads un-synced rows (`sync_status = 'PENDING'`) from local SQLite.
- Extracts stored authentication credentials from `MySmsSecurePrefs`.
- Performs client-side sensitive keyword checking (e.g. masking numeric OTP codes).
- Posts payload to Supabase PostgREST endpoint:
  ```http
  POST /rest/v1/sms_messages
  Authorization: Bearer <user_access_token>
  apikey: <supabase_anon_key>
  Prefer: resolution=merge-duplicates
  ```
- Handles HTTP 401 token expiration by invoking Supabase token refresh endpoint (`/auth/v1/token?grant_type=refresh_token`).
- On HTTP 200/201/409, marks local message as `SYNCED`.
- Updates device last active timestamp in `devices` table and writes audit record in `sync_logs`.

---

## 4. Flutter Dart Services

- `NativeBridge`: Bidirectional `MethodChannel` (`com.jegathesh.mysms/sms_bridge`) for live SMS alerts when the UI is open.
- `AuthService`: Supabase session management, device registration, and native credential synchronization.
- `SyncService`: Manages connectivity changes (`connectivity_plus`), manual `Sync Now` triggers, and local queue stats.

---

## 5. Building the Application

### Debug Build:
```bash
cd android-app
flutter build apk --debug
```

### Release Build:
```bash
cd android-app
flutter build apk --release
```

The resulting output APK is saved to:
`android-app/build/app/outputs/flutter-apk/app-release.apk`

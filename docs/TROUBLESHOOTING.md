# Troubleshooting & Frequently Asked Questions (FAQ)

This guide covers common issues and resolutions for the **MySMS** system.

---

## 1. Android Application Issues

### Issue: New incoming SMS is not appearing in the app.
- **Cause 1: Missing `RECEIVE_SMS` Permission.**
  - *Fix*: Go to **Settings -> Apps -> MySMS -> Permissions** and ensure **SMS** permission is set to **Allow**.
- **Cause 2: Aggressive Battery Management (Doze Mode).**
  - *Fix*: Device manufacturers (e.g. Xiaomi, Samsung, Huawei, OnePlus) aggressively kill background processes. In the MySMS app, navigate to **Permissions Screen** and tap **Exempt from Battery Optimization**, or set the app's battery usage to **Unrestricted** in Android system settings.
- **Cause 3: Default SMS App Conflicts.**
  - *Fix*: On Android 4.4+, standard apps can listen to `android.provider.Telephony.SMS_RECEIVED` without being the default SMS app. Ensure your default SMS app is not silencing broadcasts or blocking third-party receivers.

### Issue: Pending messages are queued locally but not uploading.
- **Cause 1: Network Unavailable or Airplane Mode.**
  - *Fix*: The app queues messages in the local SQLite database (`mysms.db`). Once internet connectivity returns, the sync worker triggers automatically. You can also tap **Sync Now** manually on the dashboard.
- **Cause 2: Expired Supabase Session.**
  - *Fix*: If the refresh token has expired or credentials were reset, sign out and sign back in to regenerate a valid session JWT.

### Issue: SIM slot displays "Unknown" or "SIM 1" for SIM 2.
- **Cause: Missing Phone State Permission.**
  - *Fix*: On multi-SIM devices, `android.permission.READ_PHONE_STATE` is required for Android's `SubscriptionManager` to determine whether slot index is `0` or `1`. Grant this permission in the Permissions screen.

---

## 2. Web Dashboard Issues

### Issue: Realtime indicator says "Fallback Polling" instead of "Realtime Live".
- **Cause: Supabase Realtime WebSocket Connection.**
  - *Explanation*: If network firewalls or browser extensions block WebSocket connections, MySMS automatically activates an internal 20-second fallback polling mechanism so you never miss messages.
  - *Fix*: Verify that your Supabase project publication includes the `sms_messages` table:
    ```sql
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
    ```

### Issue: Dashboard shows 0 messages after login.
- **Cause 1: Different Account Used on Mobile vs Web.**
  - *Fix*: Verify that the email and password you used to log in on the Web Dashboard match the credentials on your Android device. Supabase Row Level Security strictly isolates each user's records.
- **Cause 2: No incoming messages have arrived yet.**
  - *Explanation*: MySMS only synchronizes **new** incoming SMS received while the app is active. It does not scan your historical inbox. Send a test SMS to your phone to trigger a sync.

---

## 3. Database & Supabase Issues

### Issue: `403 Forbidden` or `new row violates row-level security policy for table "sms_messages"`
- **Cause: Missing or incorrect RLS Policy.**
  - *Fix*: Ensure RLS policy permits insert where `auth.uid() = user_id`:
    ```sql
    CREATE POLICY "Users can insert their own messages" 
      ON public.sms_messages FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    ```

### Issue: Duplicate messages error (409 Conflict)
- **Explanation**: This is expected behavior. The database uses `UNIQUE(user_id, message_hash)` to protect against duplicate uploads. When the Android sync worker receives HTTP 409, it safely marks the local record as `SYNCED` and continues.

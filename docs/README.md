# MySMS – Personal SMS Synchronization System

**MySMS** is a private, production-grade personal SMS synchronization system engineered specifically for single-user personal device management. 

When an incoming SMS arrives on your personal Android device, the native background engine captures the SMS metadata and content, stores it in an offline SQLite transaction queue, and securely synchronizes it to your Supabase PostgreSQL cloud database. You can instantly access, search, and manage your synchronized messages from anywhere via the secure React web dashboard.

---

## 🌟 Key Features

### 📱 Android Application (Flutter + Kotlin)
- **Direct SMS Capture**: Uses Android's native `android.provider.Telephony.SMS_RECEIVED` broadcast receiver.
- **Multipart SMS Assembly**: Automatically concatenates split multipart SMS messages into a single complete text.
- **Offline Resilient Queue**: Retains captured SMS in a local SQLite database (`mysms.db`) with zero message loss if airplane mode or network interruption occurs.
- **AndroidX WorkManager Sync**: Guaranteed background execution adhering strictly to modern Android battery restrictions.
- **Deduplication Engine**: Generates unique SHA-256 hashes (`sender|timestamp|body`) preventing redundant uploads.
- **Multi-SIM Support**: Detects SIM slot information (`SIM 1` vs `SIM 2`) using Android `SubscriptionManager`.
- **Sensitive Data Redaction**: Optional toggle to mask 4–8 digit verification codes for financial alerts and 2FA OTPs before cloud transmission.
- **Zero Surveillance**: Does **not** read historical inbox, does **not** read outgoing SMS, and does **not** inspect other app notifications (WhatsApp, Telegram, etc.).

### 💻 Web Dashboard (React + TypeScript + Vite + Tailwind CSS)
- **Real-Time Live Updates**: Instant UI streaming via Supabase Realtime with fallback polling.
- **KPI Metrics**: Total messages, today's messages, this week's activity, device connectivity.
- **All Messages Table**:
  - Live search across sender phone numbers and message content.
  - Date filtering (Today, Last 7 Days, Last 30 Days, All Dates).
  - Sorting (Newest/Oldest) and customizable pagination (10, 25, 50, 100).
  - Message details modal with full raw JSON view and single-click clipboard copy.
  - CSV and JSON export buttons.
  - Permanent individual and bulk deletion options with confirmation dialogs.
- **Devices & Audit Logs**: Detailed list of registered devices and background sync execution logs.
- **Security & Privacy Center**: Password updates and automated Row Level Security (RLS) health status.
- **Responsive Theme**: Dark/Light mode toggle with desktop sidebar and mobile navigation drawer.

---

## 🏗️ Architecture

```
                                    +-----------------------------+
                                    |     Android Telecom OS      |
                                    +--------------+--------------+
                                                   | (SMS_RECEIVED)
                                                   v
+-----------------------------------------------------------------------------------------+
| MySMS Android App (Package: com.jegathesh.mysms)                                         |
|                                                                                         |
|  +------------------------+      +------------------------+      +--------------------+ |
|  |     SmsReceiver        | ---> |    SmsDatabaseHelper   | <--- |   SmsSyncWorker    | |
|  | (BroadcastReceiver)    |      | (Local SQLite Queue)   |      | (WorkManager BG)   | |
|  +-----------+------------+      +------------------------+      +---------+----------+ |
|              | (MethodChannel)                                             |            |
|              v                                                             | (HTTPS)    |
|  +------------------------+                                                |            |
|  |   Flutter UI Layer     | -----------------------------------------------+            |
|  +------------------------+                                                             |
+----------------------------------------------------------------------------|------------+
                                                                             |
                                                                             v
+-----------------------------------------------------------------------------------------+
| Supabase Backend                                                                        |
|                                                                                         |
|  - PostgreSQL Database (Tables: sms_messages, devices, sync_logs, mysms_profiles)      |
|  - Supabase Auth (JWT Session Management)                                               |
|  - Row Level Security (RLS Policies: auth.uid() = user_id)                               |
|  - Realtime Engine (supabase_realtime publication)                                      |
+----------------------------------------------------------------------------+------------+
                                                                             ^
                                                                             | (Realtime & REST)
+----------------------------------------------------------------------------|------------+
| Web Dashboard (React 19 + TypeScript + Vite + Tailwind CSS)                             |
|                                                                                         |
|  - Deployed on Vercel                                                                   |
|  - HTTPS Secure Communication                                                           |
|  - Live WebSocket Stream + 20s Resilient Fallback Polling                               |
+-----------------------------------------------------------------------------------------+
```

---

## 📁 Repository Structure

```
MySMS/
├── android-app/             # Flutter & Kotlin Android application
│   ├── android/             # Native Android source & Gradle configs
│   │   └── app/src/main/kotlin/com/jegathesh/mysms/
│   │       ├── MainActivity.kt
│   │       ├── SmsReceiver.kt
│   │       ├── SmsSyncWorker.kt
│   │       ├── SmsDatabaseHelper.kt
│   │       └── BootReceiver.kt
│   ├── lib/                 # Flutter Dart code (Screens, Services, Models)
│   └── pubspec.yaml
├── web-dashboard/           # React + TypeScript + Vite Web Dashboard
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Auth and Theme providers
│   │   ├── pages/           # Dashboard, All Messages, Devices, Settings, Security
│   │   └── lib/supabase.ts  # Supabase client configuration
│   └── package.json
├── supabase/
│   └── migrations/          # PostgreSQL DDL, RLS policies, triggers
└── docs/                    # Complete architectural & operational documentation
    ├── INSTALLATION.md
    ├── FLUTTER_SETUP.md
    ├── SUPABASE_SETUP.md
    ├── VERCEL_DEPLOYMENT.md
    ├── SECURITY.md
    └── TROUBLESHOOTING.md
```

---

## 🚀 Quick Links
- [Installation Guide](file:///e:/MSG-Teller/docs/INSTALLATION.md)
- [Flutter App Setup](file:///e:/MSG-Teller/docs/FLUTTER_SETUP.md)
- [Supabase Setup & Schema](file:///e:/MSG-Teller/docs/SUPABASE_SETUP.md)
- [Vercel Deployment Guide](file:///e:/MSG-Teller/docs/VERCEL_DEPLOYMENT.md)
- [Security & Privacy Advisory](file:///e:/MSG-Teller/docs/SECURITY.md)
- [Troubleshooting & FAQ](file:///e:/MSG-Teller/docs/TROUBLESHOOTING.md)

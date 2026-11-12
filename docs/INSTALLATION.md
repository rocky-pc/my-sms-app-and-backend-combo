# MySMS Installation & Setup Guide

This guide walks you through setting up and running all components of the MySMS synchronization system.

---

## 1. Prerequisites

Ensure your development environment contains:
- **Node.js**: v18.0.0 or newer (tested on v24.14.0)
- **npm**: v9.0.0 or newer
- **Flutter SDK**: 3.20+ or newer (tested on 3.47.0 / Dart 3.13.0)
- **Android SDK**: API 34+ (tested with Android SDK 36.1.0 and Java 17)
- **Supabase Account**: With an active project.

---

## 2. Supabase Backend Setup

1. Open your Supabase project dashboard.
2. In the **SQL Editor**, run the schema migration provided in:
   [`supabase/migrations/20261112000000_create_mysms_schema.sql`](file:///e:/MSG-Teller/supabase/migrations/20261112000000_create_mysms_schema.sql)
3. Ensure the following tables are present:
   - `mysms_profiles`
   - `devices`
   - `sms_messages`
   - `sync_logs`
4. Confirm Row Level Security (RLS) is enabled on all tables.
5. In **Database -> Publications**, ensure `supabase_realtime` includes `sms_messages` and `devices`.
6. Retrieve your Project URL and Publishable Anon Key from **Project Settings -> API**.

---

## 3. Web Dashboard Installation

1. Navigate to the web dashboard folder:
   ```bash
   cd web-dashboard
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```
   The compiled static files are generated in `dist/`.

---

## 4. Android Flutter Application Installation

1. Navigate to the Android application folder:
   ```bash
   cd android-app
   ```
2. Fetch dependencies:
   ```bash
   flutter pub get
   ```
3. Verify your Supabase URL and Anon Key in `lib/config/supabase_config.dart`.
4. Build the release APK:
   ```bash
   flutter build apk --release
   ```
5. Install on your Android phone:
   ```bash
   adb install -r build/app/outputs/flutter-apk/app-release.apk
   ```
   *Or transfer the APK file directly to your smartphone and install using the file manager.*
6. Grant permissions on first launch:
   - Tap **Allow Permission** for **Receive SMS**.
   - Tap **Allow Permission** for **Phone State** (SIM slot detection).
   - Exempt the app from **Battery Optimization** to ensure Android WorkManager operates in sleep states.
7. Sign in with the same email and password used on the Web Dashboard.

---

## 5. End-to-End Verification

1. Keep the Web Dashboard open on your computer or browser.
2. Send a test SMS to your smartphone from another device or carrier.
3. Observe:
   - Android App displays the new incoming SMS immediately.
   - Sync engine automatically uploads the record to Supabase.
   - Web Dashboard updates in real-time with the new message and increments KPI counters.

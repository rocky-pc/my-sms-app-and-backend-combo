package com.jegathesh.mysms

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import android.util.Log
import androidx.annotation.NonNull
import androidx.work.*
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class MainActivity : FlutterActivity() {

    companion object {
        const val CHANNEL = "com.jegathesh.mysms/sms_bridge"
        private const val TAG = "MySMS_MainActivity"
        private var methodChannel: MethodChannel? = null

        fun notifySmsReceived(smsData: Map<String, Any?>) {
            methodChannel?.invokeMethod("onSmsReceived", smsData)
        }

        fun notifySyncCompleted(syncedCount: Int, failedCount: Int) {
            methodChannel?.invokeMethod("onSyncCompleted", mapOf(
                "synced" to syncedCount,
                "failed" to failedCount
            ))
        }
    }

    private val activityScope = CoroutineScope(Dispatchers.IO)

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)

        val dbHelper = SmsDatabaseHelper(applicationContext)

        methodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "getInstallationId" -> {
                    val prefs = applicationContext.getSharedPreferences(SmsSyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                    var installId = prefs.getString("installation_id", null)
                    if (installId == null) {
                        installId = UUID.randomUUID().toString()
                        prefs.edit().putString("installation_id", installId).apply()
                    }
                    result.success(installId)
                }

                "saveCredentials" -> {
                    val url = call.argument<String>("supabaseUrl")
                    val anonKey = call.argument<String>("supabaseAnonKey")
                    val token = call.argument<String>("accessToken")
                    val refresh = call.argument<String>("refreshToken")
                    val userId = call.argument<String>("userId")
                    val deviceId = call.argument<String>("deviceId")
                    val filterSensitive = call.argument<Boolean>("filterSensitive") ?: false

                    val prefs = applicationContext.getSharedPreferences(SmsSyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit()
                        .putString("supabase_url", url)
                        .putString("supabase_anon_key", anonKey)
                        .putString("access_token", token)
                        .putString("refresh_token", refresh)
                        .putString("user_id", userId)
                        .putString("device_id", deviceId)
                        .putBoolean("filter_sensitive", filterSensitive)
                        .apply()

                    // Automatically start 24/7 foreground sync service
                    try {
                        SmsSyncForegroundService.start(applicationContext)
                    } catch (e: Exception) {
                        Log.w(TAG, "Could not start foreground service", e)
                    }

                    // Catch up any recently arrived SMS immediately
                    activityScope.launch {
                        catchUpRecentSms(lookbackHours = 48)
                    }

                    result.success(true)
                }

                "clearCredentials" -> {
                    val prefs = applicationContext.getSharedPreferences(SmsSyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit()
                        .remove("access_token")
                        .remove("refresh_token")
                        .remove("user_id")
                        .remove("device_id")
                        .apply()

                    try {
                        SmsSyncForegroundService.stop(applicationContext)
                    } catch (e: Exception) {
                        Log.w(TAG, "Could not stop foreground service", e)
                    }

                    result.success(true)
                }

                "startForegroundSync" -> {
                    try {
                        SmsSyncForegroundService.start(applicationContext)
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }

                "catchUpRecentSms" -> {
                    activityScope.launch {
                        val count = catchUpRecentSms(lookbackHours = 48)
                        runOnUiThread {
                            result.success(count)
                        }
                    }
                }

                "triggerSyncNow" -> {
                    activityScope.launch {
                        catchUpRecentSms(lookbackHours = 48)
                    }

                    val constraints = Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()

                    val syncWorkRequest = OneTimeWorkRequestBuilder<SmsSyncWorker>()
                        .setConstraints(constraints)
                        .build()

                    WorkManager.getInstance(applicationContext).enqueueUniqueWork(
                        "MySmsManualSync",
                        ExistingWorkPolicy.REPLACE,
                        syncWorkRequest
                    )
                    result.success(true)
                }

                "getLocalCounts" -> {
                    val counts = dbHelper.getCounts()
                    result.success(counts)
                }

                "getLocalMessages" -> {
                    val limit = call.argument<Int>("limit") ?: 100
                    val list = dbHelper.getAllMessages(limit)
                    result.success(list)
                }

                "markMessageSynced" -> {
                    val hash = call.argument<String>("messageHash")
                    if (hash != null) {
                        dbHelper.markAsSynced(hash)
                        result.success(true)
                    } else {
                        result.error("INVALID_ARGS", "messageHash required", null)
                    }
                }

                "requestIgnoreBatteryOptimizations" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                        val isIgnoring = powerManager?.isIgnoringBatteryOptimizations(packageName) ?: false
                        if (!isIgnoring) {
                            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(intent)
                            result.success(false)
                        } else {
                            result.success(true)
                        }
                    } else {
                        result.success(true)
                    }
                }

                "isIgnoringBatteryOptimizations" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                        val isIgnoring = powerManager?.isIgnoringBatteryOptimizations(packageName) ?: false
                        result.success(isIgnoring)
                    } else {
                        result.success(true)
                    }
                }

                else -> result.notImplemented()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Automatically check and catch up any SMS that arrived while app was closed or in sleep
        activityScope.launch {
            catchUpRecentSms(lookbackHours = 24)
        }
    }

    /**
     * Inspects content://sms/inbox for any recent incoming SMS and syncs any not yet recorded.
     */
    private fun catchUpRecentSms(lookbackHours: Long = 24): Int {
        var syncedNewCount = 0
        try {
            val cutoff = System.currentTimeMillis() - (lookbackHours * 3600 * 1000L)
            val cursor = contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(
                    Telephony.Sms.Inbox._ID,
                    Telephony.Sms.Inbox.ADDRESS,
                    Telephony.Sms.Inbox.BODY,
                    Telephony.Sms.Inbox.DATE,
                    Telephony.Sms.Inbox.SUBSCRIPTION_ID
                ),
                "${Telephony.Sms.Inbox.DATE} >= ?",
                arrayOf(cutoff.toString()),
                "${Telephony.Sms.Inbox.DATE} DESC"
            )

            cursor?.use { c ->
                val addrIdx = c.getColumnIndex(Telephony.Sms.Inbox.ADDRESS)
                val bodyIdx = c.getColumnIndex(Telephony.Sms.Inbox.BODY)
                val dateIdx = c.getColumnIndex(Telephony.Sms.Inbox.DATE)
                val subIdx = c.getColumnIndex(Telephony.Sms.Inbox.SUBSCRIPTION_ID)

                val dbHelper = SmsDatabaseHelper(applicationContext)

                while (c.moveToNext()) {
                    val sender = if (addrIdx >= 0) c.getString(addrIdx) ?: "Unknown" else "Unknown"
                    val body = if (bodyIdx >= 0) c.getString(bodyIdx) ?: "" else ""
                    val date = if (dateIdx >= 0) c.getLong(dateIdx) else System.currentTimeMillis()
                    val subId = if (subIdx >= 0) c.getInt(subIdx) else -1
                    val simSlot = if (subId >= 1) "SIM ${subId}" else "SIM 1"

                    if (body.isBlank()) continue

                    val hash = SmsDatabaseHelper.computeHash(sender, date, body)
                    val rowId = dbHelper.insertMessage(sender, body, date, simSlot)

                    // If row was newly inserted into SQLite, direct upload to Supabase!
                    if (rowId > 0) {
                        Log.i(TAG, "Catch-up found new incoming SMS from $sender ($simSlot)")
                        syncedNewCount++

                        val smsMap = mapOf(
                            "sender" to sender,
                            "message_body" to body,
                            "received_at" to date,
                            "sim_slot" to simSlot,
                            "message_hash" to hash,
                            "sync_status" to "PENDING"
                        )
                        notifySmsReceived(smsMap)

                        directUploadSms(sender, body, date, simSlot, hash, dbHelper)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in catchUpRecentSms", e)
        }
        return syncedNewCount
    }

    private fun directUploadSms(
        sender: String,
        body: String,
        receivedAt: Long,
        simSlot: String,
        hash: String,
        dbHelper: SmsDatabaseHelper
    ) {
        val prefs = applicationContext.getSharedPreferences(SmsSyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        val supabaseUrl = prefs.getString("supabase_url", null)
        val supabaseAnonKey = prefs.getString("supabase_anon_key", null)
        val accessToken = prefs.getString("access_token", null)
        val userId = prefs.getString("user_id", null)
        val deviceId = prefs.getString("device_id", null)
        val filterSensitive = prefs.getBoolean("filter_sensitive", false)

        if (supabaseUrl.isNullOrEmpty() || supabaseAnonKey.isNullOrEmpty() || accessToken.isNullOrEmpty() || userId.isNullOrEmpty()) {
            return
        }

        var bodyToSync = body
        if (filterSensitive && SmsSyncWorker.SENSITIVE_KEYWORDS.any { body.lowercase(Locale.ROOT).contains(it) }) {
            bodyToSync = body.replace(Regex("\\b\\d{4,8}\\b"), "[REDACTED OTP]")
        }

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val isoDate = sdf.format(Date(receivedAt))

        val json = JSONObject().apply {
            put("user_id", userId)
            if (!deviceId.isNullOrEmpty()) put("device_id", deviceId)
            put("sender", sender)
            put("message_body", bodyToSync)
            put("received_at", isoDate)
            put("sim_slot", simSlot)
            put("message_hash", hash)
        }

        try {
            val url = URL("$supabaseUrl/rest/v1/sms_messages")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("apikey", supabaseAnonKey)
                setRequestProperty("Authorization", "Bearer $accessToken")
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Prefer", "resolution=merge-duplicates")
                doOutput = true
                connectTimeout = 7000
                readTimeout = 7000
            }

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use {
                it.write(json.toString())
                it.flush()
            }

            val code = conn.responseCode
            conn.disconnect()

            if (code in 200..299) {
                Log.i(TAG, "Catch-up upload SUCCESS (HTTP $code) for $hash")
                dbHelper.markAsSynced(hash)
                notifySyncCompleted(1, 0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Catch-up upload error: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        methodChannel = null
    }
}

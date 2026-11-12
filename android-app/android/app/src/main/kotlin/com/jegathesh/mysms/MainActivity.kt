package com.jegathesh.mysms

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.annotation.NonNull
import androidx.work.*
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.UUID

class MainActivity : FlutterActivity() {

    companion object {
        const val CHANNEL = "com.jegathesh.mysms/sms_bridge"
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
                    result.success(true)
                }

                "triggerSyncNow" -> {
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

    override fun onDestroy() {
        super.onDestroy()
        methodChannel = null
    }
}

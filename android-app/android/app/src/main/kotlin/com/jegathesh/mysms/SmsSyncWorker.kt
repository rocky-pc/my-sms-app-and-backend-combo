package com.jegathesh.mysms

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SmsSyncWorker(
    private val appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "MySMS_SyncWorker"
        const val PREFS_NAME = "MySmsSecurePrefs"

        val SENSITIVE_KEYWORDS = listOf(
            "otp", "one-time", "one time", "verification code", "security code",
            "auth code", "cvv", "atm pin", "netbanking password", "login otp"
        )
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val dbHelper = SmsDatabaseHelper(appContext)
        val pendingMessages = dbHelper.getPendingMessages()

        if (pendingMessages.isEmpty()) {
            Log.d(TAG, "No pending messages to sync.")
            return@withContext Result.success()
        }

        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val supabaseUrl = prefs.getString("supabase_url", null)
        val supabaseAnonKey = prefs.getString("supabase_anon_key", null)
        var accessToken = prefs.getString("access_token", null)
        val refreshToken = prefs.getString("refresh_token", null)
        val userId = prefs.getString("user_id", null)
        val deviceId = prefs.getString("device_id", null)
        val filterSensitive = prefs.getBoolean("filter_sensitive", false)

        if (supabaseUrl.isNullOrEmpty() || supabaseAnonKey.isNullOrEmpty() || accessToken.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Log.w(TAG, "Supabase credentials or authentication session not found. Skipping sync.")
            return@withContext Result.failure()
        }

        var activeToken: String = accessToken
        var syncedCount = 0
        var failedCount = 0
        var isTokenExpired = false

        for (msg in pendingMessages) {
            var bodyToSync = msg.messageBody
            if (filterSensitive && containsSensitiveData(bodyToSync)) {
                bodyToSync = redactSensitiveData(bodyToSync)
            }

            val isoDate = formatIso8601(msg.receivedAt)
            val jsonPayload = JSONObject().apply {
                put("user_id", userId)
                if (!deviceId.isNullOrEmpty()) {
                    put("device_id", deviceId)
                }
                put("sender", msg.sender)
                put("message_body", bodyToSync)
                put("received_at", isoDate)
                put("sim_slot", msg.simSlot)
                put("message_hash", msg.messageHash)
            }

            var responseCode = postToSupabase(
                endpoint = "$supabaseUrl/rest/v1/sms_messages",
                anonKey = supabaseAnonKey,
                token = activeToken,
                body = jsonPayload.toString()
            )

            // If 401 Unauthorized, attempt refresh once
            if (responseCode == 401 && !refreshToken.isNullOrEmpty() && !isTokenExpired) {
                val newAccessToken = refreshAuthToken(supabaseUrl, supabaseAnonKey, refreshToken, prefs)
                if (newAccessToken != null) {
                    activeToken = newAccessToken
                    // Retry with new token
                    responseCode = postToSupabase(
                        endpoint = "$supabaseUrl/rest/v1/sms_messages",
                        anonKey = supabaseAnonKey,
                        token = activeToken,
                        body = jsonPayload.toString()
                    )
                } else {
                    isTokenExpired = true
                }
            }

            if (responseCode in 200..299 || responseCode == 409) {
                // Success or already synced (duplicate hash constraint)
                dbHelper.markAsSynced(msg.messageHash)
                syncedCount++
            } else {
                Log.e(TAG, "Failed to upload SMS ${msg.messageHash}, response code: $responseCode")
                failedCount++
            }
        }

        // Update device last_sync_at if deviceId is present
        if (!deviceId.isNullOrEmpty() && syncedCount > 0) {
            updateDeviceLastSync(supabaseUrl, supabaseAnonKey, activeToken, deviceId)
        }

        // Log sync activity
        recordSyncLog(supabaseUrl, supabaseAnonKey, activeToken, userId, deviceId, syncedCount, failedCount)

        // Notify Flutter UI
        MainActivity.notifySyncCompleted(syncedCount, failedCount)

        if (failedCount > 0 && syncedCount == 0) {
            return@withContext Result.retry()
        }

        Result.success()
    }

    private fun containsSensitiveData(body: String): Boolean {
        val lower = body.lowercase(Locale.ROOT)
        return SENSITIVE_KEYWORDS.any { lower.contains(it) }
    }

    private fun redactSensitiveData(body: String): String {
        // Redacts 4-8 digit numeric codes often present in OTPs
        return body.replace(Regex("\\b\\d{4,8}\\b"), "[REDACTED OTP]")
    }

    private fun formatIso8601(timestampMillis: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(timestampMillis))
    }

    private fun postToSupabase(endpoint: String, anonKey: String, token: String, body: String): Int {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(endpoint)
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("apikey", anonKey)
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Prefer", "resolution=merge-duplicates")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(body)
                writer.flush()
            }

            conn.responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Network error posting to Supabase", e)
            -1
        } finally {
            conn?.disconnect()
        }
    }

    private fun refreshAuthToken(supabaseUrl: String, anonKey: String, refreshToken: String, prefs: SharedPreferences): String? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL("$supabaseUrl/auth/v1/token?grant_type=refresh_token")
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("apikey", anonKey)
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val body = JSONObject().apply {
                put("refresh_token", refreshToken)
            }.toString()

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(body)
                writer.flush()
            }

            if (conn.responseCode in 200..299) {
                val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                val respJson = JSONObject(responseText)
                val newAccessToken = respJson.getString("access_token")
                val newRefreshToken = respJson.optString("refresh_token", refreshToken)

                prefs.edit()
                    .putString("access_token", newAccessToken)
                    .putString("refresh_token", newRefreshToken)
                    .apply()

                Log.d(TAG, "Auth token refreshed successfully")
                newAccessToken
            } else {
                Log.e(TAG, "Failed to refresh token: HTTP ${conn.responseCode}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error refreshing token", e)
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun updateDeviceLastSync(supabaseUrl: String, anonKey: String, token: String, deviceId: String) {
        var conn: HttpURLConnection? = null
        try {
            val url = URL("$supabaseUrl/rest/v1/devices?id=eq.$deviceId")
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "PATCH"
            conn.setRequestProperty("apikey", anonKey)
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val payload = JSONObject().apply {
                put("last_sync_at", formatIso8601(System.currentTimeMillis()))
            }.toString()

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(payload)
                writer.flush()
            }

            conn.responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Error updating device last_sync_at", e)
        } finally {
            conn?.disconnect()
        }
    }

    private fun recordSyncLog(
        supabaseUrl: String,
        anonKey: String,
        token: String,
        userId: String,
        deviceId: String?,
        syncedCount: Int,
        failedCount: Int
    ) {
        if (syncedCount == 0 && failedCount == 0) return
        var conn: HttpURLConnection? = null
        try {
            val url = URL("$supabaseUrl/rest/v1/sync_logs")
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("apikey", anonKey)
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val status = if (failedCount == 0) "SUCCESS" else if (syncedCount > 0) "PARTIAL" else "FAILED"
            val payload = JSONObject().apply {
                put("user_id", userId)
                if (!deviceId.isNullOrEmpty()) {
                    put("device_id", deviceId)
                }
                put("sync_status", status)
                put("synced_count", syncedCount)
                put("failed_count", failedCount)
            }.toString()

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(payload)
                writer.flush()
            }

            conn.responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Error recording sync log", e)
        } finally {
            conn?.disconnect()
        }
    }
}

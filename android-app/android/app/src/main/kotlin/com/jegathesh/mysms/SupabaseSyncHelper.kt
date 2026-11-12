package com.jegathesh.mysms

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
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

object SupabaseSyncHelper {
    private const val TAG = "MySMS_SyncHelper"

    val SENSITIVE_KEYWORDS = listOf(
        "otp", "one-time", "one time", "verification code", "security code",
        "auth code", "cvv", "atm pin", "netbanking password", "login otp"
    )

    suspend fun uploadSms(
        context: Context,
        sender: String,
        body: String,
        receivedAt: Long,
        simSlot: String,
        hash: String,
        dbHelper: SmsDatabaseHelper
    ): Boolean = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences(SmsSyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        val supabaseUrl = prefs.getString("supabase_url", null)
        val supabaseAnonKey = prefs.getString("supabase_anon_key", null)
        var accessToken = prefs.getString("access_token", null)
        val refreshToken = prefs.getString("refresh_token", null)
        val userId = prefs.getString("user_id", null)
        val deviceId = prefs.getString("device_id", null)
        val filterSensitive = prefs.getBoolean("filter_sensitive", false)

        if (supabaseUrl.isNullOrEmpty() || supabaseAnonKey.isNullOrEmpty() || accessToken.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Log.w(TAG, "Missing credentials or user_id for upload")
            return@withContext false
        }

        var bodyToSync = body
        if (filterSensitive && SENSITIVE_KEYWORDS.any { body.lowercase(Locale.ROOT).contains(it) }) {
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

        var responseCode = postJson(
            endpoint = "$supabaseUrl/rest/v1/sms_messages",
            anonKey = supabaseAnonKey,
            token = accessToken,
            payload = json.toString()
        )

        // If 401 Unauthorized, automatically refresh auth token and retry!
        if (responseCode == 401 && !refreshToken.isNullOrEmpty()) {
            Log.w(TAG, "Access token expired (401). Refreshing token...")
            val newAccessToken = refreshAuthToken(supabaseUrl, supabaseAnonKey, refreshToken, prefs)
            if (newAccessToken != null) {
                responseCode = postJson(
                    endpoint = "$supabaseUrl/rest/v1/sms_messages",
                    anonKey = supabaseAnonKey,
                    token = newAccessToken,
                    payload = json.toString()
                )
            }
        }

        if (responseCode in 200..299) {
            Log.i(TAG, "Upload SUCCESS (HTTP $responseCode) for $sender [$hash]")
            dbHelper.markAsSynced(hash)
            MainActivity.notifySyncCompleted(1, 0)
            return@withContext true
        } else {
            Log.w(TAG, "Upload failed with HTTP $responseCode for $sender [$hash]")
            return@withContext false
        }
    }

    private fun postJson(endpoint: String, anonKey: String, token: String, payload: String): Int {
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
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use {
                it.write(payload)
                it.flush()
            }

            conn.responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Network error in postJson: ${e.message}")
            -1
        } finally {
            conn?.disconnect()
        }
    }

    fun refreshAuthToken(
        supabaseUrl: String,
        anonKey: String,
        refreshToken: String,
        prefs: SharedPreferences
    ): String? {
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

                Log.i(TAG, "Token refreshed successfully")
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
}

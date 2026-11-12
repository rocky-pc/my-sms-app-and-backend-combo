package com.jegathesh.mysms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Telephony
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SmsSyncForegroundService : Service() {

    companion object {
        private const val TAG = "MySMS_ForegroundService"
        const val CHANNEL_ID = "mysms_sync_channel"
        const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, SmsSyncForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, SmsSyncForegroundService::class.java)
            context.stopService(intent)
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var smsReceiver: SmsReceiver? = null
    private var smsObserver: ContentObserver? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "SmsSyncForegroundService created")
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        // 1. Dynamically register BroadcastReceiver for instant dual-layer coverage
        try {
            smsReceiver = SmsReceiver()
            val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION).apply {
                priority = Int.MAX_VALUE
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(smsReceiver, filter)
            }
            Log.d(TAG, "Dynamic SmsReceiver registered in foreground service")
        } catch (e: Exception) {
            Log.e(TAG, "Error registering dynamic receiver", e)
        }

        // 2. Register ContentObserver on Telephony.Sms.CONTENT_URI for instant incoming SMS capture
        try {
            val handler = Handler(Looper.getMainLooper())
            val observer = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean, uri: Uri?) {
                    super.onChange(selfChange, uri)
                    Log.d(TAG, "SMS ContentObserver triggered: $uri")
                    serviceScope.launch {
                        processIncomingSmsFromProvider()
                    }
                }
            }
            smsObserver = observer
            contentResolver.registerContentObserver(
                Telephony.Sms.CONTENT_URI,
                true,
                observer
            )
            Log.d(TAG, "SMS ContentObserver registered on ${Telephony.Sms.CONTENT_URI}")
        } catch (e: Exception) {
            Log.e(TAG, "Error registering ContentObserver", e)
        }

        // 3. Catch up any recent messages received in last 2 hours immediately
        serviceScope.launch {
            processIncomingSmsFromProvider(lookbackMillis = 2 * 60 * 60 * 1000L)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "SmsSyncForegroundService destroyed")
        try {
            if (smsReceiver != null) {
                unregisterReceiver(smsReceiver)
                smsReceiver = null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering receiver", e)
        }

        try {
            smsObserver?.let {
                contentResolver.unregisterContentObserver(it)
                smsObserver = null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering observer", e)
        }

        serviceScope.cancel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MySMS Instant Sync Engine",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps SMS synchronization engine active in real time"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MySMS Realtime Sync Active")
            .setContentText("Listening for incoming SMS · Instant cloud synchronization")
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    /**
     * Queries content://sms/inbox for incoming messages and immediately syncs newly discovered items to Supabase
     */
    private suspend fun processIncomingSmsFromProvider(lookbackMillis: Long = 5 * 60 * 1000L) {
        try {
            val cutoff = System.currentTimeMillis() - lookbackMillis
            
            // Query content://sms directly with type=1 to capture all contact numbers & alphanumeric senders
            val cursor = contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.SUBSCRIPTION_ID,
                    Telephony.Sms.TYPE
                ),
                "${Telephony.Sms.TYPE} = 1 AND ${Telephony.Sms.DATE} >= ?",
                arrayOf(cutoff.toString()),
                "${Telephony.Sms.DATE} DESC"
            ) ?: contentResolver.query(
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
                val addrIdx = c.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = c.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = c.getColumnIndex(Telephony.Sms.DATE)
                val subIdx = c.getColumnIndex(Telephony.Sms.SUBSCRIPTION_ID)

                val dbHelper = SmsDatabaseHelper(applicationContext)

                while (c.moveToNext()) {
                    val sender = if (addrIdx >= 0) c.getString(addrIdx) ?: "Unknown" else "Unknown"
                    val body = if (bodyIdx >= 0) c.getString(bodyIdx) ?: "" else ""
                    val date = if (dateIdx >= 0) c.getLong(dateIdx) else System.currentTimeMillis()
                    val subId = if (subIdx >= 0) c.getInt(subIdx) else -1
                    val simSlot = if (subId >= 1) "SIM ${subId}" else "SIM 1"

                    if (body.isBlank()) continue

                    val hash = SmsDatabaseHelper.computeHash(sender, date, body)
                    
                    // Insert into SQLite. If row already exists, rowId is -1 due to CONFLICT_IGNORE
                    val rowId = dbHelper.insertMessage(sender, body, date, simSlot)

                    // If row was newly inserted or pending, attempt instant upload!
                    if (rowId > 0) {
                        Log.i(TAG, "New incoming SMS captured via ContentObserver from $sender")
                        val smsMap = mapOf(
                            "sender" to sender,
                            "message_body" to body,
                            "received_at" to date,
                            "sim_slot" to simSlot,
                            "message_hash" to hash,
                            "sync_status" to "PENDING"
                        )
                        MainActivity.notifySmsReceived(smsMap)

                        // Instant upload to Supabase with automatic token refresh!
                        serviceScope.launch {
                            SupabaseSyncHelper.uploadSms(
                                context = applicationContext,
                                sender = sender,
                                body = body,
                                receivedAt = date,
                                simSlot = simSlot,
                                hash = hash,
                                dbHelper = dbHelper
                            )
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in processIncomingSmsFromProvider", e)
        }
    }
}

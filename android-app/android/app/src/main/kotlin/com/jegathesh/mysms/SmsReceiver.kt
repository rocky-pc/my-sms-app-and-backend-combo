package com.jegathesh.mysms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log
import androidx.work.*
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
import java.util.concurrent.TimeUnit

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MySMS_Receiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null || intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // 1. Robust PDU extraction
                var messages: Array<SmsMessage>? = null
                try {
                    messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                } catch (e: Exception) {
                    Log.w(TAG, "Error in getMessagesFromIntent", e)
                }

                if (messages.isNullOrEmpty()) {
                    val bundle = intent.extras
                    val pdus = bundle?.get("pdus") as? Array<*>
                    val format = bundle?.getString("format")
                    if (pdus != null) {
                        messages = pdus.mapNotNull { pdu ->
                            if (pdu is ByteArray) {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && format != null) {
                                    SmsMessage.createFromPdu(pdu, format)
                                } else {
                                    @Suppress("DEPRECATION")
                                    SmsMessage.createFromPdu(pdu)
                                }
                            } else null
                        }.toTypedArray()
                    }
                }

                if (messages.isNullOrEmpty()) {
                    Log.w(TAG, "No SMS messages found in intent extras")
                    return@launch
                }

                // 2. Extract SIM Slot
                val simSlot = extractSimSlot(context, intent)

                // 3. Assemble multipart SMS
                val groupedMessages = mutableMapOf<String, StringBuilder>()
                var latestTimestamp = System.currentTimeMillis()

                for (sms in messages) {
                    val sender = sms.displayOriginatingAddress ?: sms.originatingAddress ?: "Unknown"
                    val body = sms.displayMessageBody ?: sms.messageBody ?: ""
                    latestTimestamp = sms.timestampMillis

                    if (!groupedMessages.containsKey(sender)) {
                        groupedMessages[sender] = StringBuilder()
                    }
                    groupedMessages[sender]?.append(body)
                }

                val dbHelper = SmsDatabaseHelper(context)

                for ((sender, bodyBuilder) in groupedMessages) {
                    val fullBody = bodyBuilder.toString()
                    if (fullBody.isBlank()) continue

                    Log.i(TAG, "Captured incoming SMS broadcast from $sender ($simSlot)")

                    // 4. Save to local SQLite
                    dbHelper.insertMessage(
                        sender = sender,
                        messageBody = fullBody,
                        receivedAt = latestTimestamp,
                        simSlot = simSlot
                    )

                    val hash = SmsDatabaseHelper.computeHash(sender, latestTimestamp, fullBody)

                    val smsMap = mapOf(
                        "sender" to sender,
                        "message_body" to fullBody,
                        "received_at" to latestTimestamp,
                        "sim_slot" to simSlot,
                        "message_hash" to hash,
                        "sync_status" to "PENDING"
                    )

                    // 5. Instantly notify Flutter UI if open
                    MainActivity.notifySmsReceived(smsMap)

                    // 6. Direct instant HTTPS upload to Supabase in fraction of second
                    uploadDirect(context, sender, fullBody, latestTimestamp, simSlot, hash, dbHelper)
                }

                // 7. Enqueue WorkManager for guaranteed offline sync resilience
                enqueueSyncWorker(context)

            } catch (e: Exception) {
                Log.e(TAG, "Error processing incoming SMS broadcast", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun uploadDirect(
        context: Context,
        sender: String,
        body: String,
        receivedAt: Long,
        simSlot: String,
        hash: String,
        dbHelper: SmsDatabaseHelper
    ) {
        SupabaseSyncHelper.uploadSms(
            context = context,
            sender = sender,
            body = body,
            receivedAt = receivedAt,
            simSlot = simSlot,
            hash = hash,
            dbHelper = dbHelper
        )
    }

    private fun extractSimSlot(context: Context, intent: Intent): String {
        var slotIndex = -1

        if (intent.hasExtra("slot")) {
            slotIndex = intent.getIntExtra("slot", -1)
        } else if (intent.hasExtra("simSlot")) {
            slotIndex = intent.getIntExtra("simSlot", -1)
        } else if (intent.hasExtra("android.telephony.extra.SLOT_INDEX")) {
            slotIndex = intent.getIntExtra("android.telephony.extra.SLOT_INDEX", -1)
        } else if (intent.hasExtra("subscription")) {
            val subId = intent.getIntExtra("subscription", -1)
            if (subId != -1) {
                slotIndex = subId
            }
        }

        return when (slotIndex) {
            0 -> "SIM 1"
            1 -> "SIM 2"
            else -> if (slotIndex > 1) "SIM ${slotIndex}" else "SIM 1"
        }
    }

    private fun enqueueSyncWorker(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncWorkRequest = OneTimeWorkRequestBuilder<SmsSyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .addTag("MySmsImmediateSync")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "MySmsSyncWork",
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )
    }
}

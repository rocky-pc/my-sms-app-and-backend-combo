package com.jegathesh.mysms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import android.telephony.SubscriptionManager
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MySMS_Receiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null || intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        try {
            val messages: Array<SmsMessage>? = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) {
                Log.w(TAG, "No SMS messages found in intent")
                return
            }

            // Determine SIM slot
            val simSlot = extractSimSlot(context, intent)

            // Group multipart SMS by sender
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

                Log.d(TAG, "Captured incoming SMS from $sender ($simSlot)")

                // Save to local database (PENDING status)
                val rowId = dbHelper.insertMessage(
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

                // If MainActivity is active, notify Flutter UI immediately
                MainActivity.notifySmsReceived(smsMap)
            }

            // Trigger background WorkManager task to sync pending messages
            enqueueSyncWorker(context)

        } catch (e: Exception) {
            Log.e(TAG, "Error processing incoming SMS", e)
        }
    }

    private fun extractSimSlot(context: Context, intent: Intent): String {
        var slotIndex = -1

        // Check common extras
        if (intent.hasExtra("slot")) {
            slotIndex = intent.getIntExtra("slot", -1)
        } else if (intent.hasExtra("simSlot")) {
            slotIndex = intent.getIntExtra("simSlot", -1)
        } else if (intent.hasExtra("android.telephony.extra.SLOT_INDEX")) {
            slotIndex = intent.getIntExtra("android.telephony.extra.SLOT_INDEX", -1)
        } else if (intent.hasExtra("subscription")) {
            val subId = intent.getIntExtra("subscription", -1)
            if (subId != -1 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                try {
                    val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                    if (subManager != null) {
                        val subInfo = subManager.getActiveSubscriptionInfo(subId)
                        if (subInfo != null) {
                            slotIndex = subInfo.simSlotIndex
                        }
                    }
                } catch (ignored: Exception) {}
            }
        }

        return when (slotIndex) {
            0 -> "SIM 1"
            1 -> "SIM 2"
            else -> if (slotIndex > 1) "SIM ${slotIndex + 1}" else "SIM 1"
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

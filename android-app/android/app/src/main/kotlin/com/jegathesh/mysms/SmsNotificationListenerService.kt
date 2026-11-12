package com.jegathesh.mysms

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.Locale

class SmsNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "MySMS_NotifListener"

        private val SMS_PACKAGES = setOf(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.android.mms",
            "com.oneplus.mms",
            "com.coloros.mms",
            "com.oppo.mms",
            "com.xiaomi.mms",
            "com.huawei.message",
            "com.asus.message",
            "com.motorola.messaging"
        )
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val pkgName = sbn.packageName?.lowercase(Locale.ROOT) ?: return
        val isSmsApp = SMS_PACKAGES.contains(pkgName) ||
                pkgName.contains("sms") ||
                pkgName.contains("mms") ||
                pkgName.contains("messaging")

        if (!isSmsApp) return

        val notif = sbn.notification ?: return
        val extras: Bundle = notif.extras ?: return

        // Extract title (Sender contact name or phone number)
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()
            ?: "Unknown"

        // Extract body (Message text)
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: ""

        if (text.isBlank() || title.isBlank()) return

        val timestamp = if (sbn.postTime > 0) sbn.postTime else System.currentTimeMillis()
        val simSlot = "Notification"

        Log.i(TAG, "Notification captured from $pkgName -> Sender: $title | Body: $text")

        val dbHelper = SmsDatabaseHelper(applicationContext)
        val hash = SmsDatabaseHelper.computeHash(title, timestamp, text)
        val rowId = dbHelper.insertMessage(title, text, timestamp, simSlot)

        if (rowId > 0) {
            val smsMap = mapOf(
                "sender" to title,
                "message_body" to text,
                "received_at" to timestamp,
                "sim_slot" to simSlot,
                "message_hash" to hash,
                "sync_status" to "PENDING"
            )
            MainActivity.notifySmsReceived(smsMap)

            serviceScope.launch {
                SupabaseSyncHelper.uploadSms(
                    context = applicationContext,
                    sender = title,
                    body = text,
                    receivedAt = timestamp,
                    simSlot = simSlot,
                    hash = hash,
                    dbHelper = dbHelper
                )
            }
        }
    }
}

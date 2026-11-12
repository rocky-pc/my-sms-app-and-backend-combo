package com.jegathesh.mysms

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.security.MessageDigest
import java.util.Date

data class SmsItem(
    val id: Long = 0,
    val sender: String,
    val messageBody: String,
    val receivedAt: Long,
    val simSlot: String,
    val messageHash: String,
    val syncStatus: String, // "PENDING", "SYNCED", "FAILED"
    val createdAt: Long = System.currentTimeMillis()
)

class SmsDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "mysms.db"
        const val DATABASE_VERSION = 1

        const val TABLE_SMS = "pending_sms"
        const val COL_ID = "id"
        const val COL_SENDER = "sender"
        const val COL_MESSAGE_BODY = "message_body"
        const val COL_RECEIVED_AT = "received_at"
        const val COL_SIM_SLOT = "sim_slot"
        const val COL_MESSAGE_HASH = "message_hash"
        const val COL_SYNC_STATUS = "sync_status"
        const val COL_CREATED_AT = "created_at"

        fun computeHash(sender: String, receivedAt: Long, body: String): String {
            val raw = "$sender|$receivedAt|$body"
            val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
            return digest.joinToString("") { "%02x".format(it) }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createTable = """
            CREATE TABLE IF NOT EXISTS $TABLE_SMS (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_SENDER TEXT NOT NULL,
                $COL_MESSAGE_BODY TEXT NOT NULL,
                $COL_RECEIVED_AT INTEGER NOT NULL,
                $COL_SIM_SLOT TEXT,
                $COL_MESSAGE_HASH TEXT NOT NULL UNIQUE,
                $COL_SYNC_STATUS TEXT NOT NULL DEFAULT 'PENDING',
                $COL_CREATED_AT INTEGER NOT NULL
            )
        """.trimIndent()
        db.execSQL(createTable)
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_hash ON $TABLE_SMS ($COL_MESSAGE_HASH)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_status ON $TABLE_SMS ($COL_SYNC_STATUS)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Migration if necessary
    }

    @Synchronized
    fun insertMessage(sender: String, messageBody: String, receivedAt: Long, simSlot: String): Long {
        val hash = computeHash(sender, receivedAt, messageBody)
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_SENDER, sender)
            put(COL_MESSAGE_BODY, messageBody)
            put(COL_RECEIVED_AT, receivedAt)
            put(COL_SIM_SLOT, simSlot)
            put(COL_MESSAGE_HASH, hash)
            put(COL_SYNC_STATUS, "PENDING")
            put(COL_CREATED_AT, System.currentTimeMillis())
        }
        return db.insertWithOnConflict(TABLE_SMS, null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    @Synchronized
    fun getPendingMessages(): List<SmsItem> {
        val list = mutableListOf<SmsItem>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_SMS,
            null,
            "$COL_SYNC_STATUS = ?",
            arrayOf("PENDING"),
            null,
            null,
            "$COL_RECEIVED_AT ASC"
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(
                    SmsItem(
                        id = it.getLong(it.getColumnIndexOrThrow(COL_ID)),
                        sender = it.getString(it.getColumnIndexOrThrow(COL_SENDER)),
                        messageBody = it.getString(it.getColumnIndexOrThrow(COL_MESSAGE_BODY)),
                        receivedAt = it.getLong(it.getColumnIndexOrThrow(COL_RECEIVED_AT)),
                        simSlot = it.getString(it.getColumnIndexOrThrow(COL_SIM_SLOT)) ?: "Unknown",
                        messageHash = it.getString(it.getColumnIndexOrThrow(COL_MESSAGE_HASH)),
                        syncStatus = it.getString(it.getColumnIndexOrThrow(COL_SYNC_STATUS)),
                        createdAt = it.getLong(it.getColumnIndexOrThrow(COL_CREATED_AT))
                    )
                )
            }
        }
        return list
    }

    @Synchronized
    fun markAsSynced(messageHash: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_STATUS, "SYNCED")
        }
        db.update(TABLE_SMS, values, "$COL_MESSAGE_HASH = ?", arrayOf(messageHash))
    }

    @Synchronized
    fun markAsFailed(messageHash: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_STATUS, "FAILED")
        }
        db.update(TABLE_SMS, values, "$COL_MESSAGE_HASH = ?", arrayOf(messageHash))
    }

    @Synchronized
    fun getCounts(): Map<String, Int> {
        val db = readableDatabase
        var total = 0
        var pending = 0
        var today = 0

        // Start of today in millis
        val cal = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        val startOfToday = cal.timeInMillis

        // Total count
        db.rawQuery("SELECT COUNT(*) FROM $TABLE_SMS", null).use {
            if (it.moveToFirst()) total = it.getInt(0)
        }

        // Pending count
        db.rawQuery("SELECT COUNT(*) FROM $TABLE_SMS WHERE $COL_SYNC_STATUS = 'PENDING'", null).use {
            if (it.moveToFirst()) pending = it.getInt(0)
        }

        // Today count
        db.rawQuery("SELECT COUNT(*) FROM $TABLE_SMS WHERE $COL_RECEIVED_AT >= ?", arrayOf(startOfToday.toString())).use {
            if (it.moveToFirst()) today = it.getInt(0)
        }

        return mapOf(
            "total" to total,
            "pending" to pending,
            "today" to today
        )
    }

    @Synchronized
    fun getAllMessages(limit: Int = 100): List<Map<String, Any>> {
        val list = mutableListOf<Map<String, Any>>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_SMS,
            null,
            null,
            null,
            null,
            null,
            "$COL_RECEIVED_AT DESC",
            limit.toString()
        )
        cursor.use {
            while (it.moveToNext()) {
                val map = mapOf(
                    "id" to it.getLong(it.getColumnIndexOrThrow(COL_ID)),
                    "sender" to it.getString(it.getColumnIndexOrThrow(COL_SENDER)),
                    "message_body" to it.getString(it.getColumnIndexOrThrow(COL_MESSAGE_BODY)),
                    "received_at" to it.getLong(it.getColumnIndexOrThrow(COL_RECEIVED_AT)),
                    "sim_slot" to (it.getString(it.getColumnIndexOrThrow(COL_SIM_SLOT)) ?: "Unknown"),
                    "message_hash" to it.getString(it.getColumnIndexOrThrow(COL_MESSAGE_HASH)),
                    "sync_status" to it.getString(it.getColumnIndexOrThrow(COL_SYNC_STATUS)),
                    "created_at" to it.getLong(it.getColumnIndexOrThrow(COL_CREATED_AT))
                )
                list.add(map)
            }
        }
        return list
    }
}

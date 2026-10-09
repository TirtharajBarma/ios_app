package com.tirtharajbarma.subscription

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class MonevoNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "MonevoNotifListener"
        const val PREFS_NAME = "monevo_financial_inbox"
        const val KEY_NOTIFICATIONS = "pending_notifications"
        private const val MAX_QUEUE_SIZE = 100
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        try {
            val notification = sbn.notification ?: return
            val extras = notification.extras ?: return

            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""

            val content = if (bigText.isNotBlank()) bigText else text
            if (content.isBlank() && title.isBlank()) return

            val packageName = sbn.packageName ?: ""
            val timestamp = sbn.postTime

            val item = JSONObject().apply {
                put("id", UUID.randomUUID().toString())
                put("packageName", packageName)
                put("title", title)
                put("text", content)
                put("timestamp", timestamp)
            }

            storeNotification(item)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling posted notification", e)
        }
    }

    private fun storeNotification(item: JSONObject) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_NOTIFICATIONS, "[]") ?: "[]"
        val array = try {
            JSONArray(raw)
        } catch (e: Exception) {
            JSONArray()
        }

        array.put(item)

        // Cap queue size to prevent unbounded storage
        val trimmed = if (array.length() > MAX_QUEUE_SIZE) {
            val newArr = JSONArray()
            val start = array.length() - MAX_QUEUE_SIZE
            for (i in start until array.length()) {
                newArr.put(array.get(i))
            }
            newArr
        } else {
            array
        }

        prefs.edit().putString(KEY_NOTIFICATIONS, trimmed.toString()).apply()
    }
}

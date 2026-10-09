package com.tirtharajbarma.subscription

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray

class TransactionTrackerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TransactionTracker"

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        try {
            val packageName = reactContext.packageName
            val packages = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
            val isEnabled = packages.contains(packageName)
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.reject("ERR_PERMISSION_CHECK", e.message, e)
        }
    }

    @ReactMethod
    fun openNotificationListenerSettings() {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            // Fallback to app details
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(fallback)
        }
    }

    @ReactMethod
    fun getPendingNotifications(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                MonevoNotificationListenerService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            val raw = prefs.getString(MonevoNotificationListenerService.KEY_NOTIFICATIONS, "[]") ?: "[]"
            promise.resolve(raw)
        } catch (e: Exception) {
            promise.reject("ERR_READ_NOTIFICATIONS", e.message, e)
        }
    }

    @ReactMethod
    fun ackNotification(id: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                MonevoNotificationListenerService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            val raw = prefs.getString(MonevoNotificationListenerService.KEY_NOTIFICATIONS, "[]") ?: "[]"
            val array = JSONArray(raw)
            val updated = JSONArray()

            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                if (item.optString("id") != id) {
                    updated.put(item)
                }
            }

            prefs.edit().putString(MonevoNotificationListenerService.KEY_NOTIFICATIONS, updated.toString()).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_ACK_NOTIFICATION", e.message, e)
        }
    }

    @ReactMethod
    fun clearNotifications(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                MonevoNotificationListenerService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            prefs.edit().putString(MonevoNotificationListenerService.KEY_NOTIFICATIONS, "[]").apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_CLEAR_NOTIFICATIONS", e.message, e)
        }
    }
}

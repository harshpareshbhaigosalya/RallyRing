package com.rallyring

import android.app.NotificationManager
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RallyNotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "RallyNotification"
    }

    @ReactMethod
    fun cancelCallNotification(callId: String) {
        try {
            val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(callId, 0)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}

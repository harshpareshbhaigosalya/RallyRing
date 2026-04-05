package com.rallyring

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService

class MyFirebaseMessagingService : ReactNativeFirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Always let React Native try to process it as well
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        if (data["type"] == "INCOMING_CALL") {
            try {
                showCallNotificationNatively(data)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        } else if (data["type"] == "CANCEL_CALL") {
            try {
                cancelCallNotificationNatively(data["callId"])
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun showCallNotificationNatively(data: Map<String, String>) {
        val callId = data["callId"] ?: return
        val callerName = data["callerName"] ?: "Someone"
        val groupName = data["groupName"] ?: "Squad"
        val priority = data["priority"] ?: "casual"
        val isUrgent = priority == "urgent"
        val ringtonePref = data["ringtonePref"] ?: "ringtone"

        val channelId = if (isUrgent) "rally-ring-urgent-$ringtonePref-v1" else "rally-ring-casual-$ringtonePref-v1"
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = if (isUrgent) "URGENT Rally Calls ($ringtonePref)" else "Squad Rally Calls ($ringtonePref)"
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH)
            
            val resId = resources.getIdentifier(ringtonePref, "raw", packageName)
            val finalResId = if (resId != 0) resId else R.raw.ringtone
            val soundUri = Uri.parse("android.resource://$packageName/$finalResId")
            
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()
            channel.setSound(soundUri, audioAttributes)
            channel.enableVibration(true)
            channel.vibrationPattern = if (isUrgent) longArrayOf(200, 200, 200, 200, 200) else longArrayOf(300, 500, 300, 500)
            
            notificationManager.createNotificationChannel(channel)
        }

        // Full Screen Intent setup
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            for ((key, value) in data) {
                putExtra(key, value)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            this, callId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (isUrgent) "💥 URGENT RALLY: ${callerName.uppercase()}" else "🚨 RALLY: ${callerName.uppercase()}"
        val reason = data["reason"] ?: ""
        val text = if (reason.isNotEmpty()) "\"$reason\" in $groupName" else "Incoming rally in $groupName"

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pendingIntent, true)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setOngoing(true)
            .setColor(if (isUrgent) -0x10bbbc else -0x83c513) // #ef4444 and #7c3aed approx

        val notification = builder.build()
        notification.flags = notification.flags or NotificationCompat.FLAG_INSISTENT

        // Notifee natively sets the string as tag, id=0
        notificationManager.notify(callId, 0, notification)
    }

    private fun cancelCallNotificationNatively(callId: String?) {
        if (callId == null) return
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(callId, 0)
    }
}

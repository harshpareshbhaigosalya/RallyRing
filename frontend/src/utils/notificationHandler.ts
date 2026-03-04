import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
    AndroidImportance,
    AndroidCategory,
    AndroidVisibility,
} from '@notifee/react-native';

export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    const data = message.data;
    if (!data) return;

    // ─── CANCEL: Stop ringing for this device ────────────────────────────────
    if (data.type === 'CANCEL_CALL') {
        const cId = data.callId as string;
        try {
            // Cancel the specific call notification
            await notifee.cancelNotification(cId);
            // Also cancel any notification (cover all IDs)
            await notifee.cancelAllNotifications();
            // Stop the foreground service (kills the ringtone loop)
            await notifee.stopForegroundService();
        } catch (e) { }
        return;
    }

    if (data.type !== 'INCOMING_CALL') return;

    const callerName = data.callerName || 'Someone';
    const groupName = data.groupName || 'Group';
    const callId = data.callId as string;
    const reason = (data.reason as string) || '';

    // ─── Create/ensure the call notification channel exists ──────────────────
    // Channel id must match what we use in the notification AND the FCM message
    const channelId = await notifee.createChannel({
        id: 'rally-ring-v7',
        name: 'RallyRing Incoming Calls',
        importance: AndroidImportance.HIGH,
        sound: 'ringtone',           // references: android/app/src/main/res/raw/ringtone.mp3
        vibration: true,
        vibrationPattern: [0, 500, 500, 500],
        lights: true,
        lightColor: '#7C3AED',
        bypassDnd: true,
    });

    // ─── Display the full-screen / heads-up call notification ────────────────
    await notifee.displayNotification({
        id: callId,
        title: `📞 RALLY: ${callerName}`,
        body: reason ? `"${reason}" in ${groupName}` : `Incoming rally in ${groupName}`,
        data: { ...data },
        android: {
            channelId,
            category: AndroidCategory.CALL,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            sound: 'ringtone',
            ongoing: true,           // Cannot be dismissed by swipe
            autoCancel: false,
            loopSound: true,         // Loop the ringtone until cancelled
            // Full-screen intent — shows call UI over lockscreen / other apps
            fullScreenIntent: {
                id: 'default',
                launchActivity: 'com.rallyring.MainActivity',
            },
            pressAction: {
                id: 'default',
                launchActivity: 'default',
            },
            actions: [
                {
                    title: '✅ ACCEPT',
                    pressAction: {
                        id: 'accept',
                        launchActivity: 'default',  // Opens the app
                    },
                },
                {
                    title: '❌ REJECT',
                    pressAction: {
                        id: 'reject',
                        // No launchActivity → handled in background without opening app
                    },
                },
            ],
            // asForegroundService keeps the ringtone alive when app is in background/killed
            asForegroundService: true,
            color: '#7C3AED',
            colorized: true,
        } as any,
    });
}

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
            await notifee.cancelNotification(cId);
            await notifee.cancelAllNotifications();
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
    let channelId = 'rally-ring-v13';
    try {
        channelId = await notifee.createChannel({
            id: 'rally-ring-v13',
            name: 'RallyRing Incoming Calls',
            importance: AndroidImportance.HIGH,
            sound: 'ringtone',
            vibration: true,
            vibrationPattern: [0, 500, 500, 500],
            lights: true,
            lightColor: '#7C3AED',
            bypassDnd: true,
        });
    } catch (e) {
        console.log('Channel creation error', e);
    }

    // ─── Display the full-screen / heads-up call notification ────────────────
    try {
        await notifee.displayNotification({
            id: callId,
            title: `📞 RALLY: ${callerName}`,
            body: reason ? `"${reason}" in ${groupName}` : `Incoming rally in ${groupName}`,
            data: { ...data },
            android: {
                channelId,
                smallIcon: 'ic_launcher', // Mandatory icon or it crashes
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
                    launchActivity: 'default',
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
                        },
                    },
                ],
                // asForegroundService keeps the ringtone alive when app is in background/killed
                asForegroundService: true,
                color: '#7C3AED',
                colorized: true,
            } as any,
        });
    } catch (e) {
        console.error('Initial Notifee full screen failed:', e);
        // Fallback without foreground service / loopsound / fullscreen if Android restricts it
        try {
            await notifee.displayNotification({
                id: callId,
                title: `📞 RALLY: ${callerName}`,
                body: reason ? `"${reason}" in ${groupName}` : `Incoming rally in ${groupName}`,
                data: { ...data },
                android: {
                    channelId,
                    smallIcon: 'ic_launcher',
                    importance: AndroidImportance.HIGH,
                    sound: 'ringtone',
                    pressAction: {
                        id: 'default',
                        launchActivity: 'default',
                    },
                }
            });
        } catch (e2) {
            console.error('Fallback notification failed', e2);
        }
    }
}

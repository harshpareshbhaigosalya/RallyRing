import notifee, {
    AndroidImportance,
    AndroidCategory,
    AndroidVisibility,
    EventType
} from '@notifee/react-native';
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * ─── Main Message Handler ─────────────────────────────────────────────────────
 * Called from both foreground (onMessage) and background (setBackgroundMessageHandler).
 * When app is killed, this runs in a headless JS context.
 * 
 * IMPORTANT: Since we now send notification+data FCM messages, Android OS will
 * ALSO show its own notification when the app is in background/killed.
 * We cancel that system notification first, then show our custom Notifee one
 * with action buttons and looping ringtone.
 */
export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    console.log('[NotificationHandler] received:', JSON.stringify(message.data));
    const data = message.data;
    if (!data) return;

    // ─── CANCEL: Stop ringing ────────────────────────────────────────────────
    if (data.type === 'CANCEL_CALL') {
        const cId = data.callId as string;
        try {
            if (cId) {
                await notifee.cancelNotification(cId);
                console.log('[NotificationHandler] Cancelled specific call:', cId);
            }
        } catch (e) {
            console.error('[NotificationHandler] Error cancelling call:', e);
        }
        return;
    }

    if (data.type !== 'INCOMING_CALL') return;

    const callerName = (data.callerName as string) || 'Someone';
    const groupName = (data.groupName as string) || 'Squad';
    const callId = data.callId as string;
    const reason = (data.reason as string) || '';
    const priority = (data.priority as string) || 'casual';
    const isUrgent = priority === 'urgent';

    if (!callId) {
        console.error('[NotificationHandler] Error: callId missing in incoming call payload.');
        return;
    }

    // ─── 2. Channel Creation ──────────────────────────────────────────────────
    const channelId = isUrgent ? 'rally-ring-urgent' : 'rally-ring-v21';
    try {
        await notifee.createChannel({
            id: channelId,
            name: isUrgent ? 'URGENT Rally Calls' : 'Squad Rally Calls',
            importance: AndroidImportance.HIGH,
            sound: 'ringtone',
            vibration: true,
            vibrationPattern: isUrgent ? [200, 200, 200, 200, 200] : [300, 500, 300, 500],
            lights: true,
            lightColor: isUrgent ? '#ef4444' : '#7C3AED',
            bypassDnd: true,
            visibility: AndroidVisibility.PUBLIC,
        });
    } catch (e) {
        console.warn('[NotificationHandler] Channel creation error:', e);
    }

    // ─── 3. Display Custom Notifee Notification ──────────────────────────────
    try {
        console.log('[NotificationHandler] Displaying call notification:', callId);

        // NATIVE KOTLIN (MyFirebaseMessagingService) ALREADY displays this flawlessly. 
        // Showing it again via Notifee causes duplicate ringing/notifications.
        if (require('react-native').Platform.OS === 'android') {
            return;
        }

        return await notifee.displayNotification({
            id: callId,
            title: isUrgent
                ? `💥 URGENT RALLY: ${callerName.toUpperCase()}`
                : `🚨 RALLY: ${callerName.toUpperCase()}`,
            body: reason
                ? `"${reason}" in ${groupName}`
                : `Incoming rally in ${groupName}`,
            subtitle: groupName,
            data: { ...data, type: 'INCOMING_CALL' },
            android: {
                channelId,
                smallIcon: 'ic_launcher',
                category: AndroidCategory.CALL,
                importance: AndroidImportance.HIGH,
                visibility: AndroidVisibility.PUBLIC,

                // ── Full-Screen Intent ──────────────────────────────────
                fullScreenAction: {
                    id: 'default',
                    launchActivity: 'com.rallyring.MainActivity',
                },

                // ── Press Action ────────────────────────────────────────
                pressAction: {
                    id: 'default',
                    launchActivity: 'com.rallyring.MainActivity',
                },

                // ── Action Buttons ──────────────────────────────────────
                actions: [
                    {
                        title: isUrgent ? '💥 ACCEPT NOW' : '✅ ACCEPT',
                        pressAction: {
                            id: 'accept',
                            launchActivity: 'com.rallyring.MainActivity',
                        },
                    },
                    {
                        title: '❌ DECLINE',
                        pressAction: { id: 'reject' },
                    },
                ],

                color: isUrgent ? '#ef4444' : '#7C3AED',
                colorized: true,

                // ── Persistence ─────────────────────────────────────────
                ongoing: true,
                autoCancel: false,
                asForegroundService: false, // Changed from true to prevent Android 14 FGS Crash
                timeoutAfter: undefined,
                showTimestamp: true,

                // ── Sound ───────────────────────────────────────────────
                sound: 'ringtone',
                loopSound: true,
            },
        });
    } catch (e) {
        console.error('[NotificationHandler] CRITICAL ERROR displaying notification:', e);
    }
}

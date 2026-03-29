import notifee, {
    AndroidImportance,
    AndroidCategory,
    AndroidVisibility,
    EventType,
} from '@notifee/react-native';
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * ─── Notifee Foreground Service Task ──────────────────────────────────────────
 * This keeps the app process alive even when the app is killed.
 * Android will show a persistent notification tied to this service.
 * The service stops when the user responds (accept/reject) or call is cancelled.
 */
export function registerForegroundServiceTask() {
    notifee.registerForegroundService((notification) => {
        return new Promise<void>((resolve) => {
            // Listen for user interaction while the foreground service is running
            const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
                // When user presses an action on the notification
                if (
                    type === EventType.ACTION_PRESS ||
                    type === EventType.DISMISSED
                ) {
                    // The actual response handling is done in index.js and App.tsx
                    // Here we just stop the foreground service
                    if (detail.notification?.id === notification.id) {
                        unsubscribe();
                        resolve(); // This stops the foreground service
                    }
                }
            });

            // Safety: auto-stop foreground service after 10 minutes (call timeout)
            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 600000);
        });
    });
}

/**
 * ─── Main Message Handler ─────────────────────────────────────────────────────
 * Called from both foreground (onMessage) and background (setBackgroundMessageHandler).
 * When app is killed, this runs in a headless JS context.
 */
export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    console.log('[NotificationHandler] received:', JSON.stringify(message.data));
    const data = message.data;
    if (!data) return;

    // ─── CANCEL: Stop ringing ────────────────────────────────────────────────
    if (data.type === 'CANCEL_CALL') {
        const cId = data.callId as string;
        try {
            await notifee.cancelNotification(cId);
            console.log('[NotificationHandler] Cancelled call:', cId);
        } catch (e) {
            console.error('[NotificationHandler] Error cancelling call:', e);
        }
        // Stop the foreground service when call is cancelled
        try {
            await notifee.stopForegroundService();
        } catch (e) { }
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

    // ─── 1. Channel Creation ──────────────────────────────────────────────────
    // Create the channel every time (idempotent operation)
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

    // ─── 2. Display Notification with Foreground Service ──────────────────────
    // Using asForegroundService: true makes Android keep the process alive
    // even when the app is killed. This is the KEY to making calls work
    // when the app is off.
    try {
        console.log('[NotificationHandler] Displaying call notification with FG service:', callId);

        await notifee.displayNotification({
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
                // This launches the app over the lock screen like a phone call
                fullScreenAction: {
                    id: 'default',
                    launchActivity: 'default',
                },

                // ── Press Action ────────────────────────────────────────
                pressAction: {
                    id: 'default',
                    launchActivity: 'default',
                },

                // ── Action Buttons ──────────────────────────────────────
                actions: [
                    {
                        title: isUrgent ? '💥 ACCEPT NOW' : '✅ ACCEPT',
                        pressAction: {
                            id: 'accept',
                            launchActivity: 'default',
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
                ongoing: true,      // Cannot be swiped away
                autoCancel: false,  // Stays until explicitly cancelled
                showTimestamp: true,

                // ── Sound ───────────────────────────────────────────────
                sound: 'ringtone',
                loopSound: true,    // KEY: Loop the ringtone continuously!

                // ── Foreground Service ───────────────────────────────────
                // This is the CRITICAL flag that keeps the process alive
                // when the app is killed. Without this, Android will terminate
                // the headless JS task after ~30 seconds.
                asForegroundService: true,
            },
        });
        console.log('[NotificationHandler] Call notification displayed successfully.');
    } catch (e) {
        console.error('[NotificationHandler] CRITICAL ERROR displaying notification:', e);

        // Fallback: try without foreground service in case of any issue
        try {
            await notifee.displayNotification({
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
                    fullScreenAction: {
                        id: 'default',
                        launchActivity: 'default',
                    },
                    pressAction: {
                        id: 'default',
                        launchActivity: 'default',
                    },
                    actions: [
                        {
                            title: isUrgent ? '💥 ACCEPT NOW' : '✅ ACCEPT',
                            pressAction: {
                                id: 'accept',
                                launchActivity: 'default',
                            },
                        },
                        {
                            title: '❌ DECLINE',
                            pressAction: { id: 'reject' },
                        },
                    ],
                    color: isUrgent ? '#ef4444' : '#7C3AED',
                    ongoing: true,
                    autoCancel: false,
                    showTimestamp: true,
                    sound: 'ringtone',
                },
            });
            console.log('[NotificationHandler] Fallback notification displayed.');
        } catch (fallbackErr) {
            console.error('[NotificationHandler] Fallback also failed:', fallbackErr);
        }
    }
}

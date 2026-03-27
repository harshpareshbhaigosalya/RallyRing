import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
    AndroidImportance,
    AndroidCategory,
    AndroidVisibility,
    AndroidForegroundServiceType,
} from '@notifee/react-native';

export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    console.log('[NotificationHandler] received:', JSON.stringify(message.data));
    const data = message.data;
    if (!data) return;

    // ─── CANCEL: Stop ringing ────────────────────────────────────────────────
    if (data.type === 'CANCEL_CALL') {
        const cId = data.callId as string;
        try {
            await notifee.cancelNotification(cId);
            await notifee.stopForegroundService();
            console.log('[NotificationHandler] Cancelled call:', cId);
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

    // ─── 1. Channel Creation ──────────────────────────────────────────────────
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

    // ─── 2. Display Notification ──────────────────────────────────────────────
    try {
        console.log('[NotificationHandler] Displaying call:', callId);
        
        await notifee.displayNotification({
            id: callId,
            title: isUrgent ? `💥 URGENT RALLY: ${callerName.toUpperCase()}` : `🚨 RALLY: ${callerName.toUpperCase()}`,
            body: reason ? `"${reason}" in ${groupName}` : `Incoming rally in ${groupName}`,
            subtitle: groupName,
            data: { ...data, type: 'INCOMING_CALL' }, // Ensure type is passed
            android: {
                channelId,
                smallIcon: 'ic_launcher',
                category: AndroidCategory.CALL,
                importance: AndroidImportance.HIGH, 
                fullScreenAction: {
                    id: 'default',
                    launchActivity: 'com.rallyring.MainActivity',
                },
                pressAction: { id: 'default', launchActivity: 'com.rallyring.MainActivity' },
                actions: [
                    {
                        title: isUrgent ? '💥 ACCEPT NOW' : '✅ ACCEPT',
                        pressAction: { id: 'accept', launchActivity: 'com.rallyring.MainActivity' },
                    },
                    { title: '❌ DECLINE', pressAction: { id: 'reject' } },
                ],
                color: isUrgent ? '#ef4444' : '#7C3AED',
            },
        });
        console.log('[NotificationHandler] Full-screen call signal sent.');
    } catch (e) {
        console.error('[NotificationHandler] CRITICAL ERROR:', e);
    }
}


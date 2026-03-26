import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
    AndroidImportance,
    AndroidCategory,
    AndroidVisibility,
    AndroidForegroundServiceType,
} from '@notifee/react-native';

export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    const data = message.data;
    if (!data) return;

    // ─── CANCEL: Stop ringing for this device ────────────────────────────────
    if (data.type === 'CANCEL_CALL') {
        const cId = data.callId as string;
        try {
            await notifee.cancelNotification(cId);
            await notifee.stopForegroundService();
        } catch (e) { }
        return;
    }

    if (data.type !== 'INCOMING_CALL') return;

    const callerName = (data.callerName as string) || 'Someone';
    const groupName = (data.groupName as string) || 'Group';
    const callId = data.callId as string;
    const reason = (data.reason as string) || '';

    const priority = (data.priority as string) || 'casual';
    const isUrgent = priority === 'urgent';

    // ─── Create/ensure the call notification channel exists ──────────────────
    let channelId = isUrgent ? 'rally-ring-urgent' : 'rally-ring-v21';
    try {
        await notifee.createChannel({
            id: channelId,
            name: isUrgent ? 'URGENT Rally Calls' : 'Ongoing Rally Calls',
            importance: AndroidImportance.HIGH, 
            sound: 'ringtone',
            vibration: true,
            vibrationPattern: isUrgent ? [200, 200, 200, 200, 200] : [300, 500, 300, 500, 300, 500],
            lights: true,
            lightColor: isUrgent ? '#ef4444' : '#7C3AED',
            bypassDnd: true,
            visibility: AndroidVisibility.PUBLIC,
        });
    } catch (e) { }

    // ─── Display the full-screen / heads-up call notification ────────────────
    try {
        await notifee.displayNotification({
            id: callId,
            title: isUrgent ? `💥 URGENT RALLY: ${callerName.toUpperCase()}` : `🚨 RALLY: ${callerName.toUpperCase()}`,
            body: reason ? `"${reason}" in ${groupName}` : `Incoming rally in ${groupName}`,
            subtitle: groupName,
            data: { ...data },
            android: {
                channelId,
                smallIcon: 'ic_launcher',
                category: AndroidCategory.CALL,
                importance: AndroidImportance.HIGH, 
                visibility: AndroidVisibility.PUBLIC,
                sound: 'ringtone',
                ongoing: true,
                autoCancel: false,
                fullScreenAction: {
                    id: 'default',
                    launchActivity: 'com.rallyring.MainActivity',
                },
                asForegroundService: true,
                foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_PHONE_CALL],
                pressAction: {
                    id: 'default',
                    launchActivity: 'com.rallyring.MainActivity',
                },
                actions: [
                    {
                        title: isUrgent ? '💥 ACCEPT NOW' : '✅ ACCEPT',
                        pressAction: { id: 'accept', launchActivity: 'com.rallyring.MainActivity' },
                    },
                    { title: '❌ DECLINE', pressAction: { id: 'reject' } },
                ],
                color: isUrgent ? '#ef4444' : '#7C3AED',
                colorized: true,
                looping: true,
            } as any,
        });
    } catch (e) {
        console.error('Initial Notifee full screen failed:', e);
        // Fallback: simple heads-up notification
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
                        launchActivity: 'com.rallyring.MainActivity',
                    },
                }
            });
        } catch (e2) {
            console.error('Fallback notification failed', e2);
        }
    }
}


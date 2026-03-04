import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    const data = message.data;
    if (!data) return;

    if (data.type === 'CANCEL_CALL') {
        const cId = data.callId as string;
        await notifee.cancelNotification(cId);
        await notifee.stopForegroundService();
        return;
    }

    if (data.type !== 'INCOMING_CALL') return;

    const callerName = data.callerName || 'Someone';
    const groupName = data.groupName || 'Group';
    const callId = data.callId as string;
    const reason = data.reason || '';

    // MAX importance (5) for guaranteed full-screen and continuous ringing
    const channelId = await notifee.createChannel({
        id: 'rally-calls-infinite-v2', // Changed ID to force update
        name: 'Urgent Squadron Alerts',
        importance: 5 as any,
        sound: 'ringtone',
        vibration: true,
        // Extremely long vibration sequence (simulate infinite ring)
        vibrationPattern: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
    });

    await notifee.displayNotification({
        id: callId,
        title: `📞 RALLY: ${callerName}`,
        body: reason ? `"${reason}" in ${groupName}` : `Incoming call in ${groupName}`,
        data: { ...data },
        android: {
            channelId,
            category: AndroidCategory.CALL,
            importance: 5, // MAX
            priority: 'high',
            ongoing: true, // Prevents swipe-away
            autoCancel: false,
            loopSound: true, // Infinite ringtone loop
            fullScreenIntent: {
                id: 'default',
                launchActivity: 'com.rallyring.MainActivity',
            },
            pressAction: { id: 'default', launchActivity: 'default' },
            actions: [
                {
                    title: '✅ ACCEPT',
                    pressAction: { id: 'accept', launchActivity: 'default' },
                },
                {
                    title: '❌ REJECT',
                    pressAction: { id: 'reject' },
                },
            ],
            asForegroundService: true,
            color: '#7C3AED',
        } as any,
    });
}

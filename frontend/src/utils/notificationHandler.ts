import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    const data = message.data;
    if (!data || data.type !== 'INCOMING_CALL') return;

    const callerName = data.callerName || 'Someone';
    const groupName = data.groupName || 'Group';
    const callId = data.callId as string;
    const reason = data.reason || '';

    // Create channel
    const channelId = await notifee.createChannel({
        id: 'rally-calls-v2',
        name: 'Urgent Rally Calls',
        importance: AndroidImportance.HIGH,
        sound: 'ringtone',
        vibration: true,
        vibrationPattern: [500, 500, 500, 500, 800, 800], // Professional pulsing vibration
    });

    await notifee.displayNotification({
        id: callId,
        title: `📞 RALLY: ${callerName}`,
        body: reason ? `"${reason}" in ${groupName}` : `Incoming call in ${groupName}`,
        data: { ...data },
        android: {
            channelId,
            category: AndroidCategory.CALL,
            importance: AndroidImportance.HIGH,
            priority: 'high',
            ongoing: true,
            autoCancel: false,
            fullScreenIntent: { id: 'default' },
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
            // Use foreground service to help persist the notification
            asForegroundService: true,
            color: '#7C3AED',
        } as any,
    });
}

// Background handler
messaging().setBackgroundMessageHandler(onMessageReceived);

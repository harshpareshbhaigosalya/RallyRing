import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

export async function onMessageReceived(message: FirebaseMessagingTypes.RemoteMessage) {
    const data = message.data;
    if (!data) return;

    if (data['type'] === 'INCOMING_CALL') {
        const callerName = data['callerName'] || 'Someone';
        const groupName = data['groupName'] || 'a group';
        const callId = data['callId'] || 'unknown';

        // 1. Create a high importance channel
        const channelId = await notifee.createChannel({
            id: 'incoming-calls',
            name: 'Incoming Calls',
            importance: AndroidImportance.HIGH,
            sound: 'ringtone', // Must exist in android/app/src/main/res/raw/ringtone.mp3
            vibration: true,
            vibrationPattern: [300, 500],
        });

        // 2. Display the notification with Full Screen Intent
        await notifee.displayNotification({
            title: 'Incoming RallyRing Call',
            body: `${callerName} is calling in ${groupName}`,
            android: {
                channelId,
                category: AndroidCategory.CALL,
                importance: AndroidImportance.HIGH,
                fullScreenIntent: {
                    id: 'default',
                    launchActivity: 'default'
                },
                actions: [
                    {
                        title: 'Accept',
                        pressAction: { id: 'accept', launchActivity: 'default' },
                    },
                    {
                        title: 'Reject',
                        pressAction: { id: 'reject' },
                    },
                ],
                asForegroundService: true,
                ongoing: true,
            } as any,
            data: {
                callId,
                groupName,
                callerName,
                type: 'INCOMING_CALL'
            }
        });
    }
}

// Background handler
messaging().setBackgroundMessageHandler(onMessageReceived);

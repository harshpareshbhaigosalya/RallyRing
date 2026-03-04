/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import notifee, { EventType } from '@notifee/react-native';
import { onMessageReceived } from './src/utils/notificationHandler';

// Register background handler once at the root
messaging().setBackgroundMessageHandler(onMessageReceived);

// Handle notification actions (Accept/Reject) from background
notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) {
        const { callId } = detail.notification?.data || {};
        const uid = auth().currentUser?.uid;

        // Stop ringing immediately
        try {
            await notifee.stopForegroundService();
            if (detail.notification?.id) {
                await notifee.cancelNotification(detail.notification.id);
            }

            // Sync response to firestore even from background
            if (callId && uid) {
                const status = detail.pressAction?.id === 'accept' ? 'accepted' : 'rejected';
                await firestore().collection('call_sessions').doc(callId as string).update({
                    [`responses.${uid}`]: status
                });
            }
        } catch (e) { }
    }
});

// Essential: Register Foreground Service to keep notifications alive indefinitely
notifee.registerForegroundService((notification) => {
    return new Promise(() => {
        // Managed via onMessageReceived and RingingScreen
    });
});

AppRegistry.registerComponent(appName, () => App);

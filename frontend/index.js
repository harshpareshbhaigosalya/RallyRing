/**
 * @format
 * RallyRing - Entry point
 * All background/headless handlers MUST be registered here (before AppRegistry).
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onMessageReceived } from './src/utils/notificationHandler';

// ─── 1. FCM Background handler (app in background or killed) ─────────────────
messaging().setBackgroundMessageHandler(onMessageReceived);

// ─── 2. Notifee Background event handler ──────────────────────────────────────
notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS) {
        return;
    }

    const pressAction = detail.pressAction;
    const actionId = pressAction ? pressAction.id : null;
    const notifData = detail.notification ? detail.notification.data : {};
    const callId = notifData ? notifData.callId : null;

    if (!callId) {
        return;
    }

    // Get the user uid from AsyncStorage (persisted by zustand)
    let uid = null;
    try {
        const stored = await AsyncStorage.getItem('rally-ring-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.state && parsed.state.user) {
                uid = parsed.state.user.uid;
            }
        }
    } catch (e) { }

    if (uid) {
        if (actionId === 'accept') {
            try {
                await firestore()
                    .collection('call_sessions')
                    .doc(callId)
                    .update({ ['responses.' + uid]: 'accepted' });
            } catch (e) { }
        } else if (actionId === 'reject') {
            try {
                await firestore()
                    .collection('call_sessions')
                    .doc(callId)
                    .update({ ['responses.' + uid]: 'rejected' });
            } catch (e) { }
            try {
                await notifee.cancelNotification(callId);
                await notifee.stopForegroundService();
            } catch (e) { }
        }
    }

    if (actionId === 'reject') {
        try {
            const notifId = detail.notification ? detail.notification.id : null;
            if (notifId) {
                await notifee.cancelNotification(notifId);
            }
            await notifee.stopForegroundService();
        } catch (e) { }
    }
});

// ─── 3. Notifee Foreground Service ────────────────────────────────────────────
notifee.registerForegroundService(function (notification) {
    return new Promise(function () {
        // Stays alive until notifee.stopForegroundService() is called
    });
});

AppRegistry.registerComponent(appName, () => App);

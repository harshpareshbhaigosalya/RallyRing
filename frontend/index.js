/**
 * @format
 * RallyRing - Entry point
 * All background/headless handlers MUST be registered here (before AppRegistry).
 */

import 'react-native-gesture-handler';
import { AppRegistry, Vibration } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onMessageReceived } from './src/utils/notificationHandler';

// ─── 0. Mandatory FCM Device Registration (For Data-Only Messages) ───────────
messaging().registerDeviceForRemoteMessages().catch(() => {});

// ─── 1. FCM Background handler (app in background or killed) ─────────────────

console.log('[RallyRing] Global Background Handler Registered');
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[RallyRing] BACKGROUND/HEADLESS MSG RECEIVED');
    try {
        if (remoteMessage && remoteMessage.data) {
            await onMessageReceived(remoteMessage);
        }
    } catch (error) {
        console.error('[RallyRing] Background handler error:', error);
    }
    return Promise.resolve();
});

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
            } catch (e) { }
        }
    }

    if (actionId === 'reject') {
        try {
            const notifId = detail.notification ? detail.notification.id : null;
            if (notifId) {
                await notifee.cancelNotification(notifId);
            }
        } catch (e) { }
    }
});


AppRegistry.registerComponent(appName, () => App);

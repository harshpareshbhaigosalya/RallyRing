/**
 * @format
 * RallyRing - Entry point
 * All background/headless handlers MUST be registered here (before AppRegistry).
 * 
 * CRITICAL: The order of registration matters!
 * 1. Foreground service task (must be first — Android needs this before any notification uses it)
 * 2. FCM background handler
 * 3. Notifee background event handler
 * 4. App component registration
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

// ─── 0. Mandatory Foreground Service Task Registration ───────────────────────
// Required by Notifee to keep the ringing notification alive for more than 30s.
notifee.registerForegroundService((notification) => {
    return new Promise(() => {
        // Keeps the light ringing even if JS task is suspended by system
        console.log('[RallyRing] Foreground Service Task Started for:', notification.id);
    });
});

// Removed FGS registration to prevent SecurityException crashes on Android 14+

// ─── 1. Mandatory FCM Device Registration ───────────────────────────────────
messaging().registerDeviceForRemoteMessages().catch(() => {});

// ─── 2. FCM Background handler (app in background or killed) ─────────────────
console.log('[RallyRing] Global Background Handler Registered');
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[RallyRing] BACKGROUND/HEADLESS MSG RECEIVED:', JSON.stringify(remoteMessage.data));
    try {
        if (remoteMessage && remoteMessage.data) {
            await onMessageReceived(remoteMessage);
        }
    } catch (error) {
        console.error('[RallyRing] Background handler error:', error);
    }
    return Promise.resolve();
});

// ─── 3. Notifee Background event handler ──────────────────────────────────────
// Handles Accept/Reject button presses when the app is in background or killed.
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const pressAction = detail.pressAction;
    const actionId = pressAction ? pressAction.id : null;
    const notifData = detail.notification ? detail.notification.data : {};
    const callId = notifData ? notifData.callId : null;

    // For ACTION_PRESS events, handle accept/reject
    if (type === EventType.ACTION_PRESS) {
        if (!callId) return;

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
            if (actionId === 'accept' || actionId === 'default') {
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
            }
        }

        // Stop the foreground service and cancel notification on reject
        if (actionId === 'reject') {
            try {
                await notifee.cancelNotification(callId);
            } catch (e) { }
        }

        // Stop foreground service on any action (accept or reject)
        try {
            await notifee.stopForegroundService();
        } catch (e) { }

        // Cancel notification on reject
        if (actionId === 'reject') {
            try {
                const notifId = detail.notification ? detail.notification.id : null;
                if (notifId) {
                    await notifee.cancelNotification(notifId);
                }
            } catch (e) { }
        }
    }

    // Handle DELIVERED event — no action needed, just acknowledge
    if (type === EventType.DELIVERED) {
        return;
    }
});

// ─── 4. Register App Component ────────────────────────────────────────────────
AppRegistry.registerComponent(appName, () => App);

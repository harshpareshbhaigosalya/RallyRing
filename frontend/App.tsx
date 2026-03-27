import React, { useEffect, useRef } from 'react';
import { StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import notifee, { EventType, AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import { onMessageReceived } from './src/utils/notificationHandler';
import { navigate } from './src/navigation/navigationUtils';
import { useStore } from './src/store/useStore';
import { updateToken } from './src/api/auth';

const App = () => {
  const { user } = useStore();
  // Track if we've already handled the initial notification to prevent double-navigating
  const initialNotifHandled = useRef(false);

  useEffect(() => {
    // ── 1. Permission and Token registration ───────────────────────────
    const setupApp = async () => {
      // FCM Permissions
      const authStatus = await messaging().requestPermission();
      
      // Notifee Permissions (Local notifications, Android 13+)
    // ─── 1. Channel Initialization (Done once for speed in background) ───
    const initChannels = async () => {
      try {
        await notifee.createChannel({
          id: 'rally-ring-urgent',
          name: 'URGENT Rally Calls',
          importance: AndroidImportance.HIGH, 
          sound: 'ringtone',
          vibration: true,
          vibrationPattern: [200, 200, 200, 200, 200],
          lights: true,
          lightColor: '#ef4444',
          bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        });
        await notifee.createChannel({
          id: 'rally-ring-v21',
          name: 'Squad Rally Calls',
          importance: AndroidImportance.HIGH, 
          sound: 'ringtone',
          vibration: true,
          vibrationPattern: [300, 500, 300, 500],
          lights: true,
          lightColor: '#7C3AED',
          bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        });
      } catch (e) { console.warn('Channel init error:', e); }
    };
    initChannels();

    // ─── 2. Permissions ───────────────────────────────────────────────────
    if (Platform.OS === 'android') {
      notifee.requestPermission();
    }
      if (authStatus >= 1 && user?.uid) {
        try {
          const token = await messaging().getToken();
          await updateToken(user.uid, token);
        } catch (e) { }
      }
    };
    setupApp();

    // Refresh token whenever it rotates
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
      if (user?.uid) updateToken(user.uid, token);
    });

    // ── 2. Foreground FCM message handler ─────────────────────────────────
    //    When the app is in foreground and an FCM message arrives,
    //    show the local Notifee notification AND navigate to RingingScreen
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      // Show local notification (so the full-screen intent fires even in fg)
      await onMessageReceived(remoteMessage);

      if (remoteMessage.data?.type === 'INCOMING_CALL') {
        const { callId, groupName, callerName, reason } = remoteMessage.data;
        // Short delay to let navigation mount first
        setTimeout(() => {
        navigate('Ringing', {
            callId,
            groupName,
            callerName,
            reason: (reason as string) || '',
            priority: (remoteMessage.data?.priority as string) || 'casual',
          });
        }, 300);
      }

      // If a CANCEL_CALL comes through foreground, notificationHandler already
      // called cancelAllNotifications – but if we're on RingingScreen, we need
      // to handle nav. That's done via the onSnapshot listener in RingingScreen.
    });

    // ── 3. Foreground Notifee action handler ──────────────────────────────
    //    Handles Accept / Reject pressed from the heads-up notification
    //    while the app is in the foreground.
    const unsubscribeNotifee = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        const notifData = detail.notification?.data || {};
        const callId = notifData.callId as string | undefined;

        if (!callId || !user?.uid) return;

        if (detail.pressAction?.id === 'accept' || detail.pressAction?.id === 'default') {
          try {
            await firestore()
              .collection('call_sessions')
              .doc(callId)
              .update({ [`responses.${user?.uid || 'offline'}`]: 'accepted' });
          } catch (e) { }
          navigate('Ringing', {
            callId,
            groupName: notifData.groupName,
            callerName: notifData.callerName,
            reason: (notifData.reason as string) || '',
            priority: (notifData.priority as string) || 'casual',
          });
        } else if (detail.pressAction?.id === 'reject') {
          try {
            await firestore()
              .collection('call_sessions')
              .doc(callId)
              .update({ [`responses.${user.uid}`]: 'rejected' });
            await notifee.cancelNotification(callId);
          } catch (e) { }
        }
      }

      // Handle the notification being dismissed
      if (type === EventType.DISMISSED) {
        // Don't auto-reject on dismiss – user might swipe away accidentally
        // (ongoing: true prevents this, but just in case)
      }
    });

    // ── 4. App opened by tapping FCM notification (background → foreground) ──
    messaging().onNotificationOpenedApp(remoteMessage => {
      if (remoteMessage.data?.type === 'INCOMING_CALL' && remoteMessage.data?.callId) {
        const { callId, groupName, callerName, reason } = remoteMessage.data;
        navigate('Ringing', {
          callId,
          groupName,
          callerName,
          reason: (reason as string) || '',
          priority: (remoteMessage.data?.priority as string) || 'casual',
        });
      }
    });

    // ── 5. App launched from KILLED state via notification tap ─────────────
    const checkInitialNotification = async () => {
      if (initialNotifHandled.current) return;

      // Check Notifee initial notification
      const initial = await notifee.getInitialNotification();
      if (initial?.notification?.data?.callId) {
        initialNotifHandled.current = true;
        const { callId, groupName, callerName, reason, priority = 'casual' } = initial.notification.data;

        if (initial.pressAction?.id === 'accept' && user?.uid) {
          try {
            await firestore().collection('call_sessions').doc(callId as string)
              .update({ [`responses.${user.uid}`]: 'accepted' });
          } catch (e) { }
        }

        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          const success = navigate('Ringing', {
            callId, groupName, callerName,
            reason: (reason as string) || '',
            priority: (priority as string) || 'casual',
          });
          if (success || attempts > 50) clearInterval(interval);
        }, 100);
        return;
      }

      // Check FCM initial notification
      const fcmInitial = await messaging().getInitialNotification();
      if (fcmInitial?.data?.type === 'INCOMING_CALL' && fcmInitial?.data?.callId) {
        initialNotifHandled.current = true;
        const { callId, groupName, callerName, reason, priority = 'casual' } = fcmInitial.data;
        
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          const success = navigate('Ringing', {
            callId, groupName, callerName,
            reason: (reason as string) || '',
            priority: (priority as string) || 'casual',
          });
          if (success || attempts > 100) clearInterval(interval);
        }, 300); // 300ms intervals to be less aggressive but longer
      }
    };

    checkInitialNotification();

    return () => {
      if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
      unsubscribeForeground();
      unsubscribeNotifee();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const updatePresence = async () => {
      try {
        await firestore().collection('users').doc(user.uid).update({
          lastSeen: firestore.FieldValue.serverTimestamp(),
          status: 'online'
        });
      } catch (e) { }
    };

    // Initial check-in
    updatePresence();

    // Heartbeat every 45s
    const interval = setInterval(updatePresence, 45000);

    return () => clearInterval(interval);
  }, [user?.uid]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
};

export default App;

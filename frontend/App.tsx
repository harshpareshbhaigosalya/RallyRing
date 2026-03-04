import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import notifee, { EventType } from '@notifee/react-native';
import { onMessageReceived } from './src/utils/notificationHandler';
import { navigate } from './src/navigation/navigationUtils';
import { useStore } from './src/store/useStore';
import { updateToken } from './src/api/auth';

const App = () => {
  const { user } = useStore();

  useEffect(() => {
    // 1. Sync Messaging Token & Hierarchy
    const setupMessaging = async () => {
      const authStatus = await messaging().requestPermission();
      if (authStatus >= 1 && user?.uid) {
        try {
          const token = await messaging().getToken();
          await updateToken(user.uid, token);
        } catch (e) { }
      }
    };

    setupMessaging();

    // Listen for token refresh while app is running
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
      if (user?.uid) updateToken(user.uid, token);
    });

    // 2. Setup message listeners
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      // Show local notification using our handler
      await onMessageReceived(remoteMessage);

      // If it's a call, navigate to RingingScreen immediately if in foreground
      if (remoteMessage.data?.type === 'INCOMING_CALL') {
        const { callId, groupName, callerName, reason } = remoteMessage.data;
        setTimeout(() => {
          navigate('Ringing', { callId, groupName, callerName, reason: (reason as string) || '' });
        }, 500);
      }
    });

    // 3. Handle notification interaction (Accept/Reject from foreground)
    const unsubscribeNotifee = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        const { callId, groupName, callerName, reason } = detail.notification?.data || {};

        if (detail.pressAction?.id === 'accept' || detail.pressAction?.id === 'default') {
          if (callId && user?.uid) {
            try {
              await firestore().collection('call_sessions').doc(callId as string).update({
                [`responses.${user.uid}`]: 'accepted'
              });
            } catch (e) { }
            navigate('Ringing', { callId, groupName, callerName, reason: reason || '' });
          }
        } else if (detail.pressAction?.id === 'reject') {
          if (callId && user?.uid) {
            try {
              await firestore().collection('call_sessions').doc(callId as string).update({
                [`responses.${user.uid}`]: 'rejected'
              });
            } catch (e) { }
            await notifee.stopForegroundService();
          }
        }
      }
    });

    // 4. Handle initial notification (when app is opened from a notification)
    const checkInitialNotification = async () => {
      const initial = await notifee.getInitialNotification();
      if (initial && initial.notification?.data?.callId) {
        const { callId, groupName, callerName, reason } = initial.notification.data;
        let attempts = 0;
        const interval = setInterval(() => {
          if (navigate('Ringing', { callId, groupName, callerName, reason: reason || '' })) {
            clearInterval(interval);
          } else if (attempts > 30) {
            clearInterval(interval);
          }
          attempts++;
        }, 100);
      }
    };
    checkInitialNotification();

    // 5. Listen for background messages that open the app (FCM fallback)
    messaging().onNotificationOpenedApp(remoteMessage => {
      if (remoteMessage.data?.callId) {
        const { callId, groupName, callerName, reason } = remoteMessage.data;
        navigate('Ringing', { callId, groupName, callerName, reason: (reason as string) || '' });
      }
    });

    return () => {
      if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
      unsubscribeForeground();
      unsubscribeNotifee();
    };
  }, [user?.uid]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
};

export default App;

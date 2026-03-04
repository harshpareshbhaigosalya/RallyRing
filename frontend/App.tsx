import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { onMessageReceived } from './src/utils/notificationHandler';
import { navigate } from './src/navigation/navigationUtils';

const App = () => {
  useEffect(() => {
    // 1. Request permission for Notifications (Android 13+)
    const requestPermission = async () => {
      const authStatus = await messaging().requestPermission();
      console.log('Permission status:', authStatus);
    };

    requestPermission();

    // 2. Setup message listeners
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      // Show local notification using our handler
      await onMessageReceived(remoteMessage);

      // If it's a call, navigate to RingingScreen immediately if in foreground
      if (remoteMessage.data?.type === 'INCOMING_CALL') {
        const { callId, groupName, callerName, reason } = remoteMessage.data;
        // Small delay to let firestore sync the new call session
        setTimeout(() => {
          navigate('Ringing', { callId, groupName, callerName, reason: (reason as string) || '' });
        }, 500);
      }
    });

    // 3. Handle notification interaction (Accept/Reject from background)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && (detail.pressAction?.id === 'accept' || detail.pressAction?.id === 'default')) {
        const { callId, groupName, callerName, reason } = detail.notification?.data || {};
        if (callId) {
          navigate('Ringing', { callId, groupName, callerName, reason: reason || '' });
        }
      }
    });

    // 4. Handle initial notification (when app is opened from a notification)
    const checkInitialNotification = async () => {
      const initial = await notifee.getInitialNotification();
      if (initial && initial.notification?.data?.callId) {
        const { callId, groupName, callerName, reason } = initial.notification.data;

        // Wait up to 3 seconds for navigator to be ready
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
      unsubscribeForeground();
      unsubscribeNotifee();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
};

export default App;

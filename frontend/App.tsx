import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
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
    const unsubscribeForeground = messaging().onMessage(onMessageReceived);

    // 3. Handle notification interaction (Accept/Reject from background)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && (detail.pressAction?.id === 'accept' || detail.pressAction?.id === 'default')) {
        const { callId, groupName, callerName } = detail.notification?.data || {};
        if (callId) {
          navigate('Ringing', { callId, groupName, callerName });
        }
      }
    });

    // Listen for background messages that open the app
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
    });

    return () => {
      unsubscribeForeground();
      unsubscribeNotifee();
    };
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppNavigator />
    </>
  );
};

export default App;

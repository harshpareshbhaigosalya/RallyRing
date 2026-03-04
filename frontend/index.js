/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { onMessageReceived } from './src/utils/notificationHandler';

// Register background handler once at the root
messaging().setBackgroundMessageHandler(onMessageReceived);

// Essential: Register Foreground Service to keep notifications alive indefinitely
notifee.registerForegroundService((notification) => {
    return new Promise(() => {
        // Managed via onMessageReceived and RingingScreen
    });
});

AppRegistry.registerComponent(appName, () => App);

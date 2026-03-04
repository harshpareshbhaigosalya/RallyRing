/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import { onMessageReceived } from './src/utils/notificationHandler';

// Register background handler once at the root
messaging().setBackgroundMessageHandler(onMessageReceived);

AppRegistry.registerComponent(appName, () => App);

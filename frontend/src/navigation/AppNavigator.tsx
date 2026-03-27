import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useStore } from '../store/useStore';

import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import { CreateGroupScreen, JoinGroupScreen } from '../screens/GroupActions';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import RingingScreen from '../screens/RingingScreen';
import RallyDetailScreen from '../screens/RallyDetailScreen';

import { navigationRef } from './navigationUtils';

const Stack = createStackNavigator();

const AppNavigator = () => {
    const { user } = useStore();

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    // Not logged in
                    <Stack.Screen name="Register" component={RegisterScreen} />
                ) : (
                    <>
                        <Stack.Screen name="Home" component={HomeScreen} />
                        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
                        <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
                        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
                    </>
                )}
                {/*
                 * RallyRing screen is ALWAYS registered regardless of auth state.
                 * This is critical: when the app is opened cold from a notification,
                 * the user is already authenticated (zustand persists to AsyncStorage),
                 * but we need Ringing to be a valid route at any point.
                 */}
                <Stack.Screen
                    name="Ringing"
                    component={RingingScreen}
                    options={{
                        presentation: 'modal',
                        gestureEnabled: false, // Prevent swipe-to-dismiss during active call
                        cardStyle: { backgroundColor: '#000' },
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;

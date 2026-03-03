import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useStore } from '../store/useStore';

import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import { CreateGroupScreen, JoinGroupScreen } from '../screens/GroupActions';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import RingingScreen from '../screens/RingingScreen';

import { navigationRef } from './navigationUtils';

const Stack = createStackNavigator();

const AppNavigator = () => {
    const { user } = useStore();

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    <Stack.Screen name="Register" component={RegisterScreen} />
                ) : (
                    <>
                        <Stack.Screen name="Home" component={HomeScreen} />
                        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
                        <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
                        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
                        <Stack.Screen
                            name="Ringing"
                            component={RingingScreen}
                            options={{ presentation: 'modal' }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;

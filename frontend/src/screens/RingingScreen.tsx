import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import { useStore } from '../store/useStore';
import { Phone, PhoneOff } from 'lucide-react-native';

const RingingScreen = ({ route, navigation }: any) => {
    const { callId, groupName, callerName } = route.params;
    const { user } = useStore();
    const [pulse] = useState(new Animated.Value(1));

    useEffect(() => {
        // Pulsing animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();

        // Listen for call session status (e.g. if someone else joins or caller cancels)
        const unsubscribe = firestore()
            .collection('call_sessions')
            .doc(callId)
            .onSnapshot(doc => {
                if (doc.exists && doc.data()?.status === 'ended') {
                    stopRingingAndExit();
                }
            });

        return () => unsubscribe();
    }, []);

    const handleResponse = async (status: 'accepted' | 'rejected') => {
        try {
            if (user) {
                await firestore()
                    .collection('call_sessions')
                    .doc(callId)
                    .update({
                        [`responses.${user.uid}`]: status
                    });
            }
            stopRingingAndExit();
        } catch (e) {
            console.error(e);
        }
    };

    const stopRingingAndExit = async () => {
        await notifee.stopForegroundService();
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.callerText}>{callerName}</Text>
            <Text style={styles.groupText}>{groupName}</Text>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => handleResponse('rejected')}
                >
                    <PhoneOff color="white" size={32} />
                    <Text style={styles.buttonText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.acceptButton]}
                    onPress={() => handleResponse('accepted')}
                >
                    <Phone color="white" size={32} />
                    <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center' },
    pulseCircle: { width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255, 255, 255, 0.1)', position: 'absolute' },
    callerText: { fontSize: 32, fontWeight: 'bold', color: 'white', marginTop: 20 },
    groupText: { fontSize: 18, color: '#aaa', marginTop: 10 },
    buttonContainer: { flexDirection: 'row', marginTop: 100, width: '100%', justifyContent: 'space-around' },
    button: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    acceptButton: { backgroundColor: '#4CAF50' },
    rejectButton: { backgroundColor: '#F44336' },
    buttonText: { color: 'white', marginTop: 8, fontSize: 12 }
});

export default RingingScreen;

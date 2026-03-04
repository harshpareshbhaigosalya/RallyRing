import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { registerUser } from '../api/auth';
import { useStore } from '../store/useStore';

const RegisterScreen = ({ navigation }: any) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useStore();

    useEffect(() => {
        const checkPermissions = async () => {
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            if (!enabled) {
                Alert.alert(
                    "Permissions Required",
                    "Please enable notifications in your settings so you don't miss any calls!"
                );
            }
        };
        checkPermissions();
    }, []);

    const handleRegister = async () => {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Name", "Please enter both your first and last name.");
            return;
        }
        setLoading(true);
        try {
            console.log("Starting registration process...");

            // Critical for Android/iOS device registration before token retrieval
            await messaging().registerDeviceForRemoteMessages();
            console.log("Device registered for remote messages");

            const token = await messaging().getToken();
            if (!token) {
                throw new Error("Unable to retrieve firebase token. Check Google Play Services.");
            }
            console.log("FCM Token secured:", token.substring(0, 10) + "...");

            const data = await registerUser(fullName, token);
            if (data && data.uid) {
                setUser({ uid: data.uid, name: fullName, fcmToken: token });
                console.log("User registered successfully with UID:", data.uid);
            } else {
                throw new Error("Backend registration call failed - no UID returned.");
            }
        } catch (error: any) {
            console.error("DEBUG: Registration failed with error:", error);
            let userMsg = "Please check your internet connection.";
            if (error.message?.includes("SERVICE_NOT_AVAILABLE")) userMsg = "Firebase services are temporarily unavailable. Please try again.";
            if (error.message?.includes("backend")) userMsg = "The backend server is not responding. Please try again later.";

            Alert.alert(
                "Registration Failed",
                `${userMsg}\n\nTechnical Error: ${error.message || 'Unknown'}`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>RallyRing</Text>
            <Text style={styles.subtitle}>Enter your name to get started</Text>

            <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor="#666"
                value={firstName}
                onChangeText={setFirstName}
            />

            <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor="#666"
                value={lastName}
                onChangeText={setLastName}
            />

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Join RallyRing</Text>}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 20, justifyContent: 'center' },
    title: { fontSize: 42, color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    subtitle: { fontSize: 16, color: '#aaa', textAlign: 'center', marginBottom: 40 },
    input: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 10, fontSize: 18, marginBottom: 20 },
    button: { backgroundColor: '#7C3AED', padding: 18, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' }
});

export default RegisterScreen;

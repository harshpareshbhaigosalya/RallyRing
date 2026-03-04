import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
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

            // Check for Power Management (Battery Optimization) - Crucial for background work
            const battery = await messaging().isDeviceRegisteredForRemoteMessages; // just a placeholder for check

            if (!enabled) {
                Alert.alert(
                    "Permissions Required",
                    "RallyRing needs notification permissions to alert you for important calls. Please enable them in settings."
                );
            }

            // Power Management guidance
            if (Platform.OS === 'android') {
                Alert.alert(
                    "Background Reliability",
                    "To ensure you receive calls even when your phone is locked or the app is closed, please ensure:\n\n1. Battery Optimization is set to 'Don't Optimize' for RallyRing.\n2. Notifications are set to 'Urgent' or 'High Importance'.",
                    [{ text: "OK" }]
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
            console.log("DEBUG: Starting registration process flow...");

            // 1. Check if device is registered (Essential for Android FCM)
            if (Platform.OS === 'android') {
                await messaging().registerDeviceForRemoteMessages();
                console.log("DEBUG: Android device registered for remote messages.");
            }

            // 2. Fetch the FCM token
            const token = await messaging().getToken();
            if (!token) {
                throw new Error("Unable to retrieve Firebase token. Ensure Google Play Services are working.");
            }
            console.log("DEBUG: FCM Token secured:", token.substring(0, 15) + "...");

            // 3. Register on our backend
            console.log("DEBUG: Calling backend registration for:", fullName);
            const data = await registerUser(fullName, token);

            if (data && data.uid) {
                setUser({ uid: data.uid, name: fullName, fcmToken: token });
                console.log("DEBUG: Final user set with UID:", data.uid);
            } else {
                throw new Error("Backend failed to return a valid UID. Check server logs.");
            }
        } catch (error: any) {
            console.error("DEBUG: CRITICAL REGISTRATION ERROR:", error);

            let userFriendlyMsg = "Something went wrong during registration.";
            if (error.message?.includes("SERVICE_NOT_AVAILABLE")) {
                userFriendlyMsg = "Google Play Services or Firebase is currently unavailable on your device.";
            } else if (error.message?.includes("Network Error")) {
                userFriendlyMsg = "Internet connection lost. Please check your data or Wi-Fi.";
            } else if (error.message?.includes("backend")) {
                userFriendlyMsg = "The server is currently undergoing maintenance. Please try again in a few minutes.";
            }

            Alert.alert(
                "Registration Failed",
                `${userFriendlyMsg}\n\nTechnical Details: ${error.message || 'Unknown'}`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.titleContainer}>
                <Text style={styles.appName}>RALLYRING</Text>
                <Text style={styles.title}>Join the Ring</Text>
                <Text style={styles.subtitle}>Coordinate instantly with your squad</Text>
            </View>

            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="First Name"
                    placeholderTextColor="#666"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCorrect={false}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Last Name"
                    placeholderTextColor="#666"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCorrect={false}
                />

                <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.7 }]}
                    onPress={handleRegister}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.buttonText}>Get Started</Text>
                    )}
                </TouchableOpacity>
            </View>

            <Text style={styles.disclaimer}>By joining, you agree to receive notification alerts for group calls.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 25, justifyContent: 'center' },
    titleContainer: { alignItems: 'center', marginBottom: 50 },
    appName: { color: '#7C3AED', fontSize: 14, fontWeight: 'bold', letterSpacing: 4, marginBottom: 10 },
    title: { fontSize: 38, color: '#fff', fontWeight: 'bold' },
    subtitle: { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
    form: { width: '100%' },
    input: { backgroundColor: '#111', color: '#fff', padding: 18, borderRadius: 15, fontSize: 18, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    button: { backgroundColor: '#7C3AED', padding: 18, borderRadius: 15, alignItems: 'center', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    disclaimer: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 30, paddingHorizontal: 40, lineHeight: 18 }
});

export default RegisterScreen;

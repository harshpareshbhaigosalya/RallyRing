import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { registerUser } from '../api/auth';
import { useStore } from '../store/useStore';
import { Bell, ShieldCheck } from 'lucide-react-native';

const RegisterScreen = ({ navigation }: any) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPermissionWall, setShowPermissionWall] = useState(true);
    const [permissionStage, setPermissionStage] = useState(0); // 0: Notifications, 1: Battery/System
    const { setUser } = useStore();

    const requestMainPermission = async () => {
        setLoading(true);
        try {
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                setPermissionStage(1);
            } else {
                Alert.alert("Permission Required", "RallyRing cannot alert you without notifications. Please allow them manually.");
                setPermissionStage(1);
            }
        } catch (e) {
            setPermissionStage(1);
        } finally {
            setLoading(false);
        }
    };

    const finishPermissions = () => {
        setShowPermissionWall(false);
    };

    const handleRegister = async () => {
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Name", "Please enter both your first and last name.");
            return;
        }
        setLoading(true);
        try {
            if (Platform.OS === 'android') {
                await messaging().registerDeviceForRemoteMessages();
            }

            const token = await messaging().getToken();
            if (!token) throw new Error("Unable to retrieve Firebase token.");

            const data = await registerUser(fullName, token);

            if (data && data.uid) {
                setUser({ uid: data.uid, name: fullName, fcmToken: token });
            } else {
                throw new Error("Backend failed to return a valid UID.");
            }
        } catch (error: any) {
            Alert.alert("Registration Failed", error.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (showPermissionWall) {
        return (
            <View style={styles.wallContainer}>
                <View style={styles.permissionBox}>
                    {permissionStage === 0 ? (
                        <>
                            <View style={styles.iconCircle}>
                                <Bell color="#7C3AED" size={40} />
                            </View>
                            <Text style={styles.wallTitle}>Enable Notifications</Text>
                            <Text style={styles.wallText}>
                                RallyRing needs to alert you when your squad starts a Rally.
                                This will make your phone ring even when locked.
                            </Text>
                            <TouchableOpacity style={styles.primeButton} onPress={requestMainPermission} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primeButtonText}>Allow Access</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={[styles.iconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                                <ShieldCheck color="#4CAF50" size={40} />
                            </View>
                            <Text style={styles.wallTitle}>System Reliability</Text>
                            <Text style={styles.wallText}>
                                For 100% reliability, ensure RallyRing is:{"\n"}
                                1. Set to "Unrestricted" Battery usage.{"\n"}
                                2. Allowed to "Display over other apps".
                            </Text>
                            <TouchableOpacity style={[styles.primeButton, { backgroundColor: '#4CAF50' }]} onPress={finishPermissions} disabled={loading}>
                                <Text style={styles.primeButtonText}>Got it, Let's Start!</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.titleContainer}>
                <Text style={styles.appName}>RALLYRING</Text>
                <Text style={styles.title}>Your Name</Text>
                <Text style={styles.subtitle}>Last step to join the squad</Text>
            </View>

            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="First Name"
                    placeholderTextColor="#666"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoFocus
                />
                <TextInput
                    style={styles.input}
                    placeholder="Last Name"
                    placeholderTextColor="#666"
                    value={lastName}
                    onChangeText={setLastName}
                />
                <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.7 }]}
                    onPress={handleRegister}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Complete Setup</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 25, justifyContent: 'center' },
    wallContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 30 },
    permissionBox: { backgroundColor: '#111', borderRadius: 30, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
    wallTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    wallText: { color: '#aaa', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 35 },
    primeButton: { backgroundColor: '#7C3AED', width: '100%', padding: 18, borderRadius: 15, alignItems: 'center' },
    primeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    titleContainer: { alignItems: 'center', marginBottom: 50 },
    appName: { color: '#7C3AED', fontSize: 14, fontWeight: 'bold', letterSpacing: 4, marginBottom: 10 },
    title: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
    subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
    form: { width: '100%' },
    input: { backgroundColor: '#111', color: '#fff', padding: 18, borderRadius: 15, fontSize: 18, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    button: { backgroundColor: '#7C3AED', padding: 18, borderRadius: 15, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default RegisterScreen;

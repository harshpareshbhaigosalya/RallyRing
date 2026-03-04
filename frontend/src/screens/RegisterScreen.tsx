import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { registerUser } from '../api/auth';
import { useStore } from '../store/useStore';
import { Bell, ShieldCheck, Zap, Settings } from 'lucide-react-native';

const RegisterScreen = ({ navigation }: any) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPermissionWall, setShowPermissionWall] = useState(true);
    const [permissionStage, setPermissionStage] = useState(0); // 0: Notifications, 1: Battery, 2: Overlay
    const { setUser } = useStore();

    const requestNotifications = async () => {
        setLoading(true);
        try {
            // Use notifee for more direct Android 13+ permission request
            const settings = await notifee.requestPermission();
            if (settings.authorizationStatus >= 1) {
                setPermissionStage(1);
            } else {
                Alert.alert("Permission Required", "RallyRing cannot alert you without notifications. Please allow them to continue.");
            }
        } catch (e) {
            setPermissionStage(1);
        } finally {
            setLoading(false);
        }
    };

    const requestBatteryExemption = async () => {
        setLoading(true);
        try {
            await notifee.openBatteryOptimizationSettings();
            setPermissionStage(2);
        } catch (e) {
            setPermissionStage(2);
        } finally {
            setLoading(false);
        }
    };

    const requestOverlayPermission = async () => {
        setLoading(true);
        try {
            // There is no direct API for overlay in RN, so we send to app settings
            Alert.alert(
                "Final Step: Overlay",
                "Please enable 'Display over other apps' in the settings page that opens. This allows the call screen to appear over your lock screen.",
                [{ text: "Open Settings", onPress: () => Linking.openSettings() }]
            );
            setShowPermissionWall(false);
        } catch (e) {
            setShowPermissionWall(false);
        } finally {
            setLoading(false);
        }
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
                <View style={styles.statusBar}>
                    <View style={[styles.statusDot, permissionStage >= 0 && styles.activeDot]} />
                    <View style={[styles.statusDot, permissionStage >= 1 && styles.activeDot]} />
                    <View style={[styles.statusDot, permissionStage >= 2 && styles.activeDot]} />
                </View>

                <View style={styles.permissionBox}>
                    {permissionStage === 0 && (
                        <>
                            <View style={styles.iconCircle}>
                                <Bell color="#7C3AED" size={44} />
                            </View>
                            <Text style={styles.wallTitle}>Rally Alerts</Text>
                            <Text style={styles.wallText}>
                                Allow notifications so you never miss an urgent rally from your squad.
                            </Text>
                            <TouchableOpacity style={styles.primeButton} onPress={requestNotifications} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primeButtonText}>Allow Notifications</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                    {permissionStage === 1 && (
                        <>
                            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
                                <Zap color="#FFC107" size={44} />
                            </View>
                            <Text style={styles.wallTitle}>Battery Bypass</Text>
                            <Text style={styles.wallText}>
                                RallyRing needs to run in the background. Set battery to 'Unrestricted' in the next screen.
                            </Text>
                            <TouchableOpacity style={[styles.primeButton, { backgroundColor: '#FFC107' }]} onPress={requestBatteryExemption} disabled={loading}>
                                {loading ? <ActivityIndicator color="#000" /> : <Text style={[styles.primeButtonText, { color: '#000' }]}>Fix Battery Settings</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                    {permissionStage === 2 && (
                        <>
                            <View style={[styles.iconCircle, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                                <Settings color="#2196F3" size={44} />
                            </View>
                            <Text style={styles.wallTitle}>Full Screen Call</Text>
                            <Text style={styles.wallText}>
                                To show calls on your lock screen, we need 'Overlay' permission. Enable it in App Settings.
                            </Text>
                            <TouchableOpacity style={[styles.primeButton, { backgroundColor: '#2196F3' }]} onPress={requestOverlayPermission} disabled={loading}>
                                <Text style={styles.primeButtonText}>Open App Settings</Text>
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
                <Text style={styles.title}>Welcome!</Text>
                <Text style={styles.subtitle}>Enter your name to start coordination</Text>
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
    statusBar: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
    statusDot: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#222', marginHorizontal: 5 },
    activeDot: { backgroundColor: '#7C3AED' },
    permissionBox: { backgroundColor: '#111', borderRadius: 35, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#222', elevation: 20 },
    iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(124, 58, 237, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
    wallTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    wallText: { color: '#888', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
    primeButton: { backgroundColor: '#7C3AED', width: '100%', padding: 20, borderRadius: 18, alignItems: 'center' },
    primeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    titleContainer: { alignItems: 'center', marginBottom: 50 },
    appName: { color: '#7C3AED', fontSize: 14, fontWeight: 'bold', letterSpacing: 4, marginBottom: 10 },
    title: { fontSize: 36, color: '#fff', fontWeight: 'bold' },
    subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
    form: { width: '100%' },
    input: { backgroundColor: '#111', color: '#fff', padding: 20, borderRadius: 18, fontSize: 18, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    button: { backgroundColor: '#7C3AED', padding: 20, borderRadius: 18, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default RegisterScreen;

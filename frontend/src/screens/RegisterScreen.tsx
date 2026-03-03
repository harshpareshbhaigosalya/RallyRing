import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { registerUser } from '../api/auth';
import { useStore } from '../store/useStore';

const RegisterScreen = ({ navigation }: any) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useStore();

    const handleRegister = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const token = await messaging().getToken();
            console.log("FCM Token secured");
            const data = await registerUser(name, token);

            if (data && data.uid) {
                setUser({ uid: data.uid, name, fcmToken: token });
                console.log("User registered with UID:", data.uid);
            } else {
                throw new Error("Backend did not return a valid user ID.");
            }
        } catch (error: any) {
            console.error("Registration error:", error);
            Alert.alert(
                "Registration Failed",
                error.message || "Please check your internet and if the backend is running."
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
                placeholder="User Name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
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

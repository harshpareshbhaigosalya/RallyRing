import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import { useStore } from '../store/useStore';
import { Phone, PhoneOff, Check, X, Clock } from 'lucide-react-native';

const RingingScreen = ({ route, navigation }: any) => {
    const { callId, groupName, callerName, reason } = route.params;
    const { user } = useStore();
    const [pulse] = useState(new Animated.Value(1));
    const [session, setSession] = useState<any>(null);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});

    useEffect(() => {
        // Pulsing animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();

        const unsubscribe = firestore()
            .collection('call_sessions')
            .doc(callId)
            .onSnapshot(async doc => {
                if (!doc || !doc.exists || doc.data()?.status === 'ended') {
                    stopRingingAndExit();
                    return;
                }
                const data = doc.data();
                if (!data) return;
                setSession(data);

                // Fetch names for all members in the session if not already fetched
                if (data.responses) {
                    const uids = Object.keys(data.responses);
                    for (const uid of uids) {
                        if (!memberNames[uid]) {
                            try {
                                const uDoc = await firestore().collection('users').doc(uid).get();
                                if (uDoc && uDoc.exists()) {
                                    setMemberNames(prev => ({ ...prev, [uid]: uDoc.data()?.name || uid }));
                                }
                            } catch (e) { }
                        }
                    }
                }
            });

        return () => unsubscribe();
    }, [callId]);

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
            if (status === 'rejected') stopRingingAndExit();
        } catch (e) { console.error(e); }
    };

    const stopRingingAndExit = async () => {
        try {
            await notifee.stopForegroundService();
        } catch (err) { }
        navigation.goBack();
    };

    const sections = {
        accepted: [] as string[],
        pending: [] as string[],
        rejected: [] as string[]
    };

    if (session?.responses) {
        Object.entries(session.responses).forEach(([uid, status]: [string, any]) => {
            if (status === 'accepted') sections.accepted.push(uid);
            else if (status === 'rejected') sections.rejected.push(uid);
            else sections.pending.push(uid);
        });
    }

    const MemberList = ({ uids, icon: Icon, color }: any) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Icon color={color} size={16} />
                <Text style={[styles.sectionTitle, { color }]}>
                    {uids.length} {Icon === Check ? 'Accepted' : Icon === X ? 'Rejected' : 'Pending'}
                </Text>
            </View>
            <View style={styles.namesRow}>
                {uids.map((uid: string) => (
                    <Text key={uid} style={styles.nameBadge}>
                        {uid === user?.uid ? 'You' : (memberNames[uid] || 'Loading...')}
                    </Text>
                ))}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.topInfo}>
                <Text style={styles.groupText}>{groupName}</Text>
                <Text style={styles.callerText}>{callerName} is calling...</Text>
                {reason ? (
                    <View style={styles.reasonBox}>
                        <Text style={styles.reasonLabel}>REASON</Text>
                        <Text style={styles.reasonContent}>{reason}</Text>
                    </View>
                ) : null}
            </View>

            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }] }]} />

            <ScrollView style={styles.scroll}>
                <MemberList uids={sections.accepted} icon={Check} color="#4CAF50" />
                <MemberList uids={sections.pending} icon={Clock} color="#FFC107" />
                <MemberList uids={sections.rejected} icon={X} color="#F44336" />
            </ScrollView>

            {session?.responses[user?.uid || ''] === 'pending' ? (
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
            ) : (
                <TouchableOpacity style={styles.exitButton} onPress={stopRingingAndExit}>
                    <Text style={styles.exitButtonText}>{session?.responses[user?.uid || ''] === 'accepted' ? 'Close Ringing View' : 'Back'}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 20 },
    topInfo: { alignItems: 'center', marginTop: 60, zIndex: 10 },
    pulseCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(124, 58, 237, 0.2)', alignSelf: 'center', marginTop: -20 },
    callerText: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 10 },
    groupText: { fontSize: 16, color: '#aaa', textTransform: 'uppercase', letterSpacing: 2 },
    reasonBox: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginTop: 20, width: '100%', alignItems: 'center' },
    reasonLabel: { color: '#7C3AED', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
    reasonContent: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
    scroll: { flex: 1, marginTop: 40 },
    section: { marginBottom: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginLeft: 8, textTransform: 'uppercase' },
    namesRow: { flexDirection: 'row', flexWrap: 'wrap' },
    nameBadge: { backgroundColor: '#1e1e1e', color: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginRight: 8, marginBottom: 8, fontSize: 12 },
    buttonContainer: { flexDirection: 'row', bottom: 40, width: '100%', justifyContent: 'space-around', position: 'absolute', alignSelf: 'center' },
    button: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', elevation: 5 },
    acceptButton: { backgroundColor: '#4CAF50' },
    rejectButton: { backgroundColor: '#F44336' },
    buttonText: { color: 'white', marginTop: 8, fontSize: 12, fontWeight: 'bold' },
    exitButton: { backgroundColor: '#1e1e1e', padding: 18, borderRadius: 15, position: 'absolute', bottom: 40, width: '100%', alignSelf: 'center', alignItems: 'center' },
    exitButtonText: { color: '#fff', fontWeight: 'bold' }
});

export default RingingScreen;

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Dimensions, Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import { useStore } from '../store/useStore';
import { Phone, PhoneOff, Check, X, Clock, Users } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const RingingScreen = ({ route, navigation }: any) => {
    const { callId, groupName, callerName, reason } = route.params;
    const { user } = useStore();
    const [pulse] = useState(new Animated.Value(1));
    const [session, setSession] = useState<any>(null);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});

    useEffect(() => {
        // Pulsing animation for the call icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
            ])
        ).start();

        const unsubscribe = firestore()
            .collection('call_sessions')
            .doc(callId)
            .onSnapshot(async doc => {
                const data = doc?.data();
                if (!doc || !doc.exists || data?.status === 'ended') {
                    stopRingingAndExit();
                    return;
                }

                setSession(data);

                // Auto-end check: If everyone responded, end it for ALL
                if (data?.responses && data.status === 'ringing') {
                    const allResponded = Object.values(data.responses).every((s: any) => s !== 'pending');
                    if (allResponded) {
                        try {
                            await firestore().collection('call_sessions').doc(callId).update({ status: 'ended' });
                        } catch (e) { }
                    }
                }

                // Fetch names for all members in the session if not already fetched
                if (data?.responses) {
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
            if (user && callId) {
                // Remove notification immediately on response
                await notifee.cancelNotification(callId);

                await firestore().collection('call_sessions').doc(callId).update({
                    [`responses.${user.uid}`]: status
                });

                if (status === 'rejected') {
                    await notifee.stopForegroundService();
                    stopRingingAndExit();
                }
            }
        } catch (e) {
            console.error("DEBUG: Response update failed:", e);
        }
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

    const StatList = ({ uids, color, label }: any) => (
        <View style={styles.statBox}>
            <Text style={[styles.statCount, { color }]}>{uids.length}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a1a', '#000', '#000']}
                style={styles.gradient}
            >
                <View style={styles.topSection}>
                    <Text style={styles.groupLabel}>{groupName.toUpperCase()}</Text>
                    <Text style={styles.callerName}>{callerName}</Text>
                    <Text style={styles.callingStatus}>Incoming Rally Call...</Text>
                </View>

                <View style={styles.avatarSection}>
                    <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }] }]} />
                    <View style={styles.avatarMain}>
                        <Phone color="#fff" size={40} />
                    </View>
                </View>

                <View style={styles.reasonContainer}>
                    {reason ? (
                        <View style={styles.reasonBadge}>
                            <Text style={styles.reasonText}>"{reason}"</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.liveSummary}>
                    <StatList uids={sections.accepted} color="#4CAF50" label="Accepted" />
                    <StatList uids={sections.pending} color="#FFC107" label="Pending" />
                    <StatList uids={sections.rejected} color="#F44336" label="Rejected" />
                </View>

                <ScrollView style={styles.memberScroll} contentContainerStyle={styles.memberList}>
                    {Object.entries(session?.responses || {}).map(([uid, status]: [string, any]) => (
                        <View key={uid} style={styles.memberRow}>
                            <Text style={styles.memberName} numberOfLines={1}>
                                {uid === user?.uid ? 'You' : (memberNames[uid] || 'Squad member')}
                            </Text>
                            <View style={[styles.statusTag,
                            status === 'accepted' ? styles.tagAccepted :
                                status === 'rejected' ? styles.tagRejected : styles.tagPending
                            ]}>
                                <Text style={styles.tagText}>{status.toUpperCase()}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.bottomActions}>
                    {session?.responses[user?.uid || ''] === 'pending' ? (
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.circleButton, styles.rejectBtn]}
                                onPress={() => handleResponse('rejected')}
                            >
                                <PhoneOff color="white" size={32} />
                                <Text style={styles.actionLabel}>Decline</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.circleButton, styles.acceptBtn]}
                                onPress={() => handleResponse('accepted')}
                            >
                                <Phone color="white" size={32} />
                                <Text style={styles.actionLabel}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.actionFooter}>
                            {session?.callerId === user?.uid ? (
                                <TouchableOpacity
                                    style={styles.fullEndButton}
                                    onPress={async () => {
                                        await firestore().collection('call_sessions').doc(callId).update({ status: 'ended' });
                                    }}
                                >
                                    <Text style={styles.fullEndButtonText}>END RALLY FOR ALL</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.closeButton} onPress={stopRingingAndExit}>
                                    <Text style={styles.closeButtonText}>DISMISS VIEW</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    gradient: { flex: 1, padding: 30 },
    topSection: { alignItems: 'center', marginTop: height * 0.08 },
    groupLabel: { color: '#7C3AED', fontSize: 13, fontWeight: 'bold', letterSpacing: 3, marginBottom: 10 },
    callerName: { color: '#fff', fontSize: 34, fontWeight: 'bold', textAlign: 'center' },
    callingStatus: { color: '#aaa', fontSize: 16, marginTop: 8 },
    avatarSection: { height: 200, justifyContent: 'center', alignItems: 'center', marginVertical: 30 },
    pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(124, 58, 237, 0.2)', position: 'absolute' },
    avatarMain: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center', elevation: 20, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20 },
    reasonContainer: { height: 60, justifyContent: 'center', alignItems: 'center' },
    reasonBadge: { backgroundColor: '#1e1e1e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, borderWidth: 1, borderColor: '#333' },
    reasonText: { color: '#fff', fontSize: 16, fontStyle: 'italic' },
    liveSummary: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20, backgroundColor: '#111', borderRadius: 20, padding: 15 },
    statBox: { alignItems: 'center' },
    statCount: { fontSize: 20, fontWeight: 'bold' },
    statLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', marginTop: 4 },
    memberScroll: { flex: 1, marginBottom: 20 },
    memberList: { paddingBottom: 20 },
    memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 14, borderRadius: 12, marginBottom: 8 },
    memberName: { color: '#fff', fontSize: 15, flex: 1 },
    statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    tagAccepted: { backgroundColor: 'rgba(76, 175, 80, 0.2)' },
    tagRejected: { backgroundColor: 'rgba(244, 67, 54, 0.2)' },
    tagPending: { backgroundColor: 'rgba(255, 193, 7, 0.2)' },
    tagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    bottomActions: { paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    circleButton: { width: 85, height: 85, borderRadius: 43, justifyContent: 'center', alignItems: 'center', elevation: 10 },
    acceptBtn: { backgroundColor: '#4CAF50' },
    rejectBtn: { backgroundColor: '#F44336' },
    actionLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginTop: 10, position: 'absolute', bottom: -25 },
    actionFooter: { width: '100%' },
    fullEndButton: { backgroundColor: '#F44336', padding: 18, borderRadius: 18, alignItems: 'center' },
    fullEndButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    closeButton: { backgroundColor: '#222', padding: 18, borderRadius: 18, alignItems: 'center' },
    closeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default RingingScreen;

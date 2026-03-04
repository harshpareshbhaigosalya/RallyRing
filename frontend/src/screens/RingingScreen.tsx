import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, ScrollView, Dimensions, Platform, BackHandler
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import { useStore } from '../store/useStore';
import { Phone, PhoneOff } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const { height } = Dimensions.get('window');

const RingingScreen = ({ route, navigation }: any) => {
    const { callId, groupName, callerName, reason } = route.params;
    const { user } = useStore();
    const [pulse] = useState(new Animated.Value(1));
    const [session, setSession] = useState<any>(null);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});
    // Guard to prevent stopCall being called multiple times
    const autoEndFired = useRef(false);

    // ── Prevent hardware back button from bypassing the call screen ──────────
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // Block back button while call is pending for this user
            const myStatus = session?.responses?.[user?.uid || ''];
            if (myStatus === 'pending') return true; // Block
            return false; // Allow
        });
        return () => backHandler.remove();
    }, [session, user?.uid]);

    // ── Pulsing animation ─────────────────────────────────────────────────
    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.35, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, []);

    // ── Firestore real-time listener ──────────────────────────────────────
    useEffect(() => {
        const unsubscribe = firestore()
            .collection('call_sessions')
            .doc(callId)
            .onSnapshot(async doc => {
                if (!doc || !doc.exists) {
                    // Call document gone – end for everyone
                    await stopRinging();
                    navigation.goBack();
                    return;
                }

                const data = doc.data();

                if (data?.status === 'ended') {
                    await stopRinging();
                    navigation.goBack();
                    return;
                }

                setSession(data);

                // ── Auto-end: if everyone responded, caller ends the call ──
                if (data?.responses && data.status === 'ringing' && !autoEndFired.current) {
                    const allResponded = Object.values(data.responses).every(
                        (s: any) => s !== 'pending'
                    );
                    if (allResponded) {
                        autoEndFired.current = true;
                        try {
                            const { stopCall } = require('../api/auth');
                            await stopCall(callId);
                        } catch (e) { }
                    }
                }

                // ── Fetch member names lazily ──────────────────────────────
                if (data?.responses) {
                    const uids = Object.keys(data.responses);
                    for (const uid of uids) {
                        setMemberNames(prev => {
                            if (prev[uid]) return prev; // Already fetched
                            // Trigger async fetch
                            firestore().collection('users').doc(uid).get()
                                .then(uDoc => {
                                    if (uDoc && uDoc.exists()) {
                                        setMemberNames(p => ({ ...p, [uid]: uDoc.data()?.name || uid }));
                                    }
                                })
                                .catch(() => { });
                            return prev;
                        });
                    }
                }
            });

        return () => unsubscribe();
    }, [callId]);

    // ── Helpers ───────────────────────────────────────────────────────────
    const stopRinging = async () => {
        try {
            await notifee.cancelNotification(callId);
            await notifee.stopForegroundService();
        } catch (e) { }
    };

    const handleResponse = async (status: 'accepted' | 'rejected') => {
        try {
            // Stop notification immediately
            await stopRinging();

            if (user?.uid && callId) {
                await firestore()
                    .collection('call_sessions')
                    .doc(callId)
                    .update({ [`responses.${user.uid}`]: status });
            }

            if (status === 'rejected') {
                navigation.goBack();
            }
            // If accepted → stay on screen and show live updates
        } catch (e) {
            console.error('Response update failed:', e);
        }
    };

    const handleEndCallForAll = async () => {
        try {
            await stopRinging();
            const { stopCall } = require('../api/auth');
            await stopCall(callId);
            // navigation will happen via onSnapshot listener (status === 'ended')
        } catch (e) {
            navigation.goBack();
        }
    };

    const handleDismissView = async () => {
        await stopRinging();
        navigation.goBack();
    };

    // ── Categorise responses ──────────────────────────────────────────────
    const sections = { accepted: [] as string[], pending: [] as string[], rejected: [] as string[] };
    if (session?.responses) {
        Object.entries(session.responses).forEach(([uid, s]: [string, any]) => {
            if (s === 'accepted') sections.accepted.push(uid);
            else if (s === 'rejected') sections.rejected.push(uid);
            else sections.pending.push(uid);
        });
    }

    const myStatus = session?.responses?.[user?.uid || ''];
    const amCaller = session?.callerId === user?.uid;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#12052e', '#1a0644', '#000']} style={styles.gradient}>

                {/* ── Top Info ─────────────────────────────────────────── */}
                <View style={styles.topSection}>
                    <Text style={styles.groupLabel}>{(groupName || '').toUpperCase()}</Text>
                    <Text style={styles.callerName}>{callerName}</Text>
                    <Text style={styles.callingStatus}>
                        {myStatus === 'pending' ? 'Incoming Rally Call...' :
                            myStatus === 'accepted' ? '✅ You accepted' :
                                myStatus === 'rejected' ? '❌ You declined' :
                                    'Rally in progress'}
                    </Text>
                </View>

                {/* ── Pulsing Avatar ──────────────────────────────────── */}
                <View style={styles.avatarSection}>
                    <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulse }] }]} />
                    <Animated.View style={[styles.pulseInner, {
                        transform: [{ scale: Animated.divide(pulse, new Animated.Value(1.15)) }]
                    }]} />
                    <View style={styles.avatarMain}>
                        <Phone color="#fff" size={40} />
                    </View>
                </View>

                {/* ── Reason badge ─────────────────────────────────────── */}
                {reason ? (
                    <View style={styles.reasonContainer}>
                        <View style={styles.reasonBadge}>
                            <Text style={styles.reasonText}>"{reason}"</Text>
                        </View>
                    </View>
                ) : <View style={{ height: 20 }} />}

                {/* ── Live stats ──────────────────────────────────────── */}
                <View style={styles.liveSummary}>
                    <View style={styles.statBox}>
                        <Text style={[styles.statCount, { color: '#4CAF50' }]}>{sections.accepted.length}</Text>
                        <Text style={styles.statLabel}>ACCEPTED</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statCount, { color: '#FFC107' }]}>{sections.pending.length}</Text>
                        <Text style={styles.statLabel}>PENDING</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statCount, { color: '#F44336' }]}>{sections.rejected.length}</Text>
                        <Text style={styles.statLabel}>DECLINED</Text>
                    </View>
                </View>

                {/* ── Member list ─────────────────────────────────────── */}
                <ScrollView style={styles.memberScroll} contentContainerStyle={styles.memberList}>
                    {Object.entries(session?.responses || {}).map(([uid, status]: [string, any]) => (
                        <View key={uid} style={styles.memberRow}>
                            <Text style={styles.memberName} numberOfLines={1}>
                                {uid === user?.uid ? 'You' : (memberNames[uid] || 'Loading...')}
                                {uid === session?.callerId ? ' 📞' : ''}
                            </Text>
                            <View style={[
                                styles.statusTag,
                                status === 'accepted' ? styles.tagAccepted :
                                    status === 'rejected' ? styles.tagRejected : styles.tagPending
                            ]}>
                                <Text style={styles.tagText}>
                                    {status === 'accepted' ? '✅ ACCEPTED' :
                                        status === 'rejected' ? '❌ DECLINED' : '⏳ RINGING'}
                                </Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                {/* ── Bottom action buttons ────────────────────────────── */}
                <View style={styles.bottomActions}>
                    {myStatus === 'pending' ? (
                        // Show Accept / Reject only when this user hasn't responded yet
                        <View style={styles.buttonRow}>
                            <View style={styles.btnWrapper}>
                                <TouchableOpacity
                                    style={[styles.circleButton, styles.rejectBtn]}
                                    onPress={() => handleResponse('rejected')}
                                    activeOpacity={0.8}
                                >
                                    <PhoneOff color="white" size={32} />
                                </TouchableOpacity>
                                <Text style={styles.actionLabel}>Decline</Text>
                            </View>

                            <View style={styles.btnWrapper}>
                                <TouchableOpacity
                                    style={[styles.circleButton, styles.acceptBtn]}
                                    onPress={() => handleResponse('accepted')}
                                    activeOpacity={0.8}
                                >
                                    <Phone color="white" size={32} />
                                </TouchableOpacity>
                                <Text style={styles.actionLabel}>Accept</Text>
                            </View>
                        </View>
                    ) : (
                        // Show END / DISMISS after response
                        <View style={styles.actionFooter}>
                            {amCaller ? (
                                <TouchableOpacity
                                    style={styles.fullEndButton}
                                    onPress={handleEndCallForAll}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.fullEndButtonText}>⛔ END RALLY FOR ALL</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={handleDismissView}
                                    activeOpacity={0.8}
                                >
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
    gradient: { flex: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 60 },

    topSection: { alignItems: 'center', marginTop: height * 0.04, marginBottom: 20 },
    groupLabel: { color: '#9F6FFF', fontSize: 12, fontWeight: 'bold', letterSpacing: 4, marginBottom: 10 },
    callerName: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
    callingStatus: { color: '#aaa', fontSize: 15, marginTop: 8 },

    avatarSection: { height: 160, justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
    pulseOuter: {
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: 'rgba(124, 58, 237, 0.15)', position: 'absolute'
    },
    pulseInner: {
        width: 115, height: 115, borderRadius: 57,
        backgroundColor: 'rgba(124, 58, 237, 0.25)', position: 'absolute'
    },
    avatarMain: {
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: '#7C3AED',
        justifyContent: 'center', alignItems: 'center',
        elevation: 20, shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 20
    },

    reasonContainer: { alignItems: 'center', marginBottom: 10 },
    reasonBadge: {
        backgroundColor: '#1a1a2e', paddingHorizontal: 20, paddingVertical: 8,
        borderRadius: 30, borderWidth: 1, borderColor: '#3a3a6e'
    },
    reasonText: { color: '#ddd', fontSize: 15, fontStyle: 'italic' },

    liveSummary: {
        flexDirection: 'row', justifyContent: 'space-around',
        backgroundColor: '#111827', borderRadius: 20, padding: 16,
        marginVertical: 16, borderWidth: 1, borderColor: '#1f2937'
    },
    statBox: { alignItems: 'center', flex: 1 },
    statCount: { fontSize: 22, fontWeight: 'bold' },
    statLabel: { color: '#6b7280', fontSize: 9, textTransform: 'uppercase', marginTop: 4, letterSpacing: 1 },
    statDivider: { width: 1, backgroundColor: '#1f2937' },

    memberScroll: { flex: 1 },
    memberList: { paddingBottom: 12 },
    memberRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#111', padding: 14, borderRadius: 14, marginBottom: 8
    },
    memberName: { color: '#fff', fontSize: 14, flex: 1 },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagAccepted: { backgroundColor: 'rgba(76, 175, 80, 0.2)' },
    tagRejected: { backgroundColor: 'rgba(244, 67, 54, 0.2)' },
    tagPending: { backgroundColor: 'rgba(255, 193, 7, 0.2)' },
    tagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    bottomActions: { paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 10 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    btnWrapper: { alignItems: 'center', gap: 12 },
    circleButton: {
        width: 80, height: 80, borderRadius: 40,
        justifyContent: 'center', alignItems: 'center',
        elevation: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8
    },
    acceptBtn: { backgroundColor: '#22c55e', shadowColor: '#22c55e' },
    rejectBtn: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
    actionLabel: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

    actionFooter: { width: '100%' },
    fullEndButton: {
        backgroundColor: '#ef4444', padding: 18, borderRadius: 18,
        alignItems: 'center', elevation: 8
    },
    fullEndButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    closeButton: {
        backgroundColor: '#1f2937', padding: 18, borderRadius: 18, alignItems: 'center'
    },
    closeButtonText: { color: '#9ca3af', fontWeight: 'bold', fontSize: 15 },
});

export default RingingScreen;

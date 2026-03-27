import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, ScrollView, Dimensions, Platform, BackHandler, Vibration, Modal,
    PanResponder, TextInput
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import { useStore } from '../store/useStore';
import { Phone, PhoneOff, Users, Clock, CheckCircle2, XCircle, AlertTriangle, Send } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');
const { height, width } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const RingingScreen = ({ route, navigation }: any) => {
    const { callId, groupName, callerName, reason, priority = 'casual' } = route.params;
    const { user } = useStore();
    
    const [pulse] = useState(new Animated.Value(1));
    const [session, setSession] = useState<any>(null);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});
    const [memberStatus, setMemberStatus] = useState<Record<string, any>>({});
    const [showQuickRes, setShowQuickRes] = useState(false);
    const [customMsg, setCustomMsg] = useState('');
    
    const autoEndFired = useRef(false);
    const soundRef = useRef<Sound | null>(null);
    const isRinging = useRef(false);

    // -- Swipe Gesture Logic --
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 20,
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy < -50) setShowQuickRes(true);
            }
        })
    ).current;

    const myId = user?.uid || '';
    const myStatus = session?.responses?.[myId];
    const amCaller = session?.callerId === myId;
    const isUrgent = priority === 'urgent' || session?.priority === 'urgent';

    // ── Sound & Vibration ──────────────────────────────────────────────
    const startRinging = () => {
        if (isRinging.current || myStatus !== 'pending' || amCaller) return;

        const ringtone = new Sound('ringtone', '', (error) => {
            if (error) {
                console.warn('Failed to load sound', error);
                return;
            }
            // Continuous loop
            ringtone.setNumberOfLoops(-1);
            ringtone.setVolume(isUrgent ? 1.0 : 0.7);
            ringtone.play((success) => {
                if (!success) console.warn('Sound playback failed');
            });
            isRinging.current = true;
        });
        soundRef.current = ringtone;
        
        const pattern = isUrgent ? [200, 200, 200, 200] : [500, 1000];
        Vibration.vibrate(pattern, true);
    };

    const stopSound = () => {
        if (soundRef.current) {
            try { soundRef.current.stop(); soundRef.current.release(); } catch (e) { }
            soundRef.current = null;
        }
        Vibration.cancel();
        isRinging.current = false;
    };

    useEffect(() => {
        if (session && myStatus === 'pending' && !amCaller) {
             startRinging();
        } else {
             stopSound();
        }
    }, [myStatus, session, amCaller]);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: isUrgent ? 1.6 : 1.3, duration: isUrgent ? 600 : 1200, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: isUrgent ? 600 : 1200, useNativeDriver: true }),
            ])
        ).start();
        return () => stopSound();
    }, [isUrgent]);

    // ── Firestore Sync ──────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = firestore().collection('call_sessions').doc(callId).onSnapshot(async doc => {
            if (!doc || !doc.exists || doc.data()?.status === 'ended') {
                await stopRingingAndClear();
                navigation.goBack();
                return;
            }
            const data = doc.data();
            setSession(data);

            if (data?.responses && !autoEndFired.current) {
                const allResponded = Object.values(data.responses).every(s => s !== 'pending');
                if (allResponded) {
                    autoEndFired.current = true;
                    setTimeout(async () => {
                        try { const { stopCall } = require('../api/auth'); await stopCall(callId); } catch (e) { }
                    }, 2500);
                }
            }

            // Sync Member Names & Status
            Object.keys(data?.responses || {}).forEach(uid => {
                if (!memberNames[uid]) {
                    firestore().collection('users').doc(uid).onSnapshot(uDoc => {
                        if (uDoc.exists()) {
                            const uData = uDoc.data();
                            setMemberNames((p: any) => ({ ...p, [uid]: uData?.name || uid }));
                            setMemberStatus((p: any) => ({ ...p, [uid]: uData }));
                        }
                    });
                }
            });
        });
        return () => unsubscribe();
    }, [callId]);

    const stopRingingAndClear = async () => {
        stopSound();
        try {
            await notifee.cancelNotification(callId);
            await notifee.stopForegroundService();
        } catch (e) { }
    };

    const handleResponse = async (status: string) => {
        try {
            await stopRingingAndClear();
            if (user?.uid && callId) {
                await firestore().collection('call_sessions').doc(callId).update({ [`responses.${user.uid}`]: status });
            }
            if (!status.includes('accepted')) {
                navigation.goBack();
            }
            setShowQuickRes(false);
        } catch (e) { }
    };

    const isOnline = (uid: string) => {
        const uData = memberStatus[uid];
        if (!uData || uData.status !== 'online' || !uData.lastSeen) return false;
        const lastSeenMs = uData.lastSeen.toMillis ? uData.lastSeen.toMillis() : uData.lastSeen;
        return (Date.now() - lastSeenMs) < 90000;
    };

    const theme = isUrgent ? ['#450a0a', '#7f1d1d', '#991b1b'] : ['#0f172a', '#1e1b4b', '#020617'];
    const quickOps = [
        { label: "In 5 mins! 🏃", val: "accepted:5min" },
        { label: "Busy, 15 min ⏳", val: "accepted:15min" },
        { label: "On my way! 🚗", val: "accepted:way" },
        { label: "Can't make it 🛑", val: "rejected" }
    ];

    return (
        <View style={[styles.container, { backgroundColor: '#0a0a0a' }]}>
            <View style={styles.content}>
                {/* Status Bar Spacer */}
                <View style={{ height: 40 }} />
                <View style={styles.header}>
                    <View style={[styles.priorityBadge, isUrgent && { backgroundColor: '#ef4444' }]}>
                        {isUrgent ? <AlertTriangle size={12} color="#fff" /> : <Users size={12} color="#94a3b8" />}
                        <Text style={styles.priorityText}>{priority.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.callerTitle}>{callerName}</Text>
                    <Text style={styles.groupSub}>from {groupName}</Text>
                </View>

                <View style={styles.visualContainer}>
                    <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }], backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)' }]} />
                    <View style={[styles.avatarGlow, isUrgent && { shadowColor: '#ef4444' }]}>
                        <LinearGradient colors={isUrgent ? ['#ef4444', '#b91c1c'] : ['#6366f1', '#a855f7']} style={styles.avatarGradient}>
                            <Phone color="#fff" size={42} strokeWidth={2.5} />
                        </LinearGradient>
                    </View>
                </View>

                <View style={[styles.reasonBox, isUrgent && { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={[styles.reasonLabel, isUrgent && { color: '#f87171' }]}>RALLY SUBJECT</Text>
                    <Text style={styles.reasonValue}>{reason || 'No specific reason'}</Text>
                </View>

                <View style={styles.listContainer}>
                    <Text style={styles.listHeader}>SQUAD STATUS</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {Object.entries(session?.responses || {}).map(([uid, status]: [string, any]) => (
                            <View key={uid} style={styles.memberItem}>
                                <View style={styles.memberInfo}>
                                    <View style={styles.avatarMini}>
                                        <Text style={styles.avatarTxt}>{(memberNames[uid] || '?')[0]}</Text>
                                        {isOnline(uid) && <View style={styles.onlineDot} />}
                                    </View>
                                    <Text style={styles.memberNameText} numberOfLines={1}>
                                        {uid === user?.uid ? 'You' : (memberNames[uid] || '...')}
                                    </Text>
                                </View>
                                <View style={[styles.pill, status.startsWith('accepted') ? styles.pillAccepted : status === 'rejected' ? styles.pillRejected : styles.pillPending]}>
                                    <Text style={styles.pillText}>{status.split(':')[1]?.toUpperCase() || status.toUpperCase()}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.footer} {...panResponder.panHandlers}>
                    {myStatus === 'pending' && !amCaller ? (
                        <View style={styles.controlsCol}>
                             <View style={styles.callControls}>
                                 <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => handleResponse('rejected')}>
                                    <PhoneOff color="#fff" size={28} />
                                </TouchableOpacity>

                                <AnimatedTouchable 
                                    style={[styles.actionBtn, styles.acceptBtn, { transform: [{ scale: pulse }] }]} 
                                    onPress={() => handleResponse('accepted')}
                                >
                                    <Phone color="#fff" size={32} />
                                </AnimatedTouchable>

                                <TouchableOpacity style={[styles.actionBtn, styles.quickBtn]} onPress={() => setShowQuickRes(true)}>
                                    <Send color="#fff" size={24} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.hintText}>Swipe up for quick replies</Text>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.dismissBtn} onPress={() => navigation.goBack()}>
                            <Text style={styles.dismissText}>{amCaller ? 'END RALLY' : 'DISMISS VIEW'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <Modal visible={showQuickRes} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowQuickRes(false)} />
                    <View style={styles.quickModal}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Quick Response</Text>
                        <View style={styles.quickGrid}>
                            {quickOps.map((op, i) => (
                                <TouchableOpacity key={i} style={styles.quickOpItem} onPress={() => handleResponse(op.val)}>
                                    <Text style={styles.quickOpText}>{op.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        
                        <View style={styles.customResRow}>
                            <TextInput 
                                style={styles.customInput}
                                placeholder="Type custom message..."
                                placeholderTextColor="#94a3b8"
                                value={customMsg}
                                onChangeText={setCustomMsg}
                            />
                            <TouchableOpacity 
                                style={styles.sendCustomBtn}
                                onPress={() => { if (customMsg.trim()) handleResponse(`accepted:${customMsg}`); }}
                            >
                                <Send color="#fff" size={20} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    content: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24 },
    header: { alignItems: 'center', marginBottom: 20 },
    priorityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginBottom: 8 },
    priorityText: { color: '#fff', fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },
    callerTitle: { color: '#fff', fontSize: 32, fontWeight: '800' },
    groupSub: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
    visualContainer: { height: height * 0.2, justifyContent: 'center', alignItems: 'center' },
    pulseCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
    avatarGlow: { width: 100, height: 100, borderRadius: 50, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', shadowRadius: 20, shadowOpacity: 0.8, elevation: 20 },
    avatarGradient: { flex: 1, borderRadius: 46, justifyContent: 'center', alignItems: 'center' },
    reasonBox: { backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 20, padding: 20, marginVertical: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    reasonLabel: { color: '#6366f1', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
    reasonValue: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
    listContainer: { flex: 1 },
    listHeader: { color: '#475569', fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
    memberItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15,23,42,0.4)', padding: 12, borderRadius: 16, marginBottom: 8 },
    memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    onlineDot: { position: 'absolute', right: 0, bottom: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', borderWidth: 1.5, borderColor: '#1e293b' },
    memberNameText: { color: '#cbd5e1', fontSize: 15, fontWeight: '600' },
    pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    pillAccepted: { backgroundColor: 'rgba(34, 197, 94, 0.2)' },
    pillRejected: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
    pillPending: { backgroundColor: 'rgba(234, 179, 8, 0.2)' },
    pillText: { fontSize: 8, fontWeight: '900', color: '#fff' },
    footer: { paddingBottom: 40, paddingTop: 10 },
    controlsCol: { alignItems: 'center', gap: 15 },
    callControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    actionBtn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 10 },
    acceptBtn: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#22c55e' },
    declineBtn: { backgroundColor: '#ef4444' },
    quickBtn: { backgroundColor: '#334155' },
    hintText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
    dismissBtn: { backgroundColor: '#ef4444', padding: 20, borderRadius: 20, alignItems: 'center' },
    dismissText: { color: '#fff', fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    quickModal: { backgroundColor: '#1e293b', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 50 },
    modalHandle: { width: 40, height: 5, backgroundColor: '#334155', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    quickGrid: { gap: 12 },
    quickOpItem: { backgroundColor: '#334155', padding: 18, borderRadius: 15, alignItems: 'center' },
    quickOpText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    customResRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, gap: 10 },
    customInput: { flex: 1, backgroundColor: '#334155', borderRadius: 16, padding: 12, color: '#fff' },
    sendCustomBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' }
});

export default RingingScreen;

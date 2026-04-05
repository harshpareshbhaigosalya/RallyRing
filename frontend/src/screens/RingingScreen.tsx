import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, ScrollView, Dimensions, Platform, BackHandler, Vibration, Modal,
    PanResponder, TextInput, Image
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import { useStore } from '../store/useStore';
import { Phone, PhoneOff, Users, Clock, CheckCircle2, XCircle, AlertTriangle, Send, Timer } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Sound from 'react-native-sound';
import { stopCall } from '../api/auth';

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
    const [elapsed, setElapsed] = useState(0);
    
    const autoEndFired = useRef(false);
    const soundRef = useRef<Sound | null>(null);
    const isRinging = useRef(false);
    const timerRef = useRef<any>(null);

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

    // ── Call Timer ──────────────────────────────────────────────────────
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // ── Sound & Vibration ──────────────────────────────────────────────
    const startRinging = () => {
        if (isRinging.current || myStatus !== 'pending' || amCaller) return;

        // ON ANDROID: We rely 100% on the Native Notification channel to loop the ringtone.
        // If we play it here too, we get terrible dual-overlapping sound.
        if (Platform.OS === 'ios') {
            const ringtone = new Sound('ringtone', '', (error) => {
                if (error) {
                    console.warn('Failed to load sound', error);
                    return;
                }
                ringtone.setNumberOfLoops(-1);
                ringtone.setVolume(isUrgent ? 1.0 : 0.7);
                ringtone.play((success) => {
                    if (!success) console.warn('Sound playback failed');
                });
                isRinging.current = true;
            });
            soundRef.current = ringtone;
        }
        
        const pattern = isUrgent ? [200, 200, 200, 200] : [500, 1000];
        Vibration.vibrate(pattern, true);
    };

    const stopSound = () => {
        if (Platform.OS === 'ios' && soundRef.current) {
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
            // NATIVE OVERRIDE: Ensure the Kotlin Native notification is forcefully cancelled
            if (Platform.OS === 'android') {
                const { NativeModules } = require('react-native');
                if (NativeModules.RallyNotification) {
                    NativeModules.RallyNotification.cancelCallNotification(callId);
                }
            }
        } catch (e) { }
    };

    const handleEndCall = async () => {
        console.log('[RingingScreen] Ending call manually:', callId);
        try {
            await stopRingingAndClear();
            if (callId) {
                // Inform the backend to cancel for everyone
                await stopCall(callId);
            }
            navigation.goBack();
        } catch (e) {
            console.error('[RingingScreen] Error ending call:', e);
            navigation.goBack(); // Still go back even on error
        }
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

    const parseStatus = (status: string) => {
        if (status === 'accepted') return 'ACCEPTED';
        if (status === 'rejected') return 'DECLINED';
        if (status === 'pending') return 'PENDING';
        if (status.startsWith('accepted:')) {
            const msg = status.substring(9);
            const shortMap: Record<string, string> = { '5min': '5 MIN', '15min': '15 MIN', 'way': 'ON WAY' };
            return shortMap[msg] || msg.toUpperCase();
        }
        return status.toUpperCase();
    };

    const getStatusType = (status: string) => {
        if (status.startsWith('accepted')) return 'accepted';
        if (status === 'rejected') return 'rejected';
        return 'pending';
    };

    const acceptedCount = Object.values(session?.responses || {}).filter((s: any) => String(s).startsWith('accepted')).length;
    const totalCount = Object.keys(session?.responses || {}).length;

    const quickOps = [
        { label: "In 5 mins! 🏃", val: "accepted:5min" },
        { label: "Busy, 15 min ⏳", val: "accepted:15min" },
        { label: "On my way! 🚗", val: "accepted:way" },
        { label: "Can't make it 🛑", val: "rejected" }
    ];

    const [groupData, setGroupData] = useState<any>(null);

    useEffect(() => {
        if (session?.groupId) {
            firestore().collection('groups').doc(session.groupId).get().then(doc => {
                const data = doc.data();
                if (data) setGroupData(data);
            });
        }
    }, [session?.groupId]);

    return (
        <View style={[styles.container, { backgroundColor: '#020617' }]}>
            {/* ATMOSPHERIC BACKGROUND */}
            {groupData?.profileImage ? (
                <View style={styles.bgWrapper}>
                    <Image 
                        source={{ uri: `data:image/jpeg;base64,${groupData.profileImage}` }} 
                        style={styles.bgImage}
                        blurRadius={40}
                    />
                    <LinearGradient colors={['rgba(2,6,23,0.4)', '#020617']} style={StyleSheet.absoluteFillObject} />
                </View>
            ) : (
                <LinearGradient colors={['#0f172a', '#020617']} style={StyleSheet.absoluteFillObject} />
            )}

            <View style={styles.content}>
                {/* Status Bar Spacer */}
                <View style={{ height: 40 }} />

                {/* Timer */}
                <View style={styles.timerRow}>
                    <Timer size={12} color="#475569" />
                    <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
                    <View style={styles.counterPill}>
                        <Text style={styles.counterText}>{acceptedCount}/{totalCount} responded</Text>
                    </View>
                </View>

                <View style={styles.header}>
                    <View style={[styles.priorityBadge, isUrgent && { backgroundColor: '#ef4444' }]}>
                        {isUrgent ? <AlertTriangle size={12} color="#fff" /> : <Users size={12} color="#94a3b8" />}
                        <Text style={styles.priorityText}>{priority.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.callerTitle}>{callerName}</Text>
                    <Text style={styles.groupSub}>RALLYING {groupName}</Text>
                </View>

                <View style={styles.visualContainer}>
                    <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }], backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)' }]} />
                    <Animated.View style={[styles.pulseCircleOuter, { transform: [{ scale: pulse }], opacity: 0.5, backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.08)' }]} />
                    <View style={[styles.avatarGlow, isUrgent && { shadowColor: '#ef4444' }]}>
                        <LinearGradient colors={isUrgent ? ['#ef4444', '#b91c1c'] : ['#6366f1', '#a855f7']} style={styles.avatarGradient}>
                            <Phone color="#fff" size={38} strokeWidth={2.5} />
                        </LinearGradient>
                    </View>
                </View>

                <View style={[styles.reasonBox, isUrgent && { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <Text style={[styles.reasonLabel, isUrgent && { color: '#f87171' }]}>RALLY SUBJECT</Text>
                    <Text style={styles.reasonValue}>{reason || 'No specific reason'}</Text>
                </View>

                <View style={styles.listContainer}>
                    <Text style={styles.listHeader}>SQUAD STATUS</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {Object.entries(session?.responses || {}).map(([uid, status]: [string, any]) => {
                            const statusType = getStatusType(status);
                            return (
                                <View key={uid} style={styles.memberItem}>
                                    <View style={styles.memberInfo}>
                                        <View style={[
                                            styles.avatarMini, 
                                            statusType === 'accepted' && { borderColor: 'rgba(34, 197, 94, 0.5)', borderWidth: 1.5 },
                                            statusType === 'rejected' && { borderColor: 'rgba(239, 68, 68, 0.5)', borderWidth: 1.5 }
                                        ]}>
                                            <Text style={styles.avatarTxt}>{(memberNames[uid] || '?')[0]}</Text>
                                            {isOnline(uid) && <View style={styles.onlineDot} />}
                                        </View>
                                        <Text style={styles.memberNameText} numberOfLines={1}>
                                            {uid === user?.uid ? 'You' : (memberNames[uid] || '...')}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.pill, 
                                        statusType === 'accepted' ? styles.pillAccepted : 
                                        statusType === 'rejected' ? styles.pillRejected : 
                                        styles.pillPending
                                    ]}>
                                        <Text style={[
                                            styles.pillText,
                                            statusType === 'accepted' && { color: '#22c55e' },
                                            statusType === 'rejected' && { color: '#ef4444' },
                                            statusType === 'pending' && { color: '#eab308' },
                                        ]}>
                                            {parseStatus(status)}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.footer} {...panResponder.panHandlers}>
                    {myStatus === 'pending' && !amCaller ? (
                        <View style={styles.controlsCol}>
                             <View style={styles.callControls}>
                                 <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => handleResponse('rejected')}>
                                    <PhoneOff color="#fff" size={26} />
                                </TouchableOpacity>

                                <AnimatedTouchable 
                                    style={[styles.actionBtn, styles.acceptBtn, { transform: [{ scale: pulse }] }]} 
                                    onPress={() => handleResponse('accepted')}
                                >
                                    <Phone color="#fff" size={30} />
                                </AnimatedTouchable>

                                <TouchableOpacity style={[styles.actionBtn, styles.quickBtn]} onPress={() => setShowQuickRes(true)}>
                                    <Send color="#fff" size={22} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.hintText}>Swipe up for quick replies</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            style={styles.dismissBtn} 
                            onPress={() => amCaller ? handleEndCall() : navigation.goBack()}
                        >
                            <Text style={styles.dismissText}>{amCaller ? 'END RALLY' : 'DISMISS'}</Text>
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
                                <TouchableOpacity key={i} style={styles.quickOpItem} onPress={() => handleResponse(op.val)} activeOpacity={0.7}>
                                    <Text style={styles.quickOpText}>{op.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        
                        <View style={styles.customResRow}>
                            <TextInput 
                                style={styles.customInput}
                                placeholder="Type custom message..."
                                placeholderTextColor="#555"
                                value={customMsg}
                                onChangeText={setCustomMsg}
                            />
                            <TouchableOpacity 
                                style={[styles.sendCustomBtn, !customMsg.trim() && { opacity: 0.4 }]}
                                onPress={() => { if (customMsg.trim()) handleResponse(`accepted:${customMsg}`); }}
                                disabled={!customMsg.trim()}
                            >
                                <Send color="#fff" size={18} />
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
    bgWrapper: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
    bgImage: { width: '100%', height: '100%', opacity: 0.8 },
    content: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24 },
    
    timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
    timerText: { color: '#555', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    counterPill: { backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginLeft: 6 },
    counterText: { color: '#555', fontSize: 10, fontWeight: '700' },

    header: { alignItems: 'center', marginBottom: 16 },
    priorityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginBottom: 8, gap: 6 },
    priorityText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
    callerTitle: { color: '#fff', fontSize: 30, fontWeight: '800' },
    groupSub: { color: '#64748b', fontSize: 14, fontWeight: '500' },
    
    visualContainer: { height: height * 0.18, justifyContent: 'center', alignItems: 'center' },
    pulseCircle: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
    pulseCircleOuter: { position: 'absolute', width: 250, height: 250, borderRadius: 125 },
    avatarGlow: { width: 96, height: 96, borderRadius: 48, padding: 4, backgroundColor: 'rgba(255,255,255,0.08)', shadowRadius: 25, shadowOpacity: 0.8, elevation: 20 },
    avatarGradient: { flex: 1, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
    
    reasonBox: { backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: 20, padding: 18, marginVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
    reasonLabel: { color: '#6366f1', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    reasonValue: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
    
    listContainer: { flex: 1 },
    listHeader: { color: '#475569', fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1.5 },
    memberItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15,23,42,0.4)', padding: 12, borderRadius: 16, marginBottom: 6 },
    memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarMini: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
    onlineDot: { position: 'absolute', right: 0, bottom: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', borderWidth: 1.5, borderColor: '#1e293b' },
    memberNameText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    pillAccepted: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
    pillRejected: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    pillPending: { backgroundColor: 'rgba(234, 179, 8, 0.1)' },
    pillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    
    footer: { paddingBottom: 36, paddingTop: 8 },
    controlsCol: { alignItems: 'center', gap: 12 },
    callControls: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    actionBtn: { width: 66, height: 66, borderRadius: 33, justifyContent: 'center', alignItems: 'center', elevation: 10 },
    acceptBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#22c55e' },
    declineBtn: { backgroundColor: '#ef4444' },
    quickBtn: { backgroundColor: '#334155' },
    hintText: { color: '#475569', fontSize: 12, fontWeight: '500' },
    dismissBtn: { backgroundColor: '#ef4444', padding: 18, borderRadius: 20, alignItems: 'center' },
    dismissText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    quickModal: { backgroundColor: '#1e293b', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 45 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#334155', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 18, textAlign: 'center' },
    quickGrid: { gap: 10 },
    quickOpItem: { backgroundColor: '#0f172a', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
    quickOpText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    customResRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
    customInput: { flex: 1, backgroundColor: '#0f172a', borderRadius: 16, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#1e293b' },
    sendCustomBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' }
});

export default RingingScreen;

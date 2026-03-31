import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    Share, Alert, StatusBar, Platform, ScrollView, Animated,
    Easing, Dimensions, Clipboard, ToastAndroid, TextInput, Modal, Image
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { useStore } from '../store/useStore';
import { Plus, Users, Share2, ChevronRight, LogOut, Phone, Copy, Zap, Clock, History, UserPlus, AlertTriangle } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import notifee from '@notifee/react-native';

const { height, width } = Dimensions.get('window');

const HomeScreen = ({ navigation }: any) => {
    const { user, groups, setGroups, setUser } = useStore();
    const [recentHistory, setRecentHistory] = useState<any[]>([]);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});
    const [batteryOptimized, setBatteryOptimized] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinSquadId, setJoinSquadId] = useState('');
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        const checkBattery = async () => {
            if (Platform.OS === 'android') {
                const optimized = await notifee.isBatteryOptimizationEnabled();
                setBatteryOptimized(optimized);
            }
        };
        checkBattery();
        if (!user || !user.uid) return;

        const unsubscribe = firestore()
            .collection('groups')
            .where('members', 'array-contains', user.uid)
            .onSnapshot(snapshot => {
                const groupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setGroups(groupList);
            });

        const unsubHistory = firestore()
            .collection('call_sessions')
            .where('members', 'array-contains', user.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .onSnapshot(snap => {
                if (snap) {
                    const historyList = snap.docs.map(doc => doc.data());
                    setRecentHistory(historyList);
                    
                    const callerIds = [...new Set(historyList.map(h => h.callerId).filter(Boolean))];
                    callerIds.forEach(cid => {
                        if (!memberNames[cid]) {
                            firestore().collection('users').doc(cid).get().then(uDoc => {
                                if (uDoc.exists()) {
                                    setMemberNames(prev => ({ ...prev, [cid]: uDoc.data()?.name || cid }));
                                }
                            }).catch(() => {});
                        }
                    });
                }
            });

        return () => { unsubscribe(); unsubHistory(); };
    }, [user]);

    const copyUID = () => {
        if (user?.uid) {
            Clipboard.setString(user.uid);
            if (Platform.OS === 'android') {
                ToastAndroid.show('UID copied!', ToastAndroid.SHORT);
            }
        }
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel" },
            { text: "Logout", style: 'destructive', onPress: () => setUser(null) }
        ]);
    };

    const handleJoinSquad = async () => {
        const gId = joinSquadId.trim().toUpperCase();
        if (!gId || !user?.uid) return;
        try {
            const gDoc = await firestore().collection('groups').doc(gId).get();
            if (!gDoc.exists) {
                Alert.alert("Error", "Squad not found. Check the ID.");
                return;
            }
            await firestore().collection('groups').doc(gId).update({
                members: firestore.FieldValue.arrayUnion(user.uid)
            });
            setShowJoinModal(false);
            setJoinSquadId('');
            Alert.alert("Success", "You joined the squad! 🎉");
        } catch (e) {
            Alert.alert("Error", "Could not join squad.");
        }
    };

    const checkBattery = async () => {
        if (Platform.OS === 'android') {
            const optimized = await notifee.isBatteryOptimizationEnabled();
            setBatteryOptimized(optimized);
        }
    };

    const handleBatterySettings = async () => {
        if (Platform.OS === 'android') {
            await notifee.openBatteryOptimizationSettings();
            setTimeout(checkBattery, 2000);
        }
    };

    const handleOverlaySettings = async () => {
        if (Platform.OS === 'android') {
            Alert.alert(
                "Critical Setup",
                "To see calls while your phone is locked, please enable 'Display over other apps' for RallyRing in the next screen.",
                [{ text: "Open Settings", onPress: () => {
                    const { Linking } = require('react-native');
                    Linking.openSettings();
                }}]
            );
        }
    };

    const getTimeAgo = (timestamp: any) => {
        if (!timestamp?.toDate) return 'Recently';
        const diff = Date.now() - timestamp.toDate().getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const fixBattery = async () => {
        await notifee.openBatteryOptimizationSettings();
        setBatteryOptimized(false);
    };

    const activeRallies = recentHistory.filter(h => h.status === 'ringing');

    const isAdminOfAny = groups.some((g: any) => g.admin === user?.uid);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* ── NEW RADAR HEADER ── */}
                <LinearGradient colors={['#0a0118', '#0f0a2e', '#000']} style={styles.headerGradient}>
                    <View style={styles.topRow}>
                        <View>
                            <Text style={styles.welcomeText}>SYSTEM STATUS: {activeRallies.length > 0 ? 'ACTIVE' : 'READY'}</Text>
                            <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Rallier'}</Text>
                        </View>
                        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                            <LogOut color="#666" size={18} />
                        </TouchableOpacity>
                    </View>

                    {/* RADAR VISUALIZER */}
                    <View style={styles.radarContainer}>
                        {activeRallies.length > 0 ? (
                            <View style={styles.radarEffect}>
                                <Animated.View style={[styles.radarRing, { transform: [{ scale: pulseAnim }], opacity: 0.3 }]} />
                                <Animated.View style={[styles.radarRing, { transform: [{ scale: Animated.multiply(pulseAnim, 1.2) }], opacity: 0.1 }]} />
                                <View style={styles.activeCallIcon}>
                                    <Zap color="#fff" size={40} fill="#7C3AED" />
                                </View>
                                <Text style={styles.radarTitle}>SQUAD ALERTED</Text>
                                <Text style={styles.radarSub}>{activeRallies[0].groupName}</Text>
                            </View>
                        ) : (
                            <View style={styles.passiveRadar}>
                                <Users color="#1a1a1a" size={100} />
                                <Text style={styles.passiveText}>ALL QUIET ON THE FRONT</Text>
                            </View>
                        )}
                    </View>

                    {/* UID Card (Admin View or Copy ID) */}
                    <TouchableOpacity style={styles.uidCard} onPress={copyUID} activeOpacity={0.7}>
                        <View style={styles.uidLeft}>
                            <Text style={styles.uidLabel}>NETWORK UID</Text>
                            <Text style={styles.uidValue} numberOfLines={1}>{user?.uid || '...'}</Text>
                        </View>
                        <View style={styles.uidCopyBtn}>
                            <Copy color="#7C3AED" size={14} />
                        </View>
                    </TouchableOpacity>

                    {batteryOptimized && (
                        <TouchableOpacity style={styles.batteryWarn} onPress={fixBattery}>
                            <AlertTriangle color="#fcd34d" size={14} />
                            <Text style={styles.batteryText}>Reliability Alert: Disable battery optimization</Text>
                            <ChevronRight color="#fcd34d" size={14} />
                        </TouchableOpacity>
                    )}
                </LinearGradient>

                {/* Active Rally Banner */}
                {activeRallies.length > 0 && (
                    <TouchableOpacity 
                        style={styles.activeBanner}
                        onPress={() => navigation.navigate('Ringing', {
                            callId: activeRallies[0].callId,
                            groupName: activeRallies[0].groupName,
                            callerName: memberNames[activeRallies[0].callerId] || 'Someone',
                            reason: activeRallies[0].reason || '',
                            priority: activeRallies[0].priority || 'casual',
                        })}
                    >
                        <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.bannerGradient}>
                            <View style={styles.liveDot} />
                            <Phone color="#fff" size={16} />
                            <Text style={styles.bannerText}>
                                ACTIVE RALLY — "{activeRallies[0].reason || 'Rally'}" in {activeRallies[0].groupName}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Body content */}
                <View style={styles.body}>
                    {/* Recent History Section */}
                    {recentHistory.length > 0 && (
                        <View style={styles.historySection}>
                            <View style={styles.sectionHeader}>
                                <History color="#555" size={14} />
                                <Text style={styles.sectionTitle}>RECENT RALLIES</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyScroll}>
                                {recentHistory.slice(0, 8).map((h, idx) => (
                                    <TouchableOpacity 
                                        key={idx} 
                                        style={[
                                            styles.historyMiniCard,
                                            h.status === 'ringing' && styles.historyMiniCardActive
                                        ]}
                                        onPress={() => navigation.navigate('RallyDetail', { callId: h.callId })}
                                        activeOpacity={0.7}
                                    >
                                        {h.status === 'ringing' && <View style={styles.historyLiveDot} />}
                                        <Text style={styles.historyReason} numberOfLines={1}>
                                            {h.reason || 'Rally'}
                                        </Text>
                                        <Text style={styles.historyGroup} numberOfLines={1}>
                                            {h.groupName}
                                        </Text>
                                        <View style={styles.historyMeta}>
                                            <Text style={styles.historyTime}>{getTimeAgo(h.createdAt)}</Text>
                                            <View style={styles.historyStats}>
                                                <Text style={styles.historyAccepted}>
                                                    ✓{Object.values(h.responses || {}).filter((v: any) => String(v).startsWith('accepted')).length}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Squads Section */}
                    <View style={[styles.sectionHeader, { marginTop: 15 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.sectionTitle}>YOUR SQUADS</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{groups.length}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJoinModal(true)}>
                                <UserPlus color="#7C3AED" size={18} />
                                <Text style={styles.joinBtnText}>JOIN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createBtnS} onPress={() => navigation.navigate('CreateGroup')}>
                                <Plus color="#fff" size={18} strokeWidth={3} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Squad list - rendered inline (not in FlatList) for ScrollView compatibility */}
                    {groups.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <View style={styles.emptyIconCircle}>
                                <Users color="#333" size={40} />
                            </View>
                            <Text style={styles.emptyTitle}>No Squads Yet</Text>
                            <Text style={styles.emptySub}>Create a squad and start rallying your friends with one tap.</Text>
                        </View>
                    ) : (
                        groups.map((item: any) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
                                activeOpacity={0.7}
                            >
                                <View style={styles.cardContent}>
                                    <View style={styles.groupIconBox}>
                                        {item.profileImage ? (
                                            <Image source={{ uri: `data:image/jpeg;base64,${item.profileImage}` }} style={{ width: '100%', height: '100%' }} />
                                        ) : (
                                            <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.iconGradient}>
                                                <Users color="#fff" size={20} />
                                            </LinearGradient>
                                        )}
                                    </View>
                                    <View style={styles.cardText}>
                                        <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.memberCount}>{item.members?.length || 0} members</Text>
                                    </View>
                                    <ChevronRight color="#333" size={18} />
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
                <TouchableOpacity 
                    onPress={() => navigation.navigate('CreateGroup')}
                    activeOpacity={0.8}
                >
                    <LinearGradient colors={['#7C3AED', '#a855f7', '#C026D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
                        <Plus color="#fff" size={22} />
                        <Text style={styles.fabText}>NEW SQUAD</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {/* Join Squad Modal */}
            <Modal visible={showJoinModal} transparent animationType="fade">
                <View style={styles.modalBlur}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Join Squad</Text>
                        <Text style={styles.modalSub}>Enter the Squad ID shared by your friend</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. A1B2C3"
                            placeholderTextColor="#555"
                            value={joinSquadId}
                            onChangeText={setJoinSquadId}
                            autoCapitalize="characters"
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowJoinModal(false); setJoinSquadId(''); }}>
                                <Text style={styles.modalCancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleJoinSquad}>
                                <Text style={styles.modalConfirmTxt}>JOIN</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    headerGradient: { paddingTop: 55, paddingHorizontal: 24, paddingBottom: 24, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    welcomeText: { color: '#6366f1', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 4 },
    userName: { color: '#fff', fontSize: 30, fontWeight: '800' },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    
    radarContainer: { height: 220, justifyContent: 'center', alignItems: 'center' },
    radarEffect: { alignItems: 'center', justifyContent: 'center' },
    radarRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#7C3AED', borderWidth: 1, borderColor: '#7C3AED' },
    activeCallIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#7C3AED', elevation: 20 },
    radarTitle: { color: '#ef4444', fontSize: 13, fontWeight: '900', marginTop: 25, letterSpacing: 3 },
    radarSub: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 5 },
    passiveRadar: { alignItems: 'center', opacity: 0.15 },
    passiveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 4, marginTop: 20 },

    uidCard: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 16, 
        padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    uidLeft: { flex: 1 },
    uidLabel: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
    uidValue: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
    uidCopyBtn: { backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 10, borderRadius: 12 },


    activeBanner: { marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: 'hidden', elevation: 8 },
    bannerGradient: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    bannerText: { color: '#fff', fontWeight: '700', fontSize: 12, flex: 1 },

    body: { paddingHorizontal: 24, paddingTop: 20 },

    historySection: { marginBottom: 22 },
    historyScroll: { marginHorizontal: -4 },
    historyMiniCard: { 
        backgroundColor: '#0a0a0a', borderRadius: 18, padding: 14, marginHorizontal: 5, width: 155,
        borderWidth: 1, borderColor: '#151515'
    },
    historyMiniCardActive: { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    historyLiveDot: { 
        position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: 4, 
        backgroundColor: '#ef4444' 
    },
    historyReason: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
    historyGroup: { color: '#555', fontSize: 11, fontWeight: '500', marginBottom: 10 },
    historyMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyTime: { color: '#444', fontSize: 10, fontWeight: '600' },
    historyStats: { flexDirection: 'row', gap: 6 },
    historyAccepted: { color: '#22c55e', fontSize: 10, fontWeight: '800' },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8, justifyContent: 'space-between' },
    sectionTitle: { color: '#444', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
    badge: { backgroundColor: '#7C3AED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    card: { backgroundColor: '#0a0a0a', borderRadius: 22, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
    cardContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    groupIconBox: { width: 46, height: 46, borderRadius: 16, overflow: 'hidden' },
    iconGradient: { flex:1, justifyContent: 'center', alignItems: 'center' },
    cardText: { flex: 1, marginLeft: 14 },
    groupName: { color: '#fff', fontSize: 17, fontWeight: '700' },
    memberCount: { color: '#555', fontSize: 12, marginTop: 2 },

    fabContainer: { position: 'absolute', bottom: 28, right: 24, borderRadius: 18, overflow: 'hidden', elevation: 10 },
    fabGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 16 },
    fabText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    emptyBox: { alignItems: 'center', marginTop: 50, paddingHorizontal: 40 },
    emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#151515' },
    emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
    emptySub: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
    
    batteryWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252, 211, 77, 0.08)', padding: 12, borderRadius: 16, marginBottom: 5, borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(252, 211, 77, 0.1)', gap: 10 },
    batteryText: { flex: 1, color: '#fcd34d', fontSize: 11, fontWeight: '700' },
    
    joinBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124, 58, 237, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, gap: 5 },
    joinBtnText: { color: '#7C3AED', fontSize: 11, fontWeight: '900' },
    createBtnS: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },

    // ── Modal styles ────────────────────
    modalBlur: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: '#111', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#222' },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
    modalSub: { color: '#666', fontSize: 14, marginBottom: 20 },
    modalInput: { backgroundColor: '#1a1a1a', color: '#7C3AED', padding: 18, borderRadius: 16, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 3, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalCancelBtn: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 15 },
    modalCancelTxt: { color: '#666', fontWeight: 'bold', fontSize: 15 },
    modalConfirmBtn: { flex: 1.5, padding: 15, alignItems: 'center', borderRadius: 15, backgroundColor: '#7C3AED' },
    modalConfirmTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

export default HomeScreen;

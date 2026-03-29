import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    Share, Alert, StatusBar, Platform, ScrollView, Animated,
    Easing, Dimensions, Clipboard, ToastAndroid
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { useStore } from '../store/useStore';
import { Plus, Users, Share2, ChevronRight, LogOut, Phone, Copy, Zap, Clock, History, UserPlus, AlertTriangle } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import notifee from '@notifee/react-native';

const { height, width } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const HomeScreen = ({ navigation }: any) => {
    const { user, groups, setGroups, setUser } = useStore();
    const [recentHistory, setRecentHistory] = useState<any[]>([]);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});
    const [batteryOptimized, setBatteryOptimized] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
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
                    
                    // Fetch caller names
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

    const onShare = async (groupId: string) => {
        try { await Share.share({ message: `Join my RallyRing squad! Code: ${groupId}` }); } 
        catch (e) { }
    };

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

    const renderItem = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
            activeOpacity={0.7}
        >
            <View style={styles.cardContent}>
                <View style={styles.groupIconBox}>
                    <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.iconGradient}>
                        <Users color="#fff" size={20} />
                    </LinearGradient>
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.memberCount}>{item.members?.length || 0} members</Text>
                </View>
                <TouchableOpacity onPress={() => onShare(item.id)} style={styles.shareBtn}>
                    <Share2 color="#555" size={16} />
                </TouchableOpacity>
                <ChevronRight color="#333" size={18} />
            </View>
        </TouchableOpacity>
    );

    const joinGroup = () => {
        Alert.prompt(
            "Join Squad",
            "Enter the Squad ID provided by your friend:",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Join",
                    onPress: async (groupId: string | undefined) => {
                        if (!groupId || !user?.uid) return;
                        try {
                            const gDoc = await firestore().collection('groups').doc(groupId).get();
                            if (!gDoc.exists) {
                                Alert.alert("Error", "Squad not found. Check the ID.");
                                return;
                            }
                            await firestore().collection('groups').doc(groupId).update({
                                members: firestore.FieldValue.arrayUnion(user.uid)
                            });
                            Alert.alert("Success", "You joined the squad! 🎉");
                        } catch (e) {
                            Alert.alert("Error", "Could not join squad.");
                        }
                    }
                }
            ],
            "plain-text"
        );
    };

    const fixBattery = async () => {
        await notifee.openBatteryOptimizationSettings();
        setBatteryOptimized(false);
    };

    const activeRallies = recentHistory.filter(h => h.status === 'ringing');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            <View style={styles.headerContainer}>
                <LinearGradient colors={['#1e1b4b', '#0f0a2e', '#000']} style={styles.headerGradient}>
                    <View style={styles.topRow}>
                        <View>
                            <Text style={styles.welcomeText}>RALLYRING</Text>
                            <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Rallier'}</Text>
                        </View>
                        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                            <LogOut color="#666" size={18} />
                        </TouchableOpacity>
                    </View>

                    {/* UID Card */}
                    <TouchableOpacity style={styles.uidCard} onPress={copyUID} activeOpacity={0.7}>
                        <View style={styles.uidLeft}>
                            <Text style={styles.uidLabel}>YOUR ID</Text>
                            <Text style={styles.uidValue}>{user?.uid || '...'}</Text>
                        </View>
                        <View style={styles.uidCopyBtn}>
                            <Copy color="#7C3AED" size={14} />
                        </View>
                    </TouchableOpacity>

                    {batteryOptimized && (
                        <TouchableOpacity style={styles.batteryWarn} onPress={fixBattery}>
                            <AlertTriangle color="#fcd34d" size={14} />
                            <Text style={styles.batteryText}>Reliability limited. Disable battery optimization.</Text>
                            <ChevronRight color="#fcd34d" size={14} />
                        </TouchableOpacity>
                    )}

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statVal}>{groups.length}</Text>
                            <Text style={styles.statLab}>SQUADS</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={styles.statVal}>{recentHistory.length}</Text>
                            <Text style={styles.statLab}>RALLIES</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={[styles.statVal, activeRallies.length > 0 && { color: '#ef4444' }]}>
                                {activeRallies.length > 0 ? 'LIVE' : '—'}
                            </Text>
                            <Text style={styles.statLab}>STATUS</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

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
                        <TouchableOpacity style={styles.joinBtn} onPress={joinGroup}>
                            <UserPlus color="#7C3AED" size={18} />
                            <Text style={styles.joinBtnText}>JOIN</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.createBtnS} onPress={() => navigation.navigate('CreateGroup')}>
                            <Plus color="#fff" size={18} strokeWidth={3} />
                        </TouchableOpacity>
                    </View>
                </View>

                <FlatList
                    data={groups}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                             <View style={styles.emptyIconCircle}>
                                <Users color="#333" size={40} />
                             </View>
                             <Text style={styles.emptyTitle}>No Squads Yet</Text>
                             <Text style={styles.emptySub}>Create a squad and start rallying your friends with one tap.</Text>
                        </View>
                    }
                />
            </View>

            {/* Floating Action Buttons */}
            <View style={styles.fabRow}>
                <TouchableOpacity 
                    style={styles.miniFab} 
                    onPress={() => navigation.navigate('JoinGroup')}
                    activeOpacity={0.8}
                >
                    <Users color="#fff" size={18} />
                    <Text style={styles.fabText}>JOIN</Text>
                </TouchableOpacity>

                <AnimatedTouchable 
                    style={[styles.mainFab, { transform: [{ scale: pulseAnim }] }]} 
                    onPress={() => navigation.navigate('CreateGroup')}
                    activeOpacity={0.8}
                >
                    <LinearGradient colors={['#7C3AED', '#a855f7', '#C026D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
                        <Plus color="#fff" size={22} />
                        <Text style={[styles.fabText, { fontWeight: '800' }]}>NEW SQUAD</Text>
                    </LinearGradient>
                </AnimatedTouchable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    headerContainer: {},
    headerGradient: { paddingTop: 55, paddingHorizontal: 24, paddingBottom: 24, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    welcomeText: { color: '#6366f1', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 4 },
    userName: { color: '#fff', fontSize: 30, fontWeight: '800' },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    
    uidCard: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(124, 58, 237, 0.08)', borderRadius: 16, 
        padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(124, 58, 237, 0.15)'
    },
    uidLeft: { flex: 1 },
    uidLabel: { color: '#7C3AED', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
    uidValue: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
    uidCopyBtn: { backgroundColor: 'rgba(124, 58, 237, 0.15)', padding: 10, borderRadius: 12 },

    statsRow: { 
        flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', 
        borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)'
    },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
    statLab: { color: '#444', fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 1.5 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.05)', height: '100%' },

    activeBanner: { marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: 'hidden', elevation: 8 },
    bannerGradient: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    bannerText: { color: '#fff', fontWeight: '700', fontSize: 12, flex: 1 },

    body: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },

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

    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
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
    shareBtn: { padding: 10, marginRight: 4 },

    fabRow: { position: 'absolute', bottom: 28, left: 24, right: 24, flexDirection: 'row', gap: 12 },
    miniFab: { 
        flex: 1, height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', 
        justifyContent: 'center', gap: 8, backgroundColor: '#151515', borderWidth: 1, borderColor: '#222'
    },
    mainFab: { flex: 2, height: 56, borderRadius: 18, overflow: 'hidden' },
    fabGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    fabText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    emptyBox: { alignItems: 'center', marginTop: 50, paddingHorizontal: 40 },
    emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#151515' },
    emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
    emptySub: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
    
    batteryWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(252, 211, 77, 0.08)', padding: 12, borderRadius: 16, marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(252, 211, 77, 0.3)', gap: 10 },
    batteryText: { flex: 1, color: '#fcd34d', fontSize: 11, fontWeight: '700' },
    
    joinBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124, 58, 237, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, gap: 5 },
    joinBtnText: { color: '#7C3AED', fontSize: 11, fontWeight: '900' },
    createBtnS: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
});

export default HomeScreen;

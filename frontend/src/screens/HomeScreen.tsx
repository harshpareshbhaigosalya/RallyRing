import React, { useEffect, useState } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    Share, Alert, StatusBar, Platform 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { useStore } from '../store/useStore';
import { Plus, Users, Share2, ChevronRight, LogOut } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const HomeScreen = ({ navigation }: any) => {
    const { user, groups, setGroups, setUser } = useStore();
    const [stats, setStats] = useState({ online: 0, total: 0 });

    useEffect(() => {
        if (!user || !user.uid) return;

        // 1. Groups listener
        const unsubscribe = firestore()
            .collection('groups')
            .where('members', 'array-contains', user.uid)
            .onSnapshot(snapshot => {
                const groupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setGroups(groupList);
                setStats(prev => ({ ...prev, total: groupList.length }));
            });

        // 2. Simple way to count "active" people in user's groups (approximate)
        // For a true "Wow" we could listen to presence of all friends, but let's keep it light.

        return () => unsubscribe();
    }, [user]);

    const onShare = async (groupId: string) => {
        try { await Share.share({ message: `Join my RallyRing squad! Code: ${groupId}` }); } 
        catch (e) { }
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel" },
            { text: "Logout", style: 'destructive', onPress: () => setUser(null) }
        ]);
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
            activeOpacity={0.8}
        >
            <View style={styles.cardContent}>
                <View style={styles.groupIconBox}>
                    <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.iconGradient}>
                        <Users color="#fff" size={20} />
                    </LinearGradient>
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.memberCount}>{item.members?.length || 0} squad members</Text>
                </View>
                <TouchableOpacity onPress={() => onShare(item.id)} style={styles.shareBtn}>
                    <Share2 color="#666" size={18} />
                </TouchableOpacity>
                <ChevronRight color="#333" size={20} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            <View style={styles.headerContainer}>
                <LinearGradient colors={['#1e1b4b', '#000']} style={styles.headerGradient}>
                    <View style={styles.topRow}>
                        <View>
                            <Text style={styles.welcomeText}>Welcome back,</Text>
                            <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Rallier'}</Text>
                        </View>
                        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                            <LogOut color="#666" size={20} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statsContainer}>
                        <View style={styles.statBox}>
                            <Text style={styles.statVal}>{stats.total}</Text>
                            <Text style={styles.statLab}>SQUADS</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={styles.statVal}>LIVE</Text>
                            <Text style={styles.statLab}>READY</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            <View style={styles.body}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>YOUR SQUADS</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{groups.length}</Text>
                    </View>
                </View>

                <FlatList
                    data={groups}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                             <View style={styles.emptyIconCircle}>
                                <Users color="#333" size={40} />
                             </View>
                             <Text style={styles.emptyTitle}>Lone Wolf?</Text>
                             <Text style={styles.emptySub}>Create a squad and start summoning your friends in seconds.</Text>
                        </View>
                    }
                />
            </View>

            {/* Floating Action Buttons */}
            <View style={styles.fabRow}>
                <TouchableOpacity 
                    style={[styles.miniFab, { backgroundColor: '#1e1e1e' }]} 
                    onPress={() => navigation.navigate('JoinGroup')}
                >
                    <Users color="#fff" size={20} />
                    <Text style={styles.fabText}>JOIN</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.mainFab} 
                    onPress={() => navigation.navigate('CreateGroup')}
                >
                    <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.fabGradient}>
                        <Plus color="#fff" size={24} />
                        <Text style={[styles.fabText, { fontWeight: 'bold' }]}>NEW SQUAD</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    headerContainer: { height: 260 },
    headerGradient: { flex: 1, paddingTop: 60, paddingHorizontal: 25, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    welcomeText: { color: '#6366f1', fontSize: 14, fontWeight: '600', letterSpacing: 1 },
    userName: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 15 },
    
    statsContainer: { 
        flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', 
        borderRadius: 25, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { color: '#fff', fontSize: 24, fontWeight: '800' },
    statLab: { color: '#444', fontSize: 10, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.05)', height: '100%' },

    body: { flex: 1, paddingHorizontal: 25, paddingTop: 30 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { color: '#444', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
    badge: { backgroundColor: '#7C3AED', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    list: { paddingBottom: 100 },
    card: { backgroundColor: '#0a0a0a', borderRadius: 25, marginBottom: 15, borderWidth: 1, borderColor: '#111', overflow: 'hidden' },
    cardContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    groupIconBox: { width: 44, height: 44, borderRadius: 15, overflow: 'hidden' },
    iconGradient: { flex:1, justifyContent: 'center', alignItems: 'center' },
    cardText: { flex: 1, marginLeft: 15 },
    groupName: { color: '#fff', fontSize: 18, fontWeight: '700' },
    memberCount: { color: '#444', fontSize: 13, marginTop: 2 },
    shareBtn: { padding: 10, marginRight: 5 },

    fabRow: { position: 'absolute', bottom: 30, left: 25, right: 25, flexDirection: 'row', gap: 15 },
    miniFab: { flex: 1, height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    mainFab: { flex: 2, height: 60, borderRadius: 20, overflow: 'hidden' },
    fabGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    fabText: { color: '#fff', fontSize: 14, fontWeight: '600' },

    emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    emptySub: { color: '#444', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
});

export default HomeScreen;

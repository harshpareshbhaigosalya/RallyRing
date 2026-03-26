import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Share, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { triggerCall } from '../api/auth';
import { useStore } from '../store/useStore';
import { 
    PhoneCall, Trash2, UserPlus, LogOut, CheckCircle, Circle, RefreshCw, 
    History, Calendar, ChevronRight, Users, Bell, XCircle 
} from 'lucide-react-native';
import notifee from '@notifee/react-native';
import LinearGradient from 'react-native-linear-gradient';

const GroupDetailScreen = ({ route, navigation }: any) => {
    const { groupId } = route.params;
    const { user } = useStore();
    const [group, setGroup] = useState<any>(null);
    const [memberData, setMemberData] = useState<Record<string, string>>({});
    const [activeCall, setActiveCall] = useState<any>(null);
    const [loadingCall, setLoadingCall] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [showCallModal, setShowCallModal] = useState(false);
    const [callReason, setCallReason] = useState('');
    const [priority, setPriority] = useState<'casual' | 'priority' | 'urgent'>('casual');
    const [scheduledAt, setScheduledAt] = useState<number | null>(null);
    const [memberStatus, setMemberStatus] = useState<Record<string, { status: string, lastSeen: any }>>({});
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        const unsubGroup = firestore().collection('groups').doc(groupId).onSnapshot(doc => {
            if (!doc.exists) {
                navigation.goBack();
                return;
            }
            const data = doc.data();
            setGroup(data);

            if (data?.members) {
                if (selectedMembers.length === 0) {
                    setSelectedMembers(data.members.filter((m: string) => m !== user?.uid));
                }

                data.members.forEach((mId: string) => {
                    // Listen to member info + presence
                    firestore().collection('users').doc(mId).onSnapshot(uDoc => {
                        if (uDoc.exists()) {
                            const uData = uDoc.data();
                            setMemberData((prev: Record<string, string>) => ({ ...prev, [mId]: uData?.name || mId }));
                            setMemberStatus((prev: Record<string, { status: string, lastSeen: any }>) => ({ 
                                ...prev, 
                                [mId]: { status: uData?.status || 'offline', lastSeen: uData?.lastSeen } 
                            }));
                        }
                    });
                });
            }
        });
        // ... (unsubCall and unsubHistory remain similar)
        const unsubCall = firestore()
            .collection('call_sessions')
            .where('groupId', '==', groupId)
            .where('status', '==', 'ringing')
            .onSnapshot(snapshot => {
                if (!snapshot.empty) setActiveCall(snapshot.docs[0].data());
                else setActiveCall(null);
            });

        const unsubHistory = firestore()
            .collection('call_sessions')
            .where('groupId', '==', groupId)
            .where('status', '==', 'ended')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                if (snapshot) setHistory(snapshot.docs.map(doc => doc.data()));
            });

        return () => { unsubGroup(); unsubCall(); unsubHistory(); };
    }, [groupId]);

    const handleToggleMember = (mId: string) => {
        if (mId === user?.uid) return;
        setSelectedMembers((prev: string[]) =>
            prev.includes(mId) ? prev.filter((id: string) => id !== mId) : [...prev, mId]
        );
    };

    const handleSelectAll = () => {
        if (selectedMembers.length === group?.members.length - 1) {
            setSelectedMembers([]);
        } else {
            setSelectedMembers(group?.members.filter((m: string) => m !== user?.uid));
        }
    };

    const handleTriggerCall = async () => {
        if (!user || !group) return;
        if (selectedMembers.length === 0) {
            Alert.alert("Selection Error", "Please select at least one member to call.");
            return;
        }
        setLoadingCall(true);
        try {
            await triggerCall(
                groupId,
                user.uid,
                group.name,
                'Rally',
                selectedMembers,
                callReason.trim() || group.description || 'Rally Needed!',
                priority,
                scheduledAt
            );
            setShowCallModal(false);
            setCallReason('');
            setPriority('casual');
            setScheduledAt(null);
        } catch (e: any) {
            Alert.alert("Call Failed", "Check your connection.");
        } finally {
            setLoadingCall(false);
        }
    };

    const isOnline = (mId: string) => {
        const data = memberStatus[mId];
        if (!data || data.status !== 'online') return false;
        if (!data.lastSeen) return false;
        const lastSeenMs = data.lastSeen.toMillis ? data.lastSeen.toMillis() : (data.lastSeen || 0);
        return (Date.now() - lastSeenMs) < 90000; // Online if active in last 90s
    };

    const isAdmin = group?.admin === user?.uid;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronRight color="#fff" size={24} style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.title} numberOfLines={1}>{group?.name}</Text>
                    <Text style={styles.subtitle}>{group?.members?.length} Members • ID: {groupId.slice(0, 8)}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => Share.share({ message: `Join my RallyRing! ID: ${groupId}` })}>
                    <UserPlus color="#7C3AED" size={22} />
                </TouchableOpacity>
            </View>

            {/* Calling Hub */}
            <View style={styles.callHub}>
                {activeCall ? (
                    <LinearGradient 
                        colors={activeCall.priority === 'urgent' ? ['#7f1d1d', '#450a0a'] : ['#1e1e1e', '#111']} 
                        style={styles.activeCallCard}
                    >
                        <View style={styles.liveBadge}>
                            <View style={[styles.blinkDot, activeCall.priority === 'urgent' && { backgroundColor: '#fff' }]} />
                            <Text style={styles.liveText}>{activeCall.priority === 'urgent' ? 'URGENT RALLY' : 'LIVE RALLY'}</Text>
                        </View>

                        <Text style={styles.activeReason}>"{activeCall.reason}"</Text>
                        <Text style={styles.callerText}>Started by {memberData[activeCall.callerId] || 'Squad'}</Text>

                        <TouchableOpacity
                            style={[styles.joinCallBtn, activeCall.priority === 'urgent' && { backgroundColor: '#ef4444' }]}
                            onPress={() => navigation.navigate('Ringing', {
                                callId: activeCall.callId,
                                groupName: activeCall.groupName,
                                callerName: memberData[activeCall.callerId] || 'Someone',
                                reason: activeCall.reason,
                                priority: activeCall.priority
                            })}
                        >
                            <Text style={[styles.joinText, activeCall.priority === 'urgent' && { color: '#fff' }]}>ENTER CALL HUB</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                ) : (
                    <TouchableOpacity style={styles.startCallBtn} onPress={() => setShowCallModal(true)}>
                        <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.startGradient}>
                            <PhoneCall color="#fff" size={24} />
                            <Text style={styles.startCallText}>START SQUAD RALLY</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tab, !showHistory && styles.activeTab]} onPress={() => setShowHistory(false)}>
                    <Text style={[styles.tabLabel, !showHistory && styles.activeLabel]}>SQUAD LIST</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, showHistory && styles.activeTab]} onPress={() => setShowHistory(true)}>
                    <Text style={[styles.tabLabel, showHistory && styles.activeLabel]}>HISTORY</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {!showHistory ? (
                    <View>
                        <View style={styles.memberToolbox}>
                            <Text style={styles.sectionTitle}>Tap to select for call</Text>
                            <TouchableOpacity onPress={handleSelectAll}>
                                <Text style={styles.selectAll}>{selectedMembers.length === group?.members.length - 1 ? 'Deselect All' : 'Select All'}</Text>
                            </TouchableOpacity>
                        </View>
                        {group?.members.map((m: string) => (
                            <TouchableOpacity
                                key={m}
                                style={[styles.memberCard, selectedMembers.includes(m) && styles.selectedMember]}
                                onPress={() => handleToggleMember(m)}
                                disabled={m === user?.uid}
                            >
                                <View style={styles.memberInfo}>
                                    <View style={[styles.avatarSm, m === group.admin && { borderColor: '#7C3AED', borderWidth: 1 }]}>
                                        <Text style={styles.avatarText}>{(memberData[m] || '?')[0].toUpperCase()}</Text>
                                        {isOnline(m) && <View style={styles.onlineDot} />}
                                    </View>
                                    <View>
                                        <Text style={styles.memberName}>{m === user?.uid ? 'You' : (memberData[m] || '...')}</Text>
                                        <Text style={styles.memberStatusText}>{isOnline(m) ? 'Active now' : 'Away'}</Text>
                                    </View>
                                </View>
                                {m === user?.uid ? <Text style={styles.meBadge}>ME</Text> : (
                                    selectedMembers.includes(m) ? <CheckCircle color="#7C3AED" size={22} /> : <Circle color="#333" size={22} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    history.map((h, idx) => (
                         <View key={idx} style={styles.historyCard}>
                            <View style={styles.historyTop}>
                                <Text style={styles.hReason}>"{h.reason || 'Rally'}"</Text>
                                <Text style={styles.hDate}>
                                    {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                </Text>
                            </View>
                            <Text style={styles.hBy}>By {memberData[h.callerId] || 'Squad'} • {h.priority || 'casual'}</Text>
                            <View style={styles.hStatsRow}>
                                <Text style={[styles.hStat, { color: '#4CAF50' }]}>✅ {Object.values(h.responses || {}).filter(v => v === 'accepted').length}</Text>
                                <Text style={[styles.hStat, { color: '#F44336' }]}>❌ {Object.values(h.responses || {}).filter(v => v === 'rejected').length}</Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            <View style={styles.dangerZone}>
                {isAdmin ? (
                    <TouchableOpacity style={styles.dangerBtn} onPress={() => {
                        Alert.alert("Delete Squad", "Clear all history and members?", [
                            { text: "Cancel" },
                            { text: "Delete", style: 'destructive', onPress: async () => {
                                await firestore().collection('groups').doc(groupId).delete();
                                navigation.goBack();
                            }}
                        ]);
                    }}>
                        <Trash2 color="#444" size={18} />
                        <Text style={styles.dangerTxt}>Delete Squad</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.dangerBtn} onPress={async () => {
                        const remaining = group.members.filter((m: string) => m !== user?.uid);
                        await firestore().collection('groups').doc(groupId).update({ members: remaining });
                        navigation.goBack();
                    }}>
                        <LogOut color="#444" size={18} />
                        <Text style={styles.dangerTxt}>Leave Squad</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Modal Update */}
            <Modal visible={showCallModal} transparent animationType="slide">
                <View style={styles.modalBlur}>
                    <View style={styles.modalBox}>
                        <Text style={styles.mTitle}>Broadcast Rally</Text>
                        
                        <View style={styles.priorityRow}>
                            {(['casual', 'priority', 'urgent'] as const).map((p) => (
                                <TouchableOpacity 
                                    key={p} 
                                    style={[styles.priorityTab, priority === p && styles.priorityTabActive, priority === p && p === 'urgent' && { backgroundColor: '#ef4444' }]}
                                    onPress={() => setPriority(p)}
                                >
                                    <Text style={[styles.priorityTabText, priority === p && styles.priorityTabTextActive]}>{p.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.scheduleRow}>
                            <TouchableOpacity 
                                style={[styles.schedBtn, scheduledAt === null && styles.schedBtnActive]} 
                                onPress={() => setScheduledAt(null)}
                            >
                                <Text style={styles.schedBtnText}>NOW</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.schedBtn, scheduledAt !== null && styles.schedBtnActive]} 
                                onPress={() => {
                                    const next = (scheduledAt || Date.now()) + 900000; // +15 min
                                    setScheduledAt(next);
                                }}
                            >
                                <Text style={styles.schedBtnText}>{scheduledAt ? `IN ${Math.round((scheduledAt - Date.now())/60000)} MIN` : '+15 MIN'}</Text>
                            </TouchableOpacity>
                            {scheduledAt && (
                                <TouchableOpacity style={styles.schedBtn} onPress={() => setScheduledAt(null)}>
                                    <XCircle color="#fff" size={14} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TextInput
                            style={styles.mInput}
                            placeholder="Reason for call (e.g. Lunch? Game night?)"
                            placeholderTextColor="#555"
                            value={callReason}
                            onChangeText={setCallReason}
                            multiline
                        />

                        <View style={styles.mActions}>
                            <TouchableOpacity style={styles.mBtnCancel} onPress={() => setShowCallModal(false)}>
                                <Text style={styles.mBtnTxtCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.mBtnConfirm} onPress={handleTriggerCall} disabled={loadingCall}>
                                {loadingCall ? <ActivityIndicator color="#fff" /> : <Text style={styles.mBtnTxtConfirm}>START SQUAD CALL</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, marginBottom: 20 },
    backBtn: { backgroundColor: '#111', padding: 8, borderRadius: 12 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    subtitle: { color: '#666', fontSize: 13 },
    iconBtn: { backgroundColor: '#111', padding: 10, borderRadius: 12 },
    callHub: { marginBottom: 25 },
    activeCallCard: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244, 67, 54, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
    blinkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336', marginRight: 6 },
    liveText: { color: '#F44336', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    activeReason: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    callerText: { color: '#666', fontSize: 12, marginBottom: 15 },
    statsRow: { flexDirection: 'row', marginBottom: 20 },
    statItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15, backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statVal: { color: '#fff', marginLeft: 6, fontWeight: 'bold', fontSize: 13 },
    joinCallBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center' },
    joinText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    startCallBtn: { borderRadius: 20, overflow: 'hidden' },
    startGradient: { padding: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    startCallText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 12 },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111', marginBottom: 15 },
    tab: { paddingVertical: 12, marginRight: 25 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
    tabLabel: { color: '#444', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
    activeLabel: { color: '#fff' },
    content: { flex: 1 },
    memberToolbox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    sectionTitle: { color: '#666', fontSize: 12 },
    selectAll: { color: '#7C3AED', fontWeight: 'bold', fontSize: 12 },
    memberCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 16, marginBottom: 10 },
    selectedMember: { backgroundColor: 'rgba(124, 58, 237, 0.05)', borderColor: 'rgba(124, 58, 237, 0.3)', borderWidth: 1 },
    memberInfo: { flexDirection: 'row', alignItems: 'center' },
    avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    memberName: { color: '#fff', fontWeight: '500' },
    meBadge: { color: '#444', fontSize: 10, fontWeight: 'bold' },
    onlineDot: { position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#111' },
    memberStatusText: { color: '#444', fontSize: 11, marginTop: 2 },
    historyCard: { backgroundColor: '#111', padding: 15, borderRadius: 16, marginBottom: 12 },
    priorityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
    priorityTab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1e1e1e', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    priorityTabActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    priorityTabText: { color: '#666', fontSize: 10, fontWeight: '800' },
    priorityTabTextActive: { color: '#fff' },
    scheduleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    schedBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1e1e1e', alignItems: 'center' },
    schedBtnActive: { backgroundColor: '#7C3AED' },
    schedBtnText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    historyTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    hReason: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    hDate: { color: '#444', fontSize: 11 },
    hBy: { color: '#666', fontSize: 12, marginBottom: 10 },
    hStatsRow: { flexDirection: 'row', marginBottom: 12 },
    hStat: { fontSize: 13, fontWeight: 'bold', marginRight: 15 },
    attendeeList: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#1d1d1d', paddingTop: 10 },
    miniAttendee: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 6 },
    miniName: { fontSize: 11, fontWeight: '500' },
    miniIcon: { fontSize: 10, marginLeft: 2 },
    txtGreen: { color: '#4CAF50' },
    txtRed: { color: '#F44336' },
    txtYellow: { color: '#FFC107' },
    dangerZone: { paddingBottom: 30, paddingTop: 10 },
    dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15 },
    dangerTxt: { color: '#444', fontWeight: 'bold', marginLeft: 10, fontSize: 13 },
    modalBlur: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
    modalBox: { backgroundColor: '#111', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#333' },
    mTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    mSub: { color: '#666', fontSize: 14, marginBottom: 20 },
    mInput: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 15, fontSize: 16, marginBottom: 20, height: 80, textAlignVertical: 'top' },
    mActions: { flexDirection: 'row', justifyContent: 'space-between' },
    mBtnCancel: { padding: 15, flex: 1, alignItems: 'center' },
    mBtnConfirm: { backgroundColor: '#7C3AED', padding: 15, flex: 1.5, borderRadius: 15, alignItems: 'center' },
    mBtnTxtCancel: { color: '#666', fontWeight: 'bold' },
    mBtnTxtConfirm: { color: '#fff', fontWeight: 'bold' }
});

export default GroupDetailScreen;

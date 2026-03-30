import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Share, ActivityIndicator, Image } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { triggerCall } from '../api/auth';
import { useStore } from '../store/useStore';
import { 
    PhoneCall, Trash2, UserPlus, LogOut, CheckCircle, Circle, RefreshCw, 
    History, Calendar, ChevronRight, Users, Bell, XCircle, ArrowLeft,
    UserMinus, Shield, Image as ImageIcon, Copy, Camera
} from 'lucide-react-native';
import notifee from '@notifee/react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';

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
    const [showAddMember, setShowAddMember] = useState(false);
    const [addMemberId, setAddMemberId] = useState('');

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
            .orderBy('createdAt', 'desc')
            .limit(50)
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
        return (Date.now() - lastSeenMs) < 90000;
    };

    const isAdmin = group?.admin === user?.uid;

    // ── Admin: Profile Image ──────────────────────────────────────────────
    const handlePickImage = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                includeBase64: true,
                maxWidth: 400,
                maxHeight: 400,
                quality: 0.5,
            });

            if (result.didCancel || !result.assets || result.assets.length === 0) return;

            const base64 = result.assets[0].base64;
            if (base64) {
                await firestore().collection('groups').doc(groupId).update({
                    profileImage: base64
                });
            }
        } catch (e: any) {
            Alert.alert("Error", "Could not upload image");
        }
    };

    const handleAvatarPress = () => {
        if (!isAdmin) return;
        if (group?.profileImage) {
            Alert.alert(
                "Squad Image",
                "Update or remove squad profile image?",
                [
                    { text: "Cancel" },
                    { text: "Remove", style: 'destructive', onPress: async () => {
                        await firestore().collection('groups').doc(groupId).update({
                            profileImage: firestore.FieldValue.delete()
                        });
                    }},
                    { text: "Change", onPress: handlePickImage }
                ]
            );
        } else {
            handlePickImage();
        }
    };

    // ── Admin: Add member by UID ──────────────────────────────────────────
    const handleAddMember = async () => {
        const uid = addMemberId.trim();
        if (!uid) return;
        try {
            const userDoc = await firestore().collection('users').doc(uid).get();
            if (!userDoc.exists()) {
                Alert.alert("Error", "User not found. Check the ID.");
                return;
            }
            if (group?.members?.includes(uid)) {
                Alert.alert("Already Member", "This person is already in the squad.");
                return;
            }
            await firestore().collection('groups').doc(groupId).update({
                members: firestore.FieldValue.arrayUnion(uid)
            });
            setAddMemberId('');
            setShowAddMember(false);
            Alert.alert("Success", `${userDoc.data()?.name || 'User'} added to the squad! 🎉`);
        } catch (e) {
            Alert.alert("Error", "Could not add member.");
        }
    };

    // ── Admin: Remove member ──────────────────────────────────────────────
    const handleRemoveMember = (mId: string) => {
        if (mId === user?.uid) return;
        const name = memberData[mId] || mId;
        Alert.alert(
            "Remove Member",
            `Remove ${name} from this squad?`,
            [
                { text: "Cancel" },
                { text: "Remove", style: 'destructive', onPress: async () => {
                    try {
                        await firestore().collection('groups').doc(groupId).update({
                            members: firestore.FieldValue.arrayRemove(mId)
                        });
                        setSelectedMembers(prev => prev.filter(id => id !== mId));
                    } catch (e) {
                        Alert.alert("Error", "Could not remove member.");
                    }
                }}
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft color="#fff" size={22} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAvatarPress} disabled={!isAdmin} style={styles.headerAvatarBox}>
                    {group?.profileImage ? (
                        <Image source={{ uri: `data:image/jpeg;base64,${group.profileImage}` }} style={styles.headerAvatarImg} />
                    ) : (
                        <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.headerAvatarImgBase}>
                            <Users color="#fff" size={24} />
                        </LinearGradient>
                    )}
                    {isAdmin && (
                        <View style={styles.cameraIconBox}>
                            <Camera color="#fff" size={12} />
                        </View>
                    )}
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.title} numberOfLines={1}>{group?.name}</Text>
                    <Text style={styles.subtitle}>{group?.members?.length} Members {isAdmin && `• ID: ${groupId}`}</Text>
                </View>
                {isAdmin && (
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddMember(true)}>
                        <UserPlus color="#7C3AED" size={20} />
                    </TouchableOpacity>
                )}
                {isAdmin && (
                    <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={() => Share.share({ message: `Join my RallyRing squad! ID: ${groupId}` })}>
                        <Copy color="#7C3AED" size={18} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Admin Badge */}
            {isAdmin && (
                <View style={styles.adminBadge}>
                    <Shield color="#7C3AED" size={14} />
                    <Text style={styles.adminBadgeText}>You are the admin of this squad</Text>
                </View>
            )}

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
                    <TouchableOpacity 
                        style={styles.startCallBtn} 
                        onPress={() => setShowCallModal(true)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient colors={['#7C3AED', '#a855f7', '#C026D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startGradient}>
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

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
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
                                onLongPress={() => { if (isAdmin && m !== user?.uid) handleRemoveMember(m); }}
                                disabled={m === user?.uid}
                            >
                                <View style={styles.memberInfo}>
                                    <View style={[styles.avatarSm, m === group.admin && { borderColor: '#7C3AED', borderWidth: 1 }]}>
                                        <Text style={styles.avatarText}>{(memberData[m] || '?')[0].toUpperCase()}</Text>
                                        {isOnline(m) && <View style={styles.onlineDot} />}
                                    </View>
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.memberName}>{m === user?.uid ? 'You' : (memberData[m] || '...')}</Text>
                                            {m === group.admin && <Shield color="#7C3AED" size={12} />}
                                        </View>
                                        <Text style={styles.memberStatusText}>{isOnline(m) ? 'Active now' : 'Away'}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {isAdmin && m !== user?.uid && (
                                        <TouchableOpacity onPress={() => handleRemoveMember(m)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <UserMinus color="#444" size={16} />
                                        </TouchableOpacity>
                                    )}
                                    {m === user?.uid ? <Text style={styles.meBadge}>ME</Text> : (
                                        selectedMembers.includes(m) ? <CheckCircle color="#7C3AED" size={22} /> : <Circle color="#333" size={22} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                        {isAdmin && (
                            <Text style={styles.longPressHint}>Tip: Long-press a member to remove them</Text>
                        )}
                    </View>
                ) : (
                    history.length === 0 ? (
                        <View style={styles.emptyHistory}>
                            <History color="#333" size={40} />
                            <Text style={styles.emptyHistoryText}>No rallies in this squad yet.</Text>
                        </View>
                    ) : (
                        history.map((h, idx) => (
                            <TouchableOpacity 
                                key={idx} 
                                style={styles.historyCard}
                                onPress={() => navigation.navigate('RallyDetail', { callId: h.callId })}
                            >
                                <View style={styles.historyTop}>
                                    <View style={styles.hReasonRow}>
                                        <Text style={styles.hReason}>"{h.reason || 'Rally'}"</Text>
                                        {h.status === 'ringing' && <View style={styles.hLiveBadge}><Text style={styles.hLiveText}>LIVE</Text></View>}
                                    </View>
                                    <Text style={styles.hDate}>
                                        {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                    </Text>
                                </View>
                                <Text style={styles.hBy}>By {memberData[h.callerId] || 'Squad'} • {h.priority || 'casual'}</Text>
                                <View style={h.status === 'ringing' ? styles.hStatsRowActive : styles.hStatsRow}>
                                    <View style={styles.hStatItem}><Text style={{ color: '#22c55e', fontWeight: 'bold' }}>✅ {Object.values(h.responses || {}).filter(v => v === 'accepted').length}</Text></View>
                                    <View style={styles.hStatItem}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>❌ {Object.values(h.responses || {}).filter(v => v === 'rejected').length}</Text></View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )
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

            {/* ── Add Member Modal (Admin only) ──────────────────────────── */}
            <Modal visible={showAddMember} transparent animationType="fade">
                <View style={styles.modalBlur}>
                    <View style={styles.modalBox}>
                        <Text style={styles.mTitle}>Add Member</Text>
                        <Text style={styles.mSub}>Enter the person's User ID to add them to this squad.</Text>
                        
                        <TextInput
                            style={[styles.mInput, { height: 55, textAlignVertical: 'center' }]}
                            placeholder="Paste User ID here"
                            placeholderTextColor="#555"
                            value={addMemberId}
                            onChangeText={setAddMemberId}
                            autoCapitalize="none"
                        />

                        <View style={styles.mActions}>
                            <TouchableOpacity style={styles.mBtnCancel} onPress={() => { setShowAddMember(false); setAddMemberId(''); }}>
                                <Text style={styles.mBtnTxtCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.mBtnConfirm} onPress={handleAddMember}>
                                <Text style={styles.mBtnTxtConfirm}>ADD MEMBER</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Call Modal ─────────────────────────────────────────────── */}
            <Modal visible={showCallModal} transparent animationType="slide">
                <View style={styles.modalBlur}>
                    <View style={styles.modalBox}>
                        <Text style={styles.mTitle}>Broadcast Rally</Text>
                        <Text style={styles.mSub}>{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} will be notified</Text>
                        
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
                                    const next = (scheduledAt || Date.now()) + 900000;
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
                            <TouchableOpacity 
                                style={[styles.mBtnConfirm, loadingCall && { opacity: 0.7 }]} 
                                onPress={handleTriggerCall}
                                disabled={loadingCall}
                            >
                                {loadingCall ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.mBtnTxtConfirm}>START RALLY 💥</Text>
                                )}
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
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 55, marginBottom: 14 },
    backBtn: { backgroundColor: '#111', padding: 10, borderRadius: 14 },
    headerAvatarBox: { width: 44, height: 44, borderRadius: 16, marginLeft: 12, elevation: 4 },
    headerAvatarImg: { width: '100%', height: '100%', borderRadius: 16 },
    headerAvatarImgBase: { flex:1, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
    cameraIconBox: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#111', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#333' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    subtitle: { color: '#666', fontSize: 12, marginTop: 2 },
    iconBtn: { backgroundColor: '#111', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
    adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
    adminBadgeText: { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
    callHub: { marginBottom: 20 },
    activeCallCard: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244, 67, 54, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
    blinkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336', marginRight: 6 },
    liveText: { color: '#F44336', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    activeReason: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    callerText: { color: '#666', fontSize: 12, marginBottom: 15 },
    joinCallBtn: { backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center' },
    joinText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    startCallBtn: { borderRadius: 20, overflow: 'hidden', elevation: 6 },
    startGradient: { padding: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    startCallText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 12 },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111', marginBottom: 10 },
    tab: { paddingVertical: 12, marginRight: 25 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
    tabLabel: { color: '#444', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
    activeLabel: { color: '#fff' },
    content: { flex: 1 },
    memberToolbox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { color: '#666', fontSize: 12 },
    selectAll: { color: '#7C3AED', fontWeight: 'bold', fontSize: 12 },
    memberCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 16, marginBottom: 10 },
    selectedMember: { backgroundColor: 'rgba(124, 58, 237, 0.05)', borderColor: 'rgba(124, 58, 237, 0.3)', borderWidth: 1 },
    memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    memberName: { color: '#fff', fontWeight: '500' },
    meBadge: { color: '#444', fontSize: 10, fontWeight: 'bold' },
    onlineDot: { position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#111' },
    memberStatusText: { color: '#444', fontSize: 11, marginTop: 2 },
    longPressHint: { color: '#333', fontSize: 11, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    priorityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
    priorityTab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1e1e1e', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    priorityTabActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    priorityTabText: { color: '#666', fontSize: 10, fontWeight: '800' },
    priorityTabTextActive: { color: '#fff' },
    scheduleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    schedBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1e1e1e', alignItems: 'center' },
    schedBtnActive: { backgroundColor: '#7C3AED' },
    schedBtnText: { color: '#fff', fontSize: 10, fontWeight: '900' },
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
    mBtnTxtConfirm: { color: '#fff', fontWeight: 'bold' },
    emptyHistory: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
    emptyHistoryText: { color: '#666', marginTop: 15, fontSize: 13, fontWeight: '600' },
    historyCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
    historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    hReasonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    hReason: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    hLiveBadge: { backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    hLiveText: { color: '#fff', fontSize: 8, fontWeight: '900' },
    hDate: { color: '#444', fontSize: 11, fontWeight: 'bold', marginLeft: 10 },
    hBy: { color: '#666', fontSize: 12, marginBottom: 12 },
    hStatsRow: { flexDirection: 'row', gap: 12 },
    hStatsRowActive: { flexDirection: 'row', gap: 12, opacity: 0.3 },
    hStatItem: { backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
});

export default GroupDetailScreen;

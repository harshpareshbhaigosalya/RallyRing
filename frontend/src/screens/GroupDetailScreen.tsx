import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Share, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { triggerCall } from '../api/auth';
import { useStore } from '../store/useStore';
import { PhoneCall, Trash2, UserPlus, LogOut, CheckCircle, Circle, RefreshCw } from 'lucide-react-native';

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

    useEffect(() => {
        const unsubGroup = firestore().collection('groups').doc(groupId).onSnapshot(doc => {
            if (!doc.exists) {
                navigation.goBack();
                return;
            }
            const data = doc.data();
            setGroup(data);

            if (data?.members) {
                // Pre-select all members if list empty
                if (selectedMembers.length === 0) {
                    setSelectedMembers(data.members.filter((m: string) => m !== user?.uid));
                }

                data.members.forEach(async (mId: string) => {
                    if (!memberData[mId]) {
                        try {
                            const mDoc = await firestore().collection('users').doc(mId).get();
                            if (mDoc.exists()) {
                                setMemberData(prev => ({ ...prev, [mId]: mDoc.data()?.name || mId }));
                            }
                        } catch (err) { }
                    }
                });
            }
        });

        const unsubCall = firestore()
            .collection('call_sessions')
            .where('groupId', '==', groupId)
            .where('status', '==', 'ringing')
            .onSnapshot(snapshot => {
                if (!snapshot.empty) {
                    setActiveCall(snapshot.docs[0].data());
                } else {
                    setActiveCall(null);
                }
            });

        return () => { unsubGroup(); unsubCall(); };
    }, [groupId]);

    const handleToggleMember = (mId: string) => {
        if (mId === user?.uid) return;
        setSelectedMembers(prev =>
            prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
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
            const res = await triggerCall(
                groupId,
                user.uid,
                group.name,
                'Rally',
                selectedMembers,
                callReason.trim() || group.description || 'Rally Needed!'
            );
            setShowCallModal(false);
            setCallReason('');
            Alert.alert("Call Sent!", `Notifying ${res.tokensTargeted} member(s).`);
        } catch (e: any) {
            Alert.alert("Call Failed", "Check your connection and backend.");
        } finally {
            setLoadingCall(false);
        }
    };

    const handleStatusResponse = async (status: 'accepted' | 'rejected') => {
        if (!activeCall || !user) return;
        try {
            await firestore().collection('call_sessions').doc(activeCall.callId).update({
                [`responses.${user.uid}`]: status
            });
            if (status === 'accepted') {
                navigation.navigate('Ringing', {
                    callId: activeCall.callId,
                    groupName: activeCall.groupName,
                    callerName: memberData[activeCall.callerId] || 'Someone',
                    reason: activeCall.reason
                });
            }
        } catch (e) {
            Alert.alert("Error", "Failed to update response");
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert("Delete Group", "Are you sure? This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    await firestore().collection('groups').doc(groupId).delete();
                    navigation.goBack();
                }
            }
        ]);
    };

    const handleLeaveGroup = async () => {
        const remaining = group.members.filter((m: string) => m !== user?.uid);
        await firestore().collection('groups').doc(groupId).update({
            members: remaining
        });
        navigation.goBack();
    };

    const isAdmin = group?.admin === user?.uid;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.title} numberOfLines={1}>{group?.name}</Text>
                    <Text style={styles.subtitle}>ID: {groupId} • {group?.members.length} Members</Text>
                </View>
                <TouchableOpacity onPress={() => Share.share({ message: `Join my RallyRing! ID: ${groupId}` })}>
                    <UserPlus color="#7C3AED" size={24} />
                </TouchableOpacity>
            </View>

            {group?.description ? (
                <View style={styles.descBox}>
                    <Text style={styles.descText}>{group.description}</Text>
                </View>
            ) : null}

            {/* Active Call State or Start Button */}
            {activeCall ? (
                <View style={styles.activeCallBox}>
                    <View style={styles.row}>
                        <RefreshCw color="#F44336" size={20} />
                        <Text style={styles.activeCallText}>LIVE RALLY CALL</Text>
                    </View>
                    <Text style={styles.callReasonText}>"{activeCall.reason || 'No reason provided'}"</Text>

                    <View style={styles.statusRow}>
                        <Text style={[styles.statusItem, { color: '#4CAF50' }]}>✅ {Object.values(activeCall.responses).filter(v => v === 'accepted').length} Accepted</Text>
                        <Text style={[styles.statusItem, { color: '#F44336' }]}>❌ {Object.values(activeCall.responses).filter(v => v === 'rejected').length} Rejected</Text>
                        <Text style={[styles.statusItem, { color: '#FFC107' }]}>⏳ {Object.values(activeCall.responses).filter(v => v === 'pending').length} Pending</Text>
                    </View>

                    {activeCall.callerId === user?.uid ? (
                        <TouchableOpacity
                            style={styles.endButton}
                            onPress={async () => {
                                await firestore().collection('call_sessions').doc(activeCall.callId).update({ status: 'ended' });
                            }}
                        >
                            <Text style={styles.endButtonText}>END CALL FOR ALL</Text>
                        </TouchableOpacity>
                    ) : (
                        activeCall.responses[user?.uid || ''] === 'pending' ? (
                            <View style={styles.responseButtonsRow}>
                                <TouchableOpacity
                                    style={[styles.smallButton, styles.rejectSmall]}
                                    onPress={() => handleStatusResponse('rejected')}
                                >
                                    <Text style={styles.buttonTextSmall}>Reject</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallButton, styles.acceptSmall]}
                                    onPress={() => handleStatusResponse('accepted')}
                                >
                                    <Text style={styles.buttonTextSmall}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.viewCallButton}
                                onPress={() => navigation.navigate('Ringing', {
                                    callId: activeCall.callId,
                                    groupName: activeCall.groupName,
                                    callerName: memberData[activeCall.callerId] || 'Someone',
                                    reason: activeCall.reason
                                })}
                            >
                                <Text style={styles.viewCallText}>VIEW RALLY STATUS</Text>
                            </TouchableOpacity>
                        )
                    )}
                </View>
            ) : (
                <TouchableOpacity
                    style={[styles.callButton, loadingCall && { opacity: 0.7 }]}
                    onPress={() => setShowCallModal(true)}
                    disabled={loadingCall}
                >
                    <PhoneCall color="white" size={24} />
                    <Text style={styles.callButtonText}>START RALLY CALL</Text>
                </TouchableOpacity>
            )}

            {/* Member Management UI */}
            <View style={styles.sectionHeader}>
                <Text style={styles.memberHeader}>Select Members to Notify</Text>
                <TouchableOpacity onPress={handleSelectAll}>
                    <Text style={styles.selectAllText}>
                        {selectedMembers.length === group?.members.length - 1 ? 'Deselect All' : 'Select All'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll}>
                {group?.members.map((m: string) => (
                    <TouchableOpacity
                        key={m}
                        style={[
                            styles.memberItem,
                            m === user?.uid && styles.meItem,
                            selectedMembers.includes(m) && styles.selectedItem
                        ]}
                        onPress={() => handleToggleMember(m)}
                        disabled={m === user?.uid}
                    >
                        <View style={styles.row}>
                            {m === user?.uid ? null : (
                                selectedMembers.includes(m) ? <CheckCircle color="#7C3AED" size={20} /> : <Circle color="#666" size={20} />
                            )}
                            <Text style={[styles.memberText, m === user?.uid && { marginLeft: 0 }]}>
                                {m === user?.uid ? `You (${memberData[m] || user.name})` : (memberData[m] || `User ${m}`)}
                            </Text>
                        </View>
                        {m === group.admin && <Text style={styles.adminTag}>ADMIN</Text>}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
                {isAdmin ? (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
                        <Trash2 color="#F44336" size={20} />
                        <Text style={styles.deleteText}>Delete Group</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                        <LogOut color="#aaa" size={20} />
                        <Text style={styles.leaveText}>Leave Group</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Call Reason Modal */}
            <Modal visible={showCallModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rally Reason</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Why are you calling? (Optional)"
                            placeholderTextColor="#666"
                            value={callReason}
                            onChangeText={setCallReason}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCallModal(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirm, (loadingCall || selectedMembers.length === 0) && { opacity: 0.5 }]}
                                onPress={handleTriggerCall}
                                disabled={loadingCall || selectedMembers.length === 0}
                            >
                                {loadingCall ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <Text style={styles.confirmText}>Notify {selectedMembers.length} People</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 15 },
    title: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
    subtitle: { color: '#aaa', fontSize: 13, marginTop: 2 },
    descBox: { backgroundColor: '#1e1e1e', padding: 12, borderRadius: 10, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
    descText: { color: '#ccc', fontStyle: 'italic' },
    callButton: { backgroundColor: '#7C3AED', padding: 18, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
    callButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
    activeCallBox: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#F44336', marginBottom: 25 },
    activeCallText: { color: '#F44336', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
    callReasonText: { color: '#fff', fontSize: 18, fontWeight: '500', marginVertical: 10 },
    statusRow: { flexDirection: 'row', marginTop: 5 },
    statusItem: { color: '#aaa', marginRight: 15, fontSize: 13 },
    endButton: { backgroundColor: '#F44336', padding: 10, borderRadius: 8, marginTop: 15, alignItems: 'center' },
    endButtonText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    memberHeader: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    selectAllText: { color: '#7C3AED', fontWeight: 'bold' },
    scroll: { flex: 1 },
    memberItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectedItem: { backgroundColor: 'rgba(124, 58, 237, 0.1)', borderColor: '#7C3AED', borderWidth: 1 },
    meItem: { opacity: 0.8 },
    memberText: { color: '#fff', fontSize: 16, marginLeft: 10 },
    viewCallButton: { backgroundColor: '#1e1e1e', padding: 10, borderRadius: 8, marginTop: 15, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    viewCallText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    responseButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    smallButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    acceptSmall: { backgroundColor: '#4CAF50', marginLeft: 5 },
    rejectSmall: { backgroundColor: '#F44336', marginRight: 5 },
    buttonTextSmall: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    adminTag: { color: '#7C3AED', fontSize: 10, fontWeight: 'bold', backgroundColor: 'rgba(124, 58, 237, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

    footer: { paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
    deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    deleteText: { color: '#F44336', marginLeft: 8, fontWeight: '600' },
    leaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    leaveText: { color: '#aaa', marginLeft: 8, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 25 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    modalInput: { backgroundColor: '#2e2e2e', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
    modalCancel: { marginRight: 20, justifyContent: 'center' },
    cancelText: { color: '#aaa', fontSize: 16 },
    modalConfirm: { backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    confirmText: { color: '#fff', fontWeight: 'bold' }
});

export default GroupDetailScreen;

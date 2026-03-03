import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { triggerCall } from '../api/auth';
import { useStore } from '../store/useStore';
import { PhoneCall } from 'lucide-react-native';

const GroupDetailScreen = ({ route }: any) => {
    const { groupId } = route.params;
    const { user } = useStore();
    const [group, setGroup] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [activeCall, setActiveCall] = useState<any>(null);

    useEffect(() => {
        const unsubGroup = firestore().collection('groups').doc(groupId).onSnapshot(doc => {
            setGroup(doc.data());
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

    const handleTriggerCall = async () => {
        if (!user || !group) return;
        try {
            await triggerCall(groupId, user.uid, group.name);
            Alert.alert("Call Triggered", "Members are being notified.");
        } catch (e) {
            Alert.alert("Error", "Could not trigger call.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{group?.name}</Text>
            <Text style={styles.subtitle}>ID: {groupId}</Text>

            {activeCall ? (
                <View style={styles.activeCallBox}>
                    <Text style={styles.activeCallText}>🚨 CALL IN PROGRESS</Text>
                    <Text style={styles.responseSummary}>
                        Accepted: {Object.values(activeCall.responses).filter(v => v === 'accepted').length}
                    </Text>
                </View>
            ) : (
                <TouchableOpacity style={styles.callButton} onPress={handleTriggerCall}>
                    <PhoneCall color="white" size={24} />
                    <Text style={styles.callButtonText}>START GROUP CALL</Text>
                </TouchableOpacity>
            )}

            <Text style={styles.memberHeader}>Members</Text>
            <ScrollView>
                {group?.members.map((m: string) => (
                    <View key={m} style={styles.memberItem}>
                        <Text style={styles.memberText}>{m === user?.uid ? "You" : `User ${m}`}</Text>
                        {activeCall?.responses[m] && (
                            <Text style={[styles.statusTag, { color: activeCall.responses[m] === 'accepted' ? '#4CAF50' : '#F44336' }]}>
                                {activeCall.responses[m].toUpperCase()}
                            </Text>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 20 },
    title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginTop: 40 },
    subtitle: { color: '#aaa', marginBottom: 30 },
    callButton: { backgroundColor: '#7C3AED', padding: 20, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    callButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    activeCallBox: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#F44336', marginBottom: 30 },
    activeCallText: { color: '#F44336', fontWeight: 'bold', fontSize: 18 },
    responseSummary: { color: '#fff', marginTop: 10 },
    memberHeader: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    memberItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
    memberText: { color: '#fff' },
    statusTag: { fontWeight: 'bold', fontSize: 12 }
});

export default GroupDetailScreen;

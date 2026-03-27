import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';
import { 
    ChevronLeft, CheckCircle2, XCircle, Clock, MessageSquare, 
    Users, Phone, Calendar, AlertCircle
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const RallyDetailScreen = ({ route, navigation }: any) => {
    const { callId } = route.params;
    const { user } = useStore();
    const [call, setCall] = useState<any>(null);
    const [memberNames, setMemberNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = firestore()
            .collection('call_sessions')
            .doc(callId)
            .onSnapshot(async doc => {
                if (doc.exists()) {
                    const data = doc.data();
                    setCall(data);
                    
                    // Fetch member names if not already fetched
                    if (data?.members) {
                        const names: Record<string, string> = {};
                        await Promise.all(data.members.map(async (uid: string) => {
                            const uDoc = await firestore().collection('users').doc(uid).get();
                            if (uDoc.exists()) {
                                names[uid] = uDoc.data()?.name || 'Unknown';
                            }
                        }));
                        setMemberNames(names);
                    }
                }
                setLoading(false);
            });

        return () => unsubscribe();
    }, [callId]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
            </View>
        );
    }

    if (!call) {
        return (
            <View style={styles.errorContainer}>
                <AlertCircle color="#ef4444" size={48} />
                <Text style={styles.errorText}>Rally session not found.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>GO BACK</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const responses = call.responses || {};
    const memberList = call.members || [];
    const isUrgent = call.priority === 'urgent';

    const renderMember = (uid: string) => {
        const status = responses[uid] || 'pending';
        const isMsg = status.startsWith('msg:');
        const msgText = isMsg ? status.split('msg:')[1] : null;
        const name = memberNames[uid] || 'Loading...';

        let icon = <Clock color="#666" size={18} />;
        let statusText = 'Pending...';
        let statusColor = '#666';

        if (status === 'accepted') {
            icon = <CheckCircle2 color="#22c55e" size={18} />;
            statusText = 'Accepted';
            statusColor = '#22c55e';
        } else if (status === 'rejected') {
            icon = <XCircle color="#ef4444" size={18} />;
            statusText = 'Declined';
            statusColor = '#ef4444';
        } else if (isMsg) {
            icon = <MessageSquare color="#7C3AED" size={18} />;
            statusText = 'Messaged';
            statusColor = '#7C3AED';
        }

        return (
            <View key={uid} style={styles.memberItem}>
                <View style={styles.memberLeft}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
                    </View>
                    <View>
                        <Text style={styles.memberName}>{name} {uid === user?.uid && '(You)'}</Text>
                        <View style={styles.statusRow}>
                            {icon}
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                        </View>
                    </View>
                </View>
                {isMsg && (
                    <View style={styles.msgBubble}>
                        <Text style={styles.msgText}>"{msgText}"</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient 
                colors={isUrgent ? ['#7f1d1d', '#000'] : ['#1e1b4b', '#000']} 
                style={styles.header}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ChevronLeft color="#fff" size={28} />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <View style={[styles.priorityBadge, isUrgent && { backgroundColor: '#ef4444' }]}>
                        <Text style={styles.priorityText}>{call.priority?.toUpperCase() || 'CASUAL'}</Text>
                    </View>
                    <Text style={styles.rallyId}>RALLY #{callId.slice(-4)}</Text>
                    <Text style={styles.reasonText}>"{call.reason}"</Text>
                    <Text style={styles.groupText}>in {call.groupName}</Text>
                </View>
            </LinearGradient>

            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{Object.values(responses).filter(v => v === 'accepted').length}</Text>
                    <Text style={styles.statLabel}>COMING</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{Object.values(responses).filter(v => v === 'rejected').length}</Text>
                    <Text style={styles.statLabel}>DECLINED</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={styles.statNum}>{memberList.length - Object.keys(responses).length}</Text>
                    <Text style={styles.statLabel}>AWAY</Text>
                </View>
            </View>

            <ScrollView style={styles.list}>
                <View style={styles.sectionHeader}>
                    <Users color="#666" size={16} />
                    <Text style={styles.sectionTitle}>SQUAD RESPONSES</Text>
                </View>

                {memberList.map((uid: string) => renderMember(uid))}

                <View style={styles.footerInfo}>
                    <Calendar color="#333" size={14} />
                    <Text style={styles.footerDate}>
                        Created {call.createdAt?.toDate ? call.createdAt.toDate().toLocaleString() : 'Recently'}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    errorContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 40 },
    errorText: { color: '#666', marginTop: 20, textAlign: 'center', marginBottom: 30 },
    backBtn: { backgroundColor: '#1e1e1e', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
    backBtnText: { color: '#fff', fontWeight: 'bold' },
    
    header: { paddingTop: 60, paddingHorizontal: 25, paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
    backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    headerContent: { alignItems: 'center' },
    priorityBadge: { backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
    priorityText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    rallyId: { color: '#666', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
    reasonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    groupText: { color: '#666', fontSize: 14, fontWeight: '600' },

    statsRow: { 
        flexDirection: 'row', backgroundColor: '#0a0a0a', marginHorizontal: 25, 
        marginTop: -30, borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#111',
        elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10
    },
    statBox: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: 9, color: '#444', fontWeight: '800', marginTop: 4, letterSpacing: 1 },
    statDivider: { width: 1, backgroundColor: '#111', height: '100%' },

    list: { flex: 1, paddingHorizontal: 25, paddingTop: 30 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    sectionTitle: { color: '#444', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    
    memberItem: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
    memberLeft: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    memberName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    
    msgBubble: { backgroundColor: 'rgba(124, 58, 237, 0.05)', padding: 12, borderRadius: 12, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
    msgText: { color: '#fff', fontSize: 13, fontStyle: 'italic' },
    
    footerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 20, marginBottom: 50, opacity: 0.3 },
    footerDate: { color: '#fff', fontSize: 11, fontWeight: '600' }
});

export default RallyDetailScreen;

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';
import { 
    ChevronLeft, CheckCircle2, XCircle, Clock, MessageSquare, 
    Users, Phone, Calendar, AlertCircle, Timer
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
                    
                    // Fetch member names
                    const allUids = new Set([
                        ...(data?.members || []),
                        ...Object.keys(data?.responses || {}),
                    ]);

                    const names: Record<string, string> = { ...memberNames };
                    await Promise.all([...allUids].map(async (uid: string) => {
                        if (!names[uid]) {
                            try {
                                const uDoc = await firestore().collection('users').doc(uid).get();
                                if (uDoc.exists()) {
                                    names[uid] = uDoc.data()?.name || 'Unknown';
                                }
                            } catch (e) {}
                        }
                    }));
                    setMemberNames(names);
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
    const allUids = [...new Set([...(call.members || []), ...Object.keys(responses)])];
    const isUrgent = call.priority === 'urgent';
    const isLive = call.status === 'ringing';

    // Parse response status properly
    const parseResponse = (status: string) => {
        if (!status) return { type: 'pending', label: 'Pending', detail: null };
        if (status === 'accepted') return { type: 'accepted', label: 'Accepted', detail: null };
        if (status === 'rejected') return { type: 'rejected', label: 'Declined', detail: null };
        if (status === 'pending') return { type: 'pending', label: 'Pending', detail: null };
        
        // Handle custom responses like "accepted:5min", "accepted:way", "accepted:Coming soon"
        if (status.startsWith('accepted:')) {
            const msg = status.substring(9); // Remove "accepted:"
            const shortMap: Record<string, string> = {
                '5min': 'In 5 minutes',
                '15min': 'In 15 minutes',
                'way': 'On the way',
            };
            return { type: 'accepted', label: 'Accepted', detail: shortMap[msg] || msg };
        }
        
        // Handle msg: prefix (legacy)
        if (status.startsWith('msg:')) {
            return { type: 'message', label: 'Messaged', detail: status.substring(4) };
        }
        
        return { type: 'unknown', label: status, detail: null };
    };

    const acceptedCount = Object.values(responses).filter((v: any) => String(v).startsWith('accepted')).length;
    const rejectedCount = Object.values(responses).filter((v: any) => v === 'rejected').length;
    const pendingCount = Object.values(responses).filter((v: any) => v === 'pending').length;

    const renderMember = (uid: string) => {
        const rawStatus = responses[uid] || 'pending';
        const parsed = parseResponse(rawStatus);
        const name = memberNames[uid] || 'Loading...';

        let icon = <Clock color="#eab308" size={18} />;
        let statusColor = '#eab308';
        let pillBg = 'rgba(234, 179, 8, 0.1)';

        if (parsed.type === 'accepted') {
            icon = <CheckCircle2 color="#22c55e" size={18} />;
            statusColor = '#22c55e';
            pillBg = 'rgba(34, 197, 94, 0.1)';
        } else if (parsed.type === 'rejected') {
            icon = <XCircle color="#ef4444" size={18} />;
            statusColor = '#ef4444';
            pillBg = 'rgba(239, 68, 68, 0.1)';
        } else if (parsed.type === 'message') {
            icon = <MessageSquare color="#7C3AED" size={18} />;
            statusColor = '#7C3AED';
            pillBg = 'rgba(124, 58, 237, 0.1)';
        }

        return (
            <View key={uid} style={styles.memberItem}>
                <View style={styles.memberLeft}>
                    <View style={[styles.avatar, { borderColor: statusColor, borderWidth: 1.5 }]}>
                        <Text style={styles.avatarText}>{name[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{name} {uid === user?.uid && '(You)'}</Text>
                        <View style={styles.statusRow}>
                            {icon}
                            <Text style={[styles.statusText, { color: statusColor }]}>{parsed.label}</Text>
                        </View>
                    </View>
                </View>
                {/* Detail message bubble */}
                {parsed.detail && (
                    <View style={[styles.msgBubble, { borderLeftColor: statusColor }]}>
                        <Text style={styles.msgText}>"{parsed.detail}"</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient 
                colors={isUrgent ? ['#7f1d1d', '#450a0a', '#000'] : ['#1e1b4b', '#0f0a2e', '#000']} 
                style={styles.header}
            >
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ChevronLeft color="#fff" size={24} />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <View style={styles.badgeRow}>
                        <View style={[styles.priorityBadge, isUrgent && { backgroundColor: '#ef4444' }]}>
                            <Text style={styles.priorityText}>{call.priority?.toUpperCase() || 'CASUAL'}</Text>
                        </View>
                        {isLive && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.reasonText}>"{call.reason || 'Rally'}"</Text>
                    <Text style={styles.groupText}>in {call.groupName}</Text>
                </View>
            </LinearGradient>

            {/* Stats Card */}
            <View style={styles.statsCard}>
                <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: '#22c55e' }]}>{acceptedCount}</Text>
                    <Text style={styles.statLabel}>COMING</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: '#ef4444' }]}>{rejectedCount}</Text>
                    <Text style={styles.statLabel}>DECLINED</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: '#eab308' }]}>{pendingCount}</Text>
                    <Text style={styles.statLabel}>PENDING</Text>
                </View>
            </View>

            <ScrollView style={styles.list}>
                <View style={styles.sectionHeader}>
                    <Users color="#555" size={14} />
                    <Text style={styles.sectionTitle}>SQUAD RESPONSES</Text>
                    <Text style={styles.memberCountText}>{allUids.length} members</Text>
                </View>

                {allUids.map((uid: string) => renderMember(uid))}

                <View style={styles.footerInfo}>
                    <Calendar color="#333" size={14} />
                    <Text style={styles.footerDate}>
                        {call.createdAt?.toDate ? call.createdAt.toDate().toLocaleString() : 'Recently'}
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
    errorText: { color: '#666', marginTop: 20, textAlign: 'center', marginBottom: 30, fontSize: 16 },
    backBtn: { backgroundColor: '#1e1e1e', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 16 },
    backBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
    
    header: { paddingTop: 55, paddingHorizontal: 24, paddingBottom: 45, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    headerContent: { alignItems: 'center' },
    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    priorityBadge: { backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
    priorityText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, gap: 6 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
    liveText: { color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    reasonText: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
    groupText: { color: '#666', fontSize: 14, fontWeight: '600' },

    statsCard: { 
        flexDirection: 'row', backgroundColor: '#0a0a0a', marginHorizontal: 24, 
        marginTop: -28, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#151515',
        elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10
    },
    statBox: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
    statLabel: { fontSize: 9, color: '#555', fontWeight: '800', marginTop: 3, letterSpacing: 1.5 },
    statDivider: { width: 1, backgroundColor: '#151515', height: '100%' },

    list: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    sectionTitle: { color: '#555', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, flex: 1 },
    memberCountText: { color: '#333', fontSize: 11, fontWeight: '700' },
    
    memberItem: { backgroundColor: '#0a0a0a', padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#111' },
    memberLeft: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
    memberName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 3 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 12, fontWeight: '700' },
    
    msgBubble: { backgroundColor: 'rgba(124, 58, 237, 0.05)', padding: 12, borderRadius: 14, marginTop: 10, borderLeftWidth: 3 },
    msgText: { color: '#ccc', fontSize: 13, fontStyle: 'italic' },
    
    footerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 20, marginBottom: 50, opacity: 0.3 },
    footerDate: { color: '#fff', fontSize: 11, fontWeight: '600' }
});

export default RallyDetailScreen;

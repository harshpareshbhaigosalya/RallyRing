import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Share, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { useStore } from '../store/useStore';
import { Plus, Users, BellRing } from 'lucide-react-native';
import { Vibration } from 'react-native';

const HomeScreen = ({ navigation }: any) => {
    const { user, groups, setGroups } = useStore();

    useEffect(() => {
        if (!user || !user.uid) return;

        // Recurring Permission Check to ensure reliability
        const checkPerms = async () => {
            const authStatus = await messaging().requestPermission();
            if (authStatus === messaging.AuthorizationStatus.DENIED) {
                Alert.alert("Notifications Disabled", "RallyRing cannot alert you without notifications. Please enable them in settings.");
            }
        };
        checkPerms();

        const unsubscribe = firestore()
            .collection('groups')
            .where('members', 'array-contains', user.uid)
            .onSnapshot(
                snapshot => {
                    const groupList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setGroups(groupList);
                },
                error => {
                    console.error("Firestore Error:", error);
                    Alert.alert("Database Error", "Unable to connect. " + error.message);
                }
            );

        return () => unsubscribe();
    }, [user]);

    const onShare = async (groupId: string) => {
        try {
            await Share.share({ message: `Join my RallyRing! Code: ${groupId}` });
        } catch (error) {
            console.log(error);
        }
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        >
            <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.memberCount}>{item.members?.length || 0} members</Text>
            </View>
            <TouchableOpacity onPress={() => onShare(item.id)} style={styles.shareButton}>
                <Text style={styles.shareText}>Share ID</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const testHardware = () => {
        Vibration.vibrate([100, 200, 100, 200, 100, 200]);
        Alert.alert("Hardware Test", "Vibration triggered! If you felt this, your device is ready to Rally.");
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.appName}>RALLYRING</Text>
                    <Text style={styles.welcomeTitle}>Hi, {user?.name?.split(' ')[0] || 'User'}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerIcon} onPress={testHardware}>
                        <BellRing color="#7C3AED" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('JoinGroup')}>
                        <Users color="#fff" size={24} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('CreateGroup')}>
                        <Plus color="#fff" size={24} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.infoStrip}>
                <Text style={styles.infoText}>ID: {user?.uid}</Text>
                <Text style={styles.infoText}>{groups.length} Groups</Text>
            </View>

            <FlatList
                data={groups}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Users color="#222" size={60} />
                        <Text style={styles.emptyMain}>No Rally Groups</Text>
                        <Text style={styles.emptySub}>Create a group to start summoning your squad!</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 25, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    appName: { color: '#7C3AED', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 2 },
    welcomeTitle: { fontSize: 26, color: '#fff', fontWeight: 'bold' },
    headerActions: { flexDirection: 'row' },
    headerIcon: { marginLeft: 20, backgroundColor: '#1e1e1e', padding: 10, borderRadius: 12 },
    infoStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
    infoText: { color: '#666', fontSize: 13, fontWeight: '500' },
    list: { padding: 15 },
    card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 16, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#7C3AED' },
    groupName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    memberCount: { color: '#888', marginTop: 4, fontSize: 14 },
    shareButton: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: 'rgba(124, 58, 237, 0.1)', borderRadius: 10 },
    shareText: { color: '#7C3AED', fontWeight: 'bold', fontSize: 12 },
    emptyBox: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
    emptyMain: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 20 },
    emptySub: { color: '#555', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }
});

export default HomeScreen;

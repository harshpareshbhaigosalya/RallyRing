import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Share, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';
import { Plus, Users } from 'lucide-react-native';

const HomeScreen = ({ navigation }: any) => {
    const { user, groups, setGroups } = useStore();

    useEffect(() => {
        if (!user || !user.uid) return;

        // Listen for groups where user is a member
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
                    Alert.alert("Database Error", "Unable to connect to group list. " + error.message);
                }
            );

        return () => unsubscribe();
    }, [user]);

    const onShare = async (groupId: string) => {
        try {
            await Share.share({ message: `Join my RallyRing group! ID: ${groupId}` });
        } catch (error) {
            console.log(error);
        }
    };

    const renderItem = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        >
            <View>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.memberCount}>{item.members.length} members</Text>
            </View>
            <TouchableOpacity onPress={() => onShare(item.id)}>
                <Text style={styles.shareText}>Share ID</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Welcome, {user?.name}</Text>
                <Text style={styles.uid}>Your ID: {user?.uid}</Text>
            </View>

            <FlatList
                data={groups}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>No groups yet. Create or Join one!</Text>}
            />

            <View style={styles.fabContainer}>
                <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('JoinGroup')}>
                    <Users color="white" size={24} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateGroup')}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, paddingTop: 60, backgroundColor: '#1e1e1e' },
    title: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
    uid: { color: '#aaa', marginTop: 5 },
    list: { padding: 15 },
    card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    groupName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    memberCount: { color: '#aaa', marginTop: 5 },
    shareText: { color: '#7C3AED', fontWeight: 'bold' },
    empty: { color: '#666', textAlign: 'center', marginTop: 100 },
    fabContainer: { position: 'absolute', bottom: 30, right: 20, flexDirection: 'row' },
    fab: { backgroundColor: '#7C3AED', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 15 }
});

export default HomeScreen;

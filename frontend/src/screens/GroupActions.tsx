import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';

const CreateGroupScreen = ({ navigation }: any) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const { user } = useStore();

    const handleCreate = async () => {
        if (!name.trim() || !user) return;
        try {
            const groupId = Math.random().toString(36).substring(2, 8).toUpperCase();
            await firestore().collection('groups').doc(groupId).set({
                name: name.trim(),
                description: description.trim(),
                createdBy: user.uid,
                admin: user.uid,
                members: [user.uid],
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
            navigation.goBack();
        } catch (e) { Alert.alert("Error", "Failed to create group"); }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>New Group</Text>
            <TextInput
                style={styles.input}
                placeholder="Group Name (e.g. Lunch Mates)"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
            />
            <TextInput
                style={styles.input}
                placeholder="Default Reason (Optional)"
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
            />
            <TouchableOpacity style={styles.button} onPress={handleCreate}>
                <Text style={styles.buttonText}>Create Group</Text>
            </TouchableOpacity>
        </View>
    );
};

const JoinGroupScreen = ({ navigation }: any) => {
    const [groupId, setGroupId] = useState('');
    const { user } = useStore();

    const handleJoin = async () => {
        if (!groupId.trim() || !user) return;
        try {
            const gId = groupId.trim().toUpperCase();
            const doc = await firestore().collection('groups').doc(gId).get();
            if (!doc.exists) {
                Alert.alert("Error", "Group not found");
                return;
            }

            await firestore().collection('groups').doc(gId).update({
                members: firestore.FieldValue.arrayUnion(user.uid)
            });
            navigation.goBack();
        } catch (e) { Alert.alert("Error", "Failed to join group"); }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Join Group</Text>
            <TextInput
                style={styles.input}
                placeholder="Enter Group ID"
                placeholderTextColor="#666"
                value={groupId}
                onChangeText={setGroupId}
                autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.button} onPress={handleJoin}>
                <Text style={styles.buttonText}>Join Group</Text>
            </TouchableOpacity>
        </View>
    );
};

// Simplified export
export { CreateGroupScreen, JoinGroupScreen };

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 20 },
    title: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
    input: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 10, fontSize: 18, marginBottom: 20 },
    button: { backgroundColor: '#7C3AED', padding: 18, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' }
});

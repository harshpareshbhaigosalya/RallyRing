import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, 
    StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, 
    Dimensions, ScrollView
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowLeft, Users, Plus, Hash } from 'lucide-react-native';

const CreateGroupScreen = ({ navigation }: any) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useStore();

    const handleCreate = async () => {
        if (!name.trim() || !user || loading) return;
        setLoading(true);
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
        } catch (e) {
            Alert.alert("Error", "Failed to create squad");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ paddingHorizontal: 25 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.titleArea}>
                    <View style={styles.iconBox}>
                        <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.iconGradient}>
                             <Plus color="#fff" size={32} />
                        </LinearGradient>
                    </View>
                    <Text style={styles.title}>New Squad</Text>
                    <Text style={styles.subtitle}>Define your rally point and gather your friends.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>SQUAD NAME</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Lunch Mates"
                            placeholderTextColor="#444"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                            placeholder="Reason or focus..."
                            placeholderTextColor="#444"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            blurOnSubmit={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleCreate}
                        disabled={loading}
                    >
                         <LinearGradient colors={['#7C3AED', '#C026D3']} style={styles.btnGradient}>
                            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Launch Squad</Text>}
                         </LinearGradient>
                    </TouchableOpacity>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const JoinGroupScreen = ({ navigation }: any) => {
    const [groupId, setGroupId] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useStore();

    const handleJoin = async () => {
        if (!groupId.trim() || !user || loading) return;
        setLoading(true);
        try {
            const gId = groupId.trim().toUpperCase();
            const doc = await firestore().collection('groups').doc(gId).get();
            if (!doc.exists) {
                Alert.alert("Error", "Squad not found. Double check the ID.");
                return;
            }

            await firestore().collection('groups').doc(gId).update({
                members: firestore.FieldValue.arrayUnion(user.uid)
            });
            navigation.goBack();
        } catch (e) { Alert.alert("Error", "Failed to join squad"); }
        finally { setLoading(false); }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.titleArea}>
                    <View style={styles.iconBox}>
                        <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.iconGradient}>
                             <Hash color="#fff" size={32} />
                        </LinearGradient>
                    </View>
                    <Text style={styles.title}>Join Squad</Text>
                    <Text style={styles.subtitle}>Enter the invitation code to link with your crew.</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>SQUAD INVITATION CODE</Text>
                        <TextInput
                            style={[styles.input, { color: '#3b82f6', fontSize: 24, fontWeight: '800' }]}
                            placeholder="e.g. A1B2C3"
                            placeholderTextColor="#444"
                            value={groupId}
                            onChangeText={setGroupId}
                            autoCapitalize="characters"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleJoin}
                        disabled={loading}
                    >
                         <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.btnGradient}>
                            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Enter Squad</Text>}
                         </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export { CreateGroupScreen, JoinGroupScreen };

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingHorizontal: 25, paddingTop: 60, marginBottom: 20 },
    backBtn: { backgroundColor: '#111', padding: 12, borderRadius: 20, alignSelf: 'flex-start' },
    content: { flex: 1, paddingHorizontal: 25 },
    titleArea: { marginBottom: 40 },
    iconBox: { width: 70, height: 70, borderRadius: 25, overflow: 'hidden', marginBottom: 20 },
    iconGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
    subtitle: { color: '#666', fontSize: 16, marginTop: 8, lineHeight: 24 },
    form: { width: '100%' },
    inputWrapper: { marginBottom: 30 },
    inputLabel: { color: '#7C3AED', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
    input: { backgroundColor: '#111', color: '#fff', padding: 20, borderRadius: 22, fontSize: 18, borderWidth: 1, borderColor: '#1a1a1a' },
    actionBtn: { height: 65, borderRadius: 22, overflow: 'hidden', marginTop: 10 },
    btnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useStore } from '../store/useStore';
import { ArrowLeft, Volume2, Save, MicOff, Settings as SettingsIcon } from 'lucide-react-native';
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

const RINGTONES = [
    { id: 'ringtone', name: 'Standard Rally Ring' },
    { id: 'krishna_flute', name: 'Krishna Flute' },
    { id: 'walli_khan', name: 'Walli Khan' },
    { id: 'tornado_siren', name: 'Tornado Siren' },
];

const SettingsScreen = ({ navigation }: any) => {
    const { user } = useStore();
    const [selectedRingtone, setSelectedRingtone] = useState('ringtone');
    const [allowVoiceMsg, setAllowVoiceMsg] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const soundRef = useRef<Sound | null>(null);

    useEffect(() => {
        if (user?.uid) {
            firestore().collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data?.ringtone) setSelectedRingtone(data.ringtone);
                    if (data?.allowVoiceMsg !== undefined) setAllowVoiceMsg(data.allowVoiceMsg);
                }
            });
        }
        return () => {
            if (soundRef.current) soundRef.current.release();
        };
    }, []);

    const playTestSound = (ringtoneId: string) => {
        if (soundRef.current) {
            soundRef.current.stop();
            soundRef.current.release();
        }
        const s = new Sound(ringtoneId, Sound.MAIN_BUNDLE, (error) => {
            if (error) {
                console.log('Failed to load sound', error);
                return;
            }
            s.play();
        });
        soundRef.current = s;
    };

    const handleSave = async () => {
        if (!user?.uid) return;
        setSaving(true);
        try {
            await firestore().collection('users').doc(user.uid).update({
                ringtone: selectedRingtone,
                allowVoiceMsg
            });
            Alert.alert('Saved', 'Your settings have been updated successfully!');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', 'Could not save settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft color="#fff" size={22} />
                </TouchableOpacity>
                <Text style={styles.title}>Personal Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.sectionTitle}>YOUR RALLY RINGTONE</Text>
                <Text style={styles.sectionDesc}>When a rally hits your phone, this is the sound that will play.</Text>
                
                <View style={styles.card}>
                    {RINGTONES.map((rt) => (
                        <TouchableOpacity 
                            key={rt.id} 
                            style={[styles.row, selectedRingtone === rt.id && styles.rowSelected]}
                            onPress={() => setSelectedRingtone(rt.id)}
                        >
                            <View style={styles.rowLeft}>
                                <View style={[styles.radio, selectedRingtone === rt.id && styles.radioSelected]} />
                                <Text style={styles.rowText}>{rt.name}</Text>
                            </View>
                            <TouchableOpacity style={styles.testBtn} onPress={() => playTestSound(rt.id)}>
                                <Volume2 color="#fff" size={16} />
                                <Text style={styles.testBtnText}>TEST</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ height: 30 }} />

                <Text style={styles.sectionTitle}>VOICE MSG PREFERENCES</Text>
                <Text style={styles.sectionDesc}>Allow squad members to use their actual recorded voice as the ringtone (coming soon to callers).</Text>
                
                <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MicOff color="#94a3b8" size={20} style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Allow Voice Bomb Rallies</Text>
                            <Text style={styles.settingSub}>If disabled, you will just hear your selected standard ringtone above.</Text>
                        </View>
                    </View>
                    <Switch 
                        value={allowVoiceMsg} 
                        onValueChange={setAllowVoiceMsg}
                        trackColor={{ false: '#334155', true: '#7C3AED' }}
                        thumbColor="#fff"
                    />
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    <Save color="#fff" size={20} />
                    <Text style={styles.saveText}>{saving ? 'SAVING...' : 'SAVE SETTINGS'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
    backBtn: { backgroundColor: '#111', padding: 10, borderRadius: 12, marginRight: 15 },
    title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    content: { flex: 1, paddingHorizontal: 20 },
    sectionTitle: { color: '#7C3AED', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginTop: 10 },
    sectionDesc: { color: '#64748b', fontSize: 13, marginBottom: 15, marginTop: 5 },
    card: { backgroundColor: '#111', borderRadius: 20, overflow: 'hidden', padding: 5 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 15 },
    rowSelected: { backgroundColor: 'rgba(124, 58, 237, 0.15)' },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#334155', marginRight: 15 },
    radioSelected: { borderColor: '#7C3AED', backgroundColor: '#7C3AED', borderWidth: 5 },
    rowText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    testBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 5 },
    testBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    settingTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    settingSub: { color: '#64748b', fontSize: 11, marginTop: 3 },
    footer: { padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#111' },
    saveBtn: { backgroundColor: '#7C3AED', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, gap: 10 },
    saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default SettingsScreen;

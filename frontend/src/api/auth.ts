import axios from 'axios';

const API_URL = 'https://rally-ring.vercel.app';

export const registerUser = async (name: string, fcmToken: string) => {
    try {
        const response = await axios.post(`${API_URL}/register`, { name, fcmToken });
        return response.data; // { uid: string }
    } catch (error) {
        console.error("Registration error:", error);
        throw error;
    }
};

export const updateToken = async (uid: string, fcmToken: string) => {
    try {
        await axios.post(`${API_URL}/update-token`, { uid, fcmToken });
    } catch (e) { }
};

export const triggerCall = async (
    groupId: string, 
    callerId: string, 
    groupName: string, 
    purposeType: string = 'Rally', 
    targetUids: string[] = [], 
    reason: string = '',
    priority: string = 'casual',
    scheduledAt: number | null = null
) => {
    try {
        const response = await axios.post(`${API_URL}/trigger-call`, { 
            groupId, callerId, groupName, purposeType, targetUids, reason, priority, scheduledAt 
        });
        return response.data;
    } catch (error: any) {
        console.error("Trigger call error:", error.response?.data || error.message);
        throw error;
    }
};
export const stopCall = async (callId: string) => {
    try {
        await axios.post(`${API_URL}/stop-call`, { callId });
    } catch (e) { }
};

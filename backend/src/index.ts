import express from 'express';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import cors from 'cors';

import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('RallyRing Backend is running! 🔥');
});

// Firebase initialization
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Use environment variable in production
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    // Fallback to local file in development
    const serviceAccountPath = path.join(__dirname, '../service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } else {
        console.error("FIREBASE_SERVICE_ACCOUNT env or service-account.json is missing.");
    }
}

if (serviceAccount && admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else if (!serviceAccount) {
    console.error("Firebase admin failed to initialize - missing credentials.");
}

const db = admin.firestore();
const fcm = admin.messaging();

// Helper: Generate unique 8-character ID
const generateUid = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};

/**
 * Register User / Get UID
 */
app.post('/register', async (req, res) => {
    try {
        const { name, fcmToken } = req.body;
        if (!name || !fcmToken) return res.status(400).send({ error: "Missing name or fcmToken" });

        const uid = generateUid();

        await db.collection('users').doc(uid).set({
            name,
            fcmToken,
            uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).send({ uid });
    } catch (error: any) {
        res.status(500).send({ error: error.message });
    }
});

/**
 * Trigger Group Call
 */
app.post('/trigger-call', async (req, res) => {
    try {
        const { groupId, callerId, groupName, purposeType } = req.body;

        // 1. Verify group and caller membership
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return res.status(404).send({ error: "Group not found" });

        const groupData = groupDoc.data();
        if (!groupData?.members.includes(callerId)) {
            return res.status(403).send({ error: "You are not a member of this group" });
        }

        // 2. Create Call Session
        const callId = `call_${Date.now()}`;
        const responses: any = {};
        groupData.members.forEach((mId: string) => {
            if (mId !== callerId) responses[mId] = 'pending';
        });

        await db.collection('call_sessions').doc(callId).set({
            callId,
            groupId,
            callerId,
            groupName,
            purposeType,
            status: 'ringing',
            responses,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Get FCM Tokens of all members except caller
        const memberDocs = await db.collection('users').where('uid', 'in', groupData.members).get();
        const tokens: string[] = [];
        memberDocs.forEach(doc => {
            const data = doc.data();
            if (data.uid !== callerId && data.fcmToken) {
                tokens.push(data.fcmToken);
            }
        });

        if (tokens.length === 0) {
            return res.status(200).send({ message: "No other members to call", callId });
        }

        // 4. Send FCM Data-only message (High Priority)
        let callerName = "Someone";
        const callerDoc = memberDocs.docs.find(d => d.id === callerId);

        if (callerDoc) {
            callerName = callerDoc.data().name;
        } else {
            // Fallback: direct lookup if the IN query failed to include the caller
            const directCallerDoc = await db.collection('users').doc(callerId).get();
            if (directCallerDoc.exists) {
                callerName = directCallerDoc.data()?.name || callerId;
            }
        }

        const message = {
            data: {
                type: 'INCOMING_CALL',
                callId,
                groupId,
                groupName,
                callerName,
                purposeType: purposeType || 'Rally',
            },
            tokens: tokens,
            android: {
                priority: 'high' as const,
                ttl: 0,
            }
        };

        const response = await fcm.sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} messages to ${tokens.length} tokens`);

        res.status(200).send({
            callId,
            successCount: response.successCount,
            failureCount: response.failureCount,
            tokensTargeted: tokens.length
        });
    } catch (error: any) {
        console.error("Error triggering call:", error);
        res.status(500).send({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Stop Call (e.g. timeout or cancelled)
 */
app.post('/stop-call', async (req, res) => {
    const { callId, groupId } = req.body;
    try {
        await db.collection('call_sessions').doc(callId).update({ status: 'ended' });

        // TODO: Send a STOP signal via FCM to dismiss notifications on all devices
        // ... implementation similar to trigger-call with type: 'STOP_CALL'

        res.status(200).send({ success: true });
    } catch (error) {
        res.status(500).send({ error: "Failed to stop call" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`RallyRing Backend running on port ${PORT}`);
});

export default app;

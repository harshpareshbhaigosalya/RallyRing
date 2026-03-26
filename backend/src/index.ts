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
let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
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
    console.log("Firebase Admin initialized");
}

const db = admin.firestore();
const fcm = admin.messaging();

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
        const { groupId, callerId, groupName, purposeType, targetUids, reason, priority, scheduledAt } = req.body;

        // 1. Verify group and caller membership
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return res.status(404).send({ error: "Group not found" });

        // -- Check if a call is already active for this group --
        const activeSnap = await db.collection('call_sessions')
            .where('groupId', '==', groupId)
            .where('status', '==', 'ringing')
            .limit(1)
            .get();
        if (!activeSnap.empty) {
            return res.status(409).send({ error: "A rally is already active in this squad" });
        }

        const groupData = groupDoc.data();
        if (callerId !== 'SYSTEM' && !groupData?.members.includes(callerId)) {
            return res.status(403).send({ error: "You are not a member of this group" });
        }

        // 2. Create Call Session
        const callId = `call_${Date.now()}`;
        
        // Members to be notified
        const actualTargets = targetUids && targetUids.length > 0 
            ? targetUids.filter((id: string) => id !== callerId) // Filter out caller from explicit targets
            : groupData.members.filter((id: string) => id !== callerId); // Filter out caller from all members

        const responses: any = {
            [callerId]: 'accepted' // Caller is already in
        };
        actualTargets.forEach((uid: string) => {
            responses[uid] = 'pending';
        });

        await db.collection('call_sessions').doc(callId).set({
            callId,
            groupId,
            callerId,
            groupName,
            purposeType: purposeType || 'Rally',
            reason: reason || '',
            priority: priority || 'casual',
            scheduledAt: scheduledAt || null,
            status: 'ringing',
            responses,
            targetUids: actualTargets,
            members: groupData.members, // Add this for global history query
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timeoutAt: Date.now() + 600000 // 10 minutes auto-timeout (optional check)
        });

        // 3. Get FCM Tokens of targeted members (Handling 10-item limit of Firestore 'in' query)
        const fetchTokens = async (uids: string[]) => {
            if (!uids || uids.length === 0) return { tokens: [], userDocs: [] };
            const chunks = [];
            for (let i = 0; i < uids.length; i += 10) {
                chunks.push(uids.slice(i, i + 10));
            }

            const results = await Promise.all(
                chunks.map(chunk => db.collection('users').where('uid', 'in', chunk).get())
            );

            const tokens: string[] = [];
            const userDocs: admin.firestore.QueryDocumentSnapshot[] = [];

            results.forEach(snap => {
                snap.forEach(doc => {
                    userDocs.push(doc);
                    const data = doc.data();
                    if (data.fcmToken) {
                        tokens.push(data.fcmToken);
                    }
                });
            });
            return { tokens, userDocs };
        };

        const { tokens, userDocs } = await fetchTokens(actualTargets);

        if (tokens.length === 0) {
            console.log(`[trigger-call] No valid FCM tokens found for targets in group ${groupId}`);
            return res.status(200).send({ message: "No other members to call", callId });
        }

        // 4. Identify Caller
        let callerName = "Someone";
        let callerDocSnapshot = userDocs.find(d => d.id === callerId);

        if (!callerDocSnapshot) {
            const directDocLookup = await db.collection('users').doc(callerId).get();
            if (directDocLookup.exists) callerDocSnapshot = directDocLookup as any;
        }
        if (callerDocSnapshot) {
            callerName = (callerDocSnapshot.data() as any).name || "Someone";
        }

        const isUrgent = priority === 'urgent';

        const message = {
            data: {
                type: 'INCOMING_CALL',
                callId,
                groupId,
                groupName,
                callerName,
                purposeType: purposeType || 'Rally',
                reason: reason || '',
                priority: priority || 'casual',
                color: isUrgent ? '#ef4444' : '#7C3AED',
                colorized: 'true', // FCM data values must be strings
                looping: 'true', // FCM data values must be strings
            },
            tokens: tokens,
            android: {
                priority: 'high' as const,
                ttl: 0,
            }
        };

        const response = await fcm.sendEachForMulticast(message);
        console.log(`[trigger-call] Sent to ${response.successCount}/${tokens.length} members by ${callerName}`);

        res.status(200).send({
            callId,
            successCount: response.successCount,
            failureCount: response.failureCount,
            tokensTargeted: tokens.length
        });
    } catch (error: any) {
        console.error("Error triggering call:", error);
        res.status(500).send({ error: error.message });
    }
});

/**
 * Stop Call (Manual endpoint)
 */
app.post('/stop-call', async (req, res) => {
    const { callId } = req.body;
    try {
        const doc = await db.collection('call_sessions').doc(callId).get();
        if (doc.exists) {
            const data = doc.data();
            await db.collection('call_sessions').doc(callId).update({ status: 'ended' });

            // Broadcast CANCEL signal to all targets
            const targetUids = data?.targetUids || [];
            if (targetUids.length > 0) {
                const chunks = [];
                for (let i = 0; i < targetUids.length; i += 10) {
                    chunks.push(targetUids.slice(i, i + 10));
                }
                const tokenChunks = await Promise.all(
                    chunks.map(chunk => db.collection('users').where('uid', 'in', chunk).get())
                );
                const tokens: string[] = [];
                tokenChunks.forEach(snap => snap.forEach(d => { if (d.data().fcmToken) tokens.push(d.data().fcmToken) }));

                if (tokens.length > 0) {
                    await fcm.sendEachForMulticast({
                        data: { type: 'CANCEL_CALL', callId },
                        tokens,
                        android: { priority: 'high' }
                    });
                }
            }
        }
        res.status(200).send({ success: true });
    } catch (error) {
        console.error("Stop call error:", error);
        res.status(500).send({ error: "Failed to stop call" });
    }
});

/**
 * AI Tester (Manual endpoint for isolated testing)
 */
app.post('/test-call', async (req, res) => {
    try {
        const { targetUid, priority = 'casual' } = req.body;
        const isUrgent = priority === 'urgent';

        const targetDoc = await db.collection('users').doc(targetUid).get();
        if (!targetDoc.exists) return res.status(404).send({ error: "User not found" });

        const fcmToken = targetDoc.data()?.fcmToken;
        if (!fcmToken) return res.status(400).send({ error: "User has no FCM token" });

        const callId = `test_call_${Date.now()}`;

        // Setup Call Session so the frontend screen correctly mounts
        await db.collection('call_sessions').doc(callId).set({
            callId,
            groupId: 'test_group',
            callerId: 'system_test',
            groupName: 'Rally Testing Room',
            priority: priority,
            reason: 'Testing the ringing functionality!',
            status: 'ringing',
            responses: {
                [targetUid]: 'pending',
                system_test: 'accepted'
            },
            targetUids: [targetUid],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timeoutAt: Date.now() + 600000
        });

        const message = {
            data: {
                type: 'INCOMING_CALL',
                callId,
                groupId: 'test_group',
                groupName: 'Rally Testing Room',
                callerName: 'Auto AI Tester',
                purposeType: 'Rally',
                reason: 'Testing the ringing functionality!',
                priority: priority,
            },
            token: fcmToken,
            android: {
                priority: 'high' as const,
                ttl: 0,
            }
        };

        const response = await fcm.send(message);
        res.status(200).send({ success: true, callId, response });
    } catch (error: any) {
        console.error("Test call error:", error);
        res.status(500).send({ error: error.message });
    }
});

app.post('/update-token', async (req, res) => {
    try {
        const { uid, fcmToken } = req.body;
        if (!uid || !fcmToken) return res.status(400).send({ error: "Missing uid or fcmToken" });
        await db.collection('users').doc(uid).update({ fcmToken });
        res.status(200).send({ success: true });
    } catch (error: any) {
        res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`RallyRing Backend running on port ${PORT}`);
});

export default app;

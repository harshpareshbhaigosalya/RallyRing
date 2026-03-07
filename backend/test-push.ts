import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const uid = 'QQ5XHWSZ';

async function sendDummyPush() {
    try {
        const serviceAccountPath = path.join(__dirname, 'service-account.json');
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        const db = admin.firestore();
        const fcm = admin.messaging();

        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            console.error(`User ${uid} not found!`);
            process.exit(1);
        }

        const fcmToken = userDoc.data()?.fcmToken;
        if (!fcmToken) {
            console.error(`User ${uid} has no FCM token!`);
            process.exit(1);
        }

        console.log(`Sending dummy call to ${uid} (Token: ${fcmToken.substring(0, 10)}...)`);

        const callId = `dummy_call_${Date.now()}`;
        const message = {
            data: {
                type: 'INCOMING_CALL',
                callId,
                groupId: 'dummy_group_123',
                groupName: 'Test Squad',
                callerName: 'Auto Tester',
                purposeType: 'Rally',
                reason: 'Testing the ringing functionality!',
            },
            token: fcmToken,
            android: {
                priority: 'high' as const,
                ttl: 0,
            }
        };

        const response = await fcm.send(message);
        console.log(`Successfully sent message:`, response);

        // Let's also create a dummy call session so that the frontend listener doesn't immediately close it
        await db.collection('call_sessions').doc(callId).set({
            callId,
            groupId: 'dummy_group_123',
            callerId: 'system_test',
            groupName: 'Test Squad',
            purposeType: 'Rally',
            reason: 'Testing the ringing functionality!',
            status: 'ringing',
            responses: {
                [uid]: 'pending',
                system_test: 'accepted'
            },
            targetUids: [uid],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timeoutAt: Date.now() + 600000
        });
        console.log(`Dummy call session created: ${callId}`);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

sendDummyPush();

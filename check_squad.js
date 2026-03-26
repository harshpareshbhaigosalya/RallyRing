const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize with service account
const serviceAccountPath = path.join(__dirname, 'backend/service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listSquadMembers(groupId) {
    console.log(`🔍 Checking Squad: ${groupId}...`);
    try {
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) {
            console.log('❌ Squad not found');
            return;
        }
        const data = groupDoc.data();
        console.log(`✅ Squad Name: ${data.name}`);
        console.log(`👥 Members: ${data.members.join(', ')}`);
        
        // Find names for these UIDs
        const userSnaps = await Promise.all(
            data.members.map(uid => db.collection('users').doc(uid).get())
        );
        
        console.log('\n--- Member Details ---');
        userSnaps.forEach(snap => {
            if (snap.exists) {
                const u = snap.data();
                console.log(`- ${u.name} (UID: ${u.uid})`);
            }
        });
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

const targetGroupId = process.argv[2] || 'CYQ9PK';
listSquadMembers(targetGroupId);

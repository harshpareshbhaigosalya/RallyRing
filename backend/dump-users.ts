import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function listUsers() {
    try {
        const serviceAccountPath = path.join(__dirname, 'service-account.json');
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();

        usersSnapshot.forEach(doc => {
            console.log(doc.id, doc.data().name);
        });

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

listUsers();

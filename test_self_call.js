const axios = require('axios');

// SELF-TEST: This will ring YOUR OWN phone from the laptop!
const API_URL = 'https://rally-ring.vercel.app';
const YOUR_UID = 'XMH6OYXC'; // Harsh's real User ID

async function triggerSelfTest(priority = 'urgent') {
    console.log(`📡 Sending a DIRECT ${priority.toUpperCase()} TEST RALLY to your phone (${YOUR_UID})...`);
    try {
        const response = await axios.post(`${API_URL}/test-call`, {
            targetUid: YOUR_UID,
            priority: priority
        });
        console.log('✅ Success!', response.data);
        console.log('📱 CHECK YOUR PHONE NOW! It should be ringing!');
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
}

triggerSelfTest();

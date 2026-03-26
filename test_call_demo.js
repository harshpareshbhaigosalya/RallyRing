const axios = require('axios');

// CONFIG: Replace with your details for testing
const API_URL = 'https://rally-ring.vercel.app';
const GROUP_ID = 'DE1FT1'; // Enter a group ID you joined
const CALLER_ID = '8G0PCHX0'; // Harsh's real User ID in the squad
const GROUP_NAME = 'Temp';
const CALLER_NAME = 'Laptop System';

async function triggerTestCall(priority = 'casual') {
    console.log(`🚀 Sending ${priority.toUpperCase()} rally to group ${GROUP_ID}...`);
    try {
        const response = await axios.post(`${API_URL}/trigger-call`, {
            groupId: GROUP_ID,
            callerId: CALLER_ID,
            groupName: GROUP_NAME,
            callerName: CALLER_NAME,
            purposeType: 'Rally',
            reason: 'This is a demo call from the laptop! 🚀',
            priority: priority, // 'casual', 'priority', or 'urgent'
        });
        console.log('✅ Success!', response.data);
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
}

// Run it!
triggerTestCall('urgent');

const admin = require('../config/firebaseConfig').admin;

module.exports = {

    sendMessage: async (message) => {
        const token = message && message.token;
        if (!token) {
            console.error('[Push] No token in message:', message);
            return;
        }
        const tokenPreview = token.length > 12 ? token.slice(-12) : '***';
        console.log('[Push] Sending to token ...' + tokenPreview);
        try {
            const response = await admin.messaging().send(message);
            console.log('[Push] Success:', response);
        } catch (error) {
            console.error('[Push] Error sending message:', error.code || error.message, error);
        }
    }

};
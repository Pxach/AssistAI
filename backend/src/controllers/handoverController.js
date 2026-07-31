import db from '../database/db.js';

// Get all active handover requests (For Dashboard alerts)
export const getHandoverRequests = async (req, res) => {
    try {
        const pending = await db('ChatSession')
            .where('Handover', true)
            .where('Status', 'PENDING')
            .select('*');
        res.status(200).json({ success: true, count: pending.length, data: pending });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch handover requests', error: error.message });
    }
};

// Flag a chat session for human intervention (Triggered by AI or Customer)
export const requestHandover = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required.' });
        }

        const newSession = {
            PhoneNumber: phoneNumber,
            Active: true,
            Handover: true,
            Status: 'PENDING',
            Sentiment: 'neutral',
            CreatedAt: new Date().toISOString()
        };

        // Insert or update
        await db('ChatSession')
            .insert(newSession)
            .onConflict('PhoneNumber')
            .merge({
                Handover: true,
                Status: 'PENDING'
            });

        res.status(200).json({
            success: true,
            message: 'Human intervention requested and manager notified',
            data: newSession
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to request handover', error: error.message });
    }
};

// Manager action: ACCEPT or DECLINE
export const respondToHandover = async (req, res) => {
    try {
        const { phoneNumber, action } = req.body; // Action MUST be 'ACCEPT' or 'DECLINE'

        if (!phoneNumber || !['ACCEPT', 'DECLINE'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone number and valid action (ACCEPT or DECLINE) are required.' 
            });
        }

        const session = await db('ChatSession').where('PhoneNumber', phoneNumber).first();

        if (!session) {
            return res.status(404).json({ success: false, message: 'Chat session not found.' });
        }

        const status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
        
        await db('ChatSession')
            .where('PhoneNumber', phoneNumber)
            .update({ Status: status });

        // Business Logic Rule:
        // If ACCEPTED -> 3-minute notice message sent to client
        // If DECLINED -> Email contact notice sent to client
        const clientNotice = action === 'ACCEPT'
            ? 'A human representative will join your chat within 3 minutes.'
            : 'Our managers are currently occupied. Please reach out to us via email at contact@company.com.';

        res.status(200).json({
            success: true,
            actionTaken: action,
            clientNotice: clientNotice,
            data: { ...session, Status: status }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to respond to handover', error: error.message });
    }
};
// Mock Data Store for Chat Sessions needing human assistance
let mockHandoverSessions = [
    {
        PhoneNumber: '+212688162825',
        Active: true,
        Handover: true,
        Status: 'PENDING', // PENDING, ACCEPTED, DECLINED
        Sentiment: 'negative',
        CreatedAt: new Date().toISOString()
    }
];

// Get all active handover requests (For Dashboard alerts)
export const getHandoverRequests = async (req, res) => {
    try {
        const pending = mockHandoverSessions.filter(s => s.Handover === true && s.Status === 'PENDING');
        res.status(200).json({ success: true, count: pending.length, data: pending });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch handover requests', error: error.message });
    }
};

// Flag a chat session for human intervention (Triggered by AI or Customer)
export const requestHandover = async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    let session = mockHandoverSessions.find(s => s.PhoneNumber === phoneNumber);

    if (session) {
        session.Handover = true;
        session.Status = 'PENDING';
    } else {
        session = {
            PhoneNumber: phoneNumber,
            Active: true,
            Handover: true,
            Status: 'PENDING',
            Sentiment: 'neutral',
            CreatedAt: new Date().toISOString()
        };
        mockHandoverSessions.push(session);
    }

    res.status(200).json({
        success: true,
        message: 'Human intervention requested and manager notified',
        data: session
    });
};

// Manager action: ACCEPT or DECLINE
export const respondToHandover = async (req, res) => {
    const { phoneNumber, action } = req.body; // Action MUST be 'ACCEPT' or 'DECLINE'

    if (!phoneNumber || !['ACCEPT', 'DECLINE'].includes(action)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Phone number and valid action (ACCEPT or DECLINE) are required.' 
        });
    }

    const session = mockHandoverSessions.find(s => s.PhoneNumber === phoneNumber);

    if (!session) {
        return res.status(404).json({ success: false, message: 'Chat session not found.' });
    }

    session.Status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';

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
        data: session
    });
};
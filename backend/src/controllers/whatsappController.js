import db from '../database/db.js';

// Get Current Connection Status
// Get Current Connection Status
export const getStatus = async (req, res) => {
  try {
    const { sessionKey = 'default' } = req.query;
    const session = await db('whatsapp_sessions').where('session_key', sessionKey).first();

    if (!session) {
      return res.json({ success: true, data: { status: 'DISCONNECTED', phoneNumber: null } });
    }

    // Dev Fallback: If stuck in PAIRING without a QR, supply a mock QR
    let qrCode = session.qr_code;
    if (session.status === 'PAIRING' && !qrCode) {
      qrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=AssistAI_Mock_WhatsApp_Pairing_Token';
    }

    return res.json({
      success: true,
      data: {
        status: session.status,
        phoneNumber: session.phone_number,
        qrCode: qrCode,
        connectedAt: session.connected_at
      }
    });
  } catch (err) {
    console.error('Error fetching WhatsApp status:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Trigger Connection / Pairing Initialization
export const connectWhatsApp = async (req, res) => {
  try {
    const { sessionKey = 'default' } = req.body;
    const mockQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=AssistAI_Mock_WhatsApp_Pairing_Token';

    // 1. Check if row exists, insert if missing, update if present
    const session = await db('whatsapp_sessions').where('session_key', sessionKey).first();

    if (session) {
      await db('whatsapp_sessions')
        .where('session_key', sessionKey)
        .update({
          status: 'PAIRING',
          qr_code: mockQrCode,
          updated_at: new Date()
        });
    } else {
      await db('whatsapp_sessions').insert({
        session_key: sessionKey,
        status: 'PAIRING',
        qr_code: mockQrCode,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // 2. Emit socket event to update connected UI clients instantly
    const io = req.app.get('io');
    io.to(sessionKey).emit('whatsapp:qr', { qrCode: mockQrCode });

    return res.json({ success: true, message: 'Pairing process initiated.' });
  } catch (err) {
    console.error('Error initiating connection:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Trigger Connection / Pairing Initialization
// export const connectWhatsApp = async (req, res) => {
//   try {
//     const { sessionKey = 'default' } = req.body;

//     // Update status in DB to PAIRING
//     await db('whatsapp_sessions')
//       .where('session_key', sessionKey)
//       .update({ status: 'PAIRING', updated_at: new Date() });

//     // Emit event to notify Baileys engine (teammate's worker) to start pairing
//     const io = req.app.get('io');
//     io.to(sessionKey).emit('whatsapp:start_pairing', { sessionKey });

//     return res.json({ success: true, message: 'Pairing process initiated.' });
//   } catch (err) {
//     console.error('Error initiating connection:', err);
//     return res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// };
// Trigger Connection / Pairing Initialization (With Mock Data for Dev)

// Disconnect / Log Out WhatsApp Session
export const disconnectWhatsApp = async (req, res) => {
  try {
    const { sessionKey = 'default' } = req.body;

    await db('whatsapp_sessions')
      .where('session_key', sessionKey)
      .update({
        status: 'DISCONNECTED',
        phone_number: null,
        qr_code: null,
        connected_at: null,
        updated_at: new Date()
      });

    // Notify Baileys engine & frontend
    const io = req.app.get('io');
    io.to(sessionKey).emit('whatsapp:status_change', { status: 'DISCONNECTED' });

    return res.json({ success: true, message: 'WhatsApp session disconnected.' });
  } catch (err) {
    console.error('Error disconnecting WhatsApp:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
// Get all active chat sessions with customer details
export const getActiveSessions = async (req, res) => {
  try {
    const sessions = await db('ChatSession')
      .leftJoin('Customer', 'ChatSession.PhoneNumber', 'Customer.PhoneNumber')
      .select(
        'ChatSession.PhoneNumber',
        'ChatSession.Active',
        'ChatSession.Handover',
        'ChatSession.Sentiment',
        'ChatSession.CreatedAt',
        'Customer.Name as CustomerName'
      )
      .orderBy('ChatSession.CreatedAt', 'desc');

    return res.json({ success: true, data: sessions });
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get chat logs/messages for a specific phone number
export const getChatLogs = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const messages = await db('ChatLogs')
      .where('PhoneNumber', phoneNumber)
      .orderBy('CreatedAt', 'asc');

    return res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Error fetching chat logs:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Resume AI Bot control for a chat
export const toggleHandover = async (req, res) => {
  try {
    const { phoneNumber, handover } = req.body;

    await db('ChatSession')
      .where('PhoneNumber', phoneNumber)
      .update({ Handover: handover });

    return res.json({ success: true, message: `Handover set to ${handover}` });
  } catch (err) {
    console.error('Error toggling handover:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Send Human Agent Outbound Message
export const sendHumanMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ success: false, error: 'PhoneNumber and message are required.' });
    }

    // 1. Log human message in ChatLogs table
    const [insertedMsg] = await db('ChatLogs')
      .insert({
        PhoneNumber: phoneNumber,
        sender_type: 'human_agent',
        message
      })
      .returning('*');

    // 2. Ensure Handover is enabled on ChatSession so bot stays silent
    await db('ChatSession')
      .where('PhoneNumber', phoneNumber)
      .update({ Handover: true });

    // 3. Emit event to Baileys engine to dispatch outbound WhatsApp message
    const io = req.app.get('io');
    io.emit('whatsapp:send_outbound', {
      toPhoneNumber: phoneNumber,
      messageText: message
    });

    return res.json({ success: true, data: insertedMsg });
  } catch (err) {
    console.error('Error sending human message:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
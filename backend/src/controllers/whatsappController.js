import db from '../database/db.js';

// Helper to clean phone numbers (strips JID suffixes if present)
const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  return phone.split('@')[0].split(':')[0].replace(/[^+\d]/g, '');
};

// 1. Get Current Connection Status
export const getStatus = async (req, res) => {
  try {
    const { sessionKey = 'default' } = req.query;
    const session = await db('whatsapp_sessions').where('session_key', sessionKey).first();

    if (!session) {
      return res.json({ success: true, data: { status: 'DISCONNECTED', phoneNumber: null, qrCode: null, connectedAt: null } });
    }

    return res.json({
      success: true,
      data: {
        status: session.status,
        phoneNumber: session.phone_number,
        qrCode: session.qr_code,
        connectedAt: session.connected_at
      }
    });
  } catch (err) {
    console.error('Error fetching WhatsApp status:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 2. Trigger Connection / Pairing Initialization
export const connectWhatsApp = async (req, res) => {
  try {
    const { sessionKey = 'default' } = req.body;

    const session = await db('whatsapp_sessions').where('session_key', sessionKey).first();

    if (session) {
      await db('whatsapp_sessions')
        .where('session_key', sessionKey)
        .update({
          status: 'PAIRING',
          qr_code: null,
          updated_at: new Date()
        });
    } else {
      await db('whatsapp_sessions').insert({
        session_key: sessionKey,
        status: 'PAIRING',
        qr_code: null,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Emit socket event to update connected UI clients instantly
    const io = req.app.get('io');
    if (io) {
      io.to(sessionKey).emit('whatsapp:status_change', { status: 'PAIRING' });
      io.emit('whatsapp:status_change', { status: 'PAIRING' });
    }

    return res.json({ success: true, message: 'Pairing process initiated.' });
  } catch (err) {
    console.error('Error initiating connection:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 3. Update Connection Status from Engine (HTTP PATCH)
export const updateSessionStatus = async (req, res) => {
  try {
    const { sessionKey = 'default', status, phoneNumber, qrCode, connectedAt } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }

    const session = await db('whatsapp_sessions').where('session_key', sessionKey).first();

    const updateData = {
      status,
      phone_number: phoneNumber !== undefined ? phoneNumber : (session?.phone_number || null),
      qr_code: qrCode !== undefined ? qrCode : (session?.qr_code || null),
      connected_at: connectedAt || (status === 'CONNECTED' ? new Date() : session?.connected_at || null),
      updated_at: new Date()
    };

    if (session) {
      await db('whatsapp_sessions').where('session_key', sessionKey).update(updateData);
    } else {
      await db('whatsapp_sessions').insert({
        session_key: sessionKey,
        ...updateData,
        created_at: new Date()
      });
    }

    // Broadcast WebSocket events to all connected clients
    const io = req.app.get('io');
    if (io) {
      const payload = {
        status,
        phoneNumber: updateData.phone_number,
        qrCode: updateData.qr_code,
        connectedAt: updateData.connected_at
      };

      io.emit('whatsapp:status_change', payload);
      io.to(sessionKey).emit('whatsapp:status_change', payload);

      if (qrCode) {
        io.emit('whatsapp:qr', { qrCode });
        io.to(sessionKey).emit('whatsapp:qr', { qrCode });
      }
    }

    return res.json({ success: true, message: 'Session status updated.' });
  } catch (err) {
    console.error('Error updating session status:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 4. Sync Inbound/Outbound Chat Message from Engine (HTTP POST)
export const syncChatMessage = async (req, res) => {
  try {
    const { phoneNumber: rawPhone, senderType, message, handover = false } = req.body;

    const phoneNumber = cleanPhoneNumber(rawPhone);
    if (!phoneNumber || !message) {
      return res.status(400).json({ success: false, error: 'PhoneNumber and message are required.' });
    }

    // 1. Ensure Customer record exists
    const customer = await db('Customer').where('PhoneNumber', phoneNumber).first();
    if (!customer) {
      await db('Customer').insert({
        PhoneNumber: phoneNumber,
        Name: `Customer (${phoneNumber})`,
        PreferredLanguage: 'French'
      });
    }

    // 2. Ensure ChatSession record exists
    const chatSession = await db('ChatSession').where('PhoneNumber', phoneNumber).first();
    if (!chatSession) {
      await db('ChatSession').insert({
        PhoneNumber: phoneNumber,
        Active: true,
        Handover: handover,
        Status: handover ? 'escalated_to_human' : 'active',
        Sentiment: 'Neutral',
        CreatedAt: new Date()
      });
    } else if (handover !== undefined && chatSession.Handover !== handover) {
      await db('ChatSession')
        .where('PhoneNumber', phoneNumber)
        .update({ Handover: handover });
    }

    // 3. Insert ChatLogs record
    const [insertedLog] = await db('ChatLogs')
      .insert({
        PhoneNumber: phoneNumber,
        sender_type: senderType || 'customer',
        message: message,
        CreatedAt: new Date()
      })
      .returning('*');

    // 4. Emit real-time WebSocket events
    const io = req.app.get('io');
    if (io) {
      io.emit('whatsapp:new_message', insertedLog);
      io.emit('whatsapp:session_updated', { PhoneNumber: phoneNumber, Handover: handover });
    }

    return res.json({ success: true, data: insertedLog });
  } catch (err) {
    console.error('Error syncing chat message:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 5. Sync Handover Status from Engine (HTTP POST)
export const syncHandover = async (req, res) => {
  try {
    const { phoneNumber: rawPhone, handover, reason, lastMessage } = req.body;

    const phoneNumber = cleanPhoneNumber(rawPhone);
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'PhoneNumber is required.' });
    }

    const session = await db('ChatSession').where('PhoneNumber', phoneNumber).first();

    if (session) {
      await db('ChatSession')
        .where('PhoneNumber', phoneNumber)
        .update({
          Handover: handover,
          Status: handover ? 'escalated_to_human' : 'active'
        });
    } else {
      await db('ChatSession').insert({
        PhoneNumber: phoneNumber,
        Active: true,
        Handover: handover,
        Status: handover ? 'escalated_to_human' : 'active',
        Sentiment: 'Neutral',
        CreatedAt: new Date()
      });
    }

    // Broadcast Socket.io handover alert
    const io = req.app.get('io');
    if (io) {
      const alertPayload = {
        event: 'bot:handover_triggered',
        phoneNumber,
        reason: reason || 'Handover state updated by engine.',
        lastMessage: lastMessage || '',
        timestamp: new Date().toISOString()
      };

      io.emit('handover_alert', alertPayload);
      io.emit('bot:handover_triggered', alertPayload);
      io.emit('whatsapp:session_updated', { PhoneNumber: phoneNumber, Handover: handover });
    }

    return res.json({ success: true, message: `Handover updated to ${handover}` });
  } catch (err) {
    console.error('Error syncing handover status:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 6. Disconnect / Log Out WhatsApp Session
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
    if (io) {
      io.to(sessionKey).emit('whatsapp:status_change', { status: 'DISCONNECTED' });
      io.emit('whatsapp:status_change', { status: 'DISCONNECTED' });
    }

    return res.json({ success: true, message: 'WhatsApp session disconnected.' });
  } catch (err) {
    console.error('Error disconnecting WhatsApp:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 7. Get all active chat sessions with customer details
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

// 8. Get chat logs/messages for a specific phone number
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

// 9. Toggle Handover state (Resume AI or Hand over to Human)
export const toggleHandover = async (req, res) => {
  try {
    const { phoneNumber, handover } = req.body;

    await db('ChatSession')
      .where('PhoneNumber', phoneNumber)
      .update({ Handover: handover });

    const io = req.app.get('io');
    if (io) {
      io.emit('whatsapp:session_updated', { PhoneNumber: phoneNumber, Handover: handover });
      if (handover) {
        io.emit('handover_alert', { phoneNumber, reason: 'Human agent manually paused AI bot.', timestamp: new Date().toISOString() });
      }
    }

    return res.json({ success: true, message: `Handover set to ${handover}` });
  } catch (err) {
    console.error('Error toggling handover:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// 10. Send Human Agent Outbound Message
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

    // 3. Emit real-time events to frontend & Baileys engine
    const io = req.app.get('io');
    if (io) {
      io.emit('whatsapp:new_message', insertedMsg);
      io.emit('whatsapp:session_updated', { PhoneNumber: phoneNumber, Handover: true });
      io.emit('whatsapp:send_outbound', {
        toPhoneNumber: phoneNumber,
        messageText: message
      });
    }

    return res.json({ success: true, data: insertedMsg });
  } catch (err) {
    console.error('Error sending human message:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
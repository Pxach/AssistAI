// src/services/whatsappGateway.js

import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const ADMIN_JID = '212663095839@s.whatsapp.net'; // TODO: Update with real manager JID

// Import your brain!
import { processUserMessage } from '../controllers/chatController.js';

const userSessions = {};

export async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📲 Scan this QR code with your WhatsApp to link the bot:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed. Reconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot Connected & Ready!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (event) => {
        if (event.type !== 'notify') return; 
        
        const msg = event.messages[0];
        if (!msg.message) return; 

        // Check remoteJidAlt first, then participant, then remoteJid
        const senderJid = msg.key.remoteJidAlt || msg.key.participant || msg.key.remoteJid;
        
        // 📞 Extract clean phone number (e.g. "212766014551") from JID for booking context
        const senderPhone = senderJid ? senderJid.split('@')[0] : '';

        // 🤖 Extract the bot's own phone number dynamically from Baileys
        const rawBotId = sock.user?.id || '';
        const botPhone = rawBotId ? rawBotId.split(':')[0].split('@')[0] : '';
        
        
        console.log(`🔍 Received message from JID: "${senderJid}" | fromMe: ${msg.key.fromMe}`);

        // Initialize session if it doesn't exist (Now includes bookingState)
        if (!userSessions[senderJid]) {
            userSessions[senderJid] = { clientLanguage: 'fr', handover: false, history: [], bookingState: {} }; 
        }

        const session = userSessions[senderJid];

        // Move text message extraction here
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Universal Message Logging
        if (msg.key.fromMe) {
            session.history.push({ role: 'model', parts: [{ text: textMessage }] });
            console.log("📝 Saved bot response to history.");
            return; // Don't process AI replies for the agent's messages
        } else {
            session.history.push({ role: 'user', parts: [{ text: textMessage }] });
            console.log("📝 Saved user message to history.");
        }

        if (session.handover) return;

        // 🚨 WHITELIST CHECK
        const allowedTestNumber = '212766014551@s.whatsapp.net'; 
        
        if (senderJid !== allowedTestNumber) {
            console.log(`⚠️ Ignored: JID "${senderJid}" does not match whitelist "${allowedTestNumber}"`);
            return; 
        }

        const currentLang = session.clientLanguage;
        
        console.log(`\n📩 New test message from ${senderJid}: ${textMessage}`);

        // AI Processing (Pass session.history, session.bookingState, senderPhone, AND botPhone)
        const aiResult = await processUserMessage(textMessage, currentLang, session.history, session.bookingState, senderPhone, botPhone);

        // 🔒 Server-Side State Merge: Lock in newly extracted booking data
        if (aiResult.data && aiResult.data.newContext && aiResult.data.newContext.bookingState) {
            session.bookingState = aiResult.data.newContext.bookingState;
            console.log("🔒 Current Locked Booking State:", session.bookingState);
        }

        console.log(`🧠 AI Intent Detected: ${aiResult.metadata.intent}`);
        console.log(`🤖 AI Reply: ${aiResult.data.reply}`);

        // Update session language if detected
        if (aiResult.metadata && aiResult.metadata.detectedLanguage) {
            session.clientLanguage = aiResult.metadata.detectedLanguage;
            console.log(`🌐 Updated language for ${senderJid} to ${aiResult.metadata.detectedLanguage}`);
        }

        // Handle Handover
        if (aiResult.data.needsHandover) {
            session.handover = true;
        }

        await sock.sendMessage(senderJid, { text: aiResult.data.reply });

        if (aiResult.data.needsHandover) {
            const phoneNumber = senderJid.split('@')[0];
            const alertMsg = `🚨 *Human Intervention Required* 🚨

👤 *User:* +${phoneNumber}
🌐 *Language:* ${session.clientLanguage}
📝 *Reason:* ${aiResult.metadata.handoverReason || "Requested human assistance."}

⚠️ *Action Required:* Log into the Expleo Company WhatsApp and search for the user's number above to take over the chat.`;

            await sock.sendMessage(ADMIN_JID, { text: alertMsg });
        }
    });
}
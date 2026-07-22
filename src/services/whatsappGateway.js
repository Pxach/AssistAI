// src/services/whatsappGateway.js

import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

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

    // ... (the connection.update and creds.update stuff above)

    sock.ev.on('messages.upsert', async (event) => {
        if (event.type !== 'notify') return; 
        
        const msg = event.messages[0];
        if (!msg.message) return; 

        const senderJid = msg.key.remoteJid;
        
        // 🔍 DEBUG LOG: See what Baileys actually detects
        console.log(`🔍 Received message from JID: "${senderJid}" | fromMe: ${msg.key.fromMe}`);

        if (msg.key.fromMe) {
            console.log("⚠️ Ignored: Message was sent by the bot account itself.");
            return;
        }

        // 🚨 WHITELIST CHECK
        const allowedTestNumber = '11991582249020@lid'; 
        
        if (senderJid !== allowedTestNumber) {
            console.log(`⚠️ Ignored: JID "${senderJid}" does not match whitelist "${allowedTestNumber}"`);
            return; 
        }

        // Initialize session if it doesn't exist
        if (!userSessions[senderJid]) {
            userSessions[senderJid] = { clientLanguage: 'fr' }; 
        }

        const currentLang = userSessions[senderJid].clientLanguage;
        
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;
        console.log(`\n📩 New test message from ${senderJid}: ${textMessage}`);

        // AI Processing
        const aiResult = await processUserMessage(textMessage, currentLang, {});

        console.log(`🧠 AI Intent Detected: ${aiResult.metadata.intent}`);
        console.log(`🤖 AI Reply: ${aiResult.data.reply}`);

        // Update session language if detected
        if (aiResult.metadata && aiResult.metadata.detectedLanguage) {
            userSessions[senderJid].clientLanguage = aiResult.metadata.detectedLanguage;
            console.log(`🌐 Updated language for ${senderJid} to ${aiResult.metadata.detectedLanguage}`);
        }

        await sock.sendMessage(senderJid, { text: aiResult.data.reply });
    });
} // <--- This is the final bracket closing connectToWhatsApp()
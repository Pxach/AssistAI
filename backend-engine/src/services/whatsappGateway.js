// src/services/whatsappGateway.js

import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';

import { processUserMessage } from '../controllers/chatController.js';
import { handleFeedback } from '../handlers/feedbackHandler.js';
import { patchSessionStatus } from './sessionSyncService.js';

const ADMIN_JID = '212663095839@s.whatsapp.net'; // TODO: Update with real manager JID
const INACTIVITY_LIMIT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
// Number of consecutive failures (unknown intent OR repeated identical reply) before
// the anti-loop mechanism breaks the cycle and escalates to a human agent.
const FAIL_THRESHOLD = 3;

const userSessions = {};

// 💾 DATABASE MOCK LOGGER FUNCTIONS (Future-Proofed for PostgreSQL migration)
export async function logToChatLogsTable({ clientJid, message, sender, status, timestamp }) {
    console.log(`💾 [DB INSERT - ChatLogs]`, {
        client_jid: clientJid,
        message_text: message,
        sender_type: sender,
        status: status,
        created_at: timestamp || new Date().toISOString()
    });
    // Real implementation:
    // await db.query(
    //     'INSERT INTO "ChatLogs" (client_jid, message_text, sender_type, status, created_at) VALUES ($1, $2, $3, $4, $5)', 
    //     [clientJid, message, sender, status, timestamp || new Date().toISOString()]
    // );
}

export async function updateChatSessionInDb(clientJid, fields) {
    console.log(`💾 [DB UPDATE - ChatSession] User: ${clientJid}`, fields);
    // Real implementation:
    // await db.query(
    //     'UPDATE "ChatSession" SET handover = $1, active = $2, status = $3, metadata = $4 WHERE client_jid = $5', 
    //     [fields.handover, fields.active, fields.status, JSON.stringify(fields.metadata), clientJid]
    // );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION FLAG SETTER
// Exported so external services (e.g. the feedback cron) can arm the
// waitingForFeedback flag on a session without importing the raw object.
// Creates a minimal stub session if the user hasn't messaged yet.
// ─────────────────────────────────────────────────────────────────────────────
export function armFeedbackFlag(clientJid, language = 'fr') {
    if (!userSessions[clientJid]) {
        userSessions[clientJid] = {
            clientLanguage: language,
            handover: false,
            history: [],
            bookingState: {},
            lastActive: Date.now(),
            consecutiveFails: 0,
            lastBotReply: null,
            waitingForFeedback: false
        };
    }
    userSessions[clientJid].waitingForFeedback = true;
    userSessions[clientJid].clientLanguage = language;
    console.log(`⭐ Feedback flag armed for ${clientJid} (lang: ${language}).`);
}

// 🧹 GARBAGE COLLECTOR: Prune abandoned sessions every 30 minutes.
// The on-message reset only fires when a user returns. This interval
// cleans up sessions from users who never message again.
setInterval(() => {
    const now = Date.now();
    let pruned = 0;
    for (const jid in userSessions) {
        if (now - userSessions[jid].lastActive > INACTIVITY_LIMIT) {
            delete userSessions[jid];
            pruned++;
        }
    }
    if (pruned > 0) {
        console.log(`🧹 GC: Pruned ${pruned} abandoned session(s).`);
    }
}, 30 * 60 * 1000);

export async function connectToWhatsApp(io, sessionKey) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📲 Scan this QR code with your WhatsApp to link the bot:");
            qrcodeTerminal.generate(qr, { small: true });

            if (io && sessionKey) {
                try {
                    const base64QrImage = await QRCode.toDataURL(qr);
                    io.to(sessionKey).emit('whatsapp:qr', { qrCode: base64QrImage });

                    // ── HTTP PATCH: notify dashboard of PAIRING state ──────────
                    patchSessionStatus({
                        sessionKey,
                        status: 'PAIRING',
                        phoneNumber: null,
                        qrCode: base64QrImage,
                        connectedAt: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('❌ Failed to generate base64 QR code:', err);
                }
            }
        }

        if (connection === 'close') {
            // FIXED [CRIT-2]: Optional chaining was incorrectly applied to the boolean result
            // of `instanceof`. It must wrap the error object itself before checking statusCode.
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log('❌ Connection closed. Reconnecting:', shouldReconnect);

            // ── HTTP PATCH: notify dashboard of DISCONNECTED state ─────────────
            patchSessionStatus({
                sessionKey: sessionKey || 'default',
                status: 'DISCONNECTED',
                phoneNumber: null,
                qrCode: null,
                connectedAt: new Date().toISOString(),
            });

            if (shouldReconnect) {
                connectToWhatsApp(io, sessionKey);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot Connected & Ready!');
            if (io && sessionKey) {
                const rawId = sock.user?.id || '';
                const phoneNumber = rawId ? rawId.split(':')[0].split('@')[0] : '';
                io.to(sessionKey).emit('whatsapp:status_change', { status: 'CONNECTED', phoneNumber: phoneNumber });

                // ── HTTP PATCH: notify dashboard of CONNECTED state ────────────
                patchSessionStatus({
                    sessionKey,
                    status: 'CONNECTED',
                    phoneNumber,
                    qrCode: null,
                    connectedAt: new Date().toISOString(),
                });
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (event) => {
        if (event.type !== 'notify') return;

        const msg = event.messages[0];
        if (!msg.message) return;

        // Correct Baileys fields: `participant` is the sender within a group,
        // `remoteJid` is the DM sender or the group JID.
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // 📞 Extract clean phone number from JID for booking context
        const senderPhone = senderJid ? senderJid.split('@')[0] : '';

        // 🤖 Extract the bot's own phone number dynamically from Baileys
        const rawBotId = sock.user?.id || '';
        const botPhone = rawBotId ? rawBotId.split(':')[0].split('@')[0] : '';

        // 1. INITIALIZE SESSION WITH TIMESTAMP
        if (!userSessions[senderJid]) {
            userSessions[senderJid] = {
                clientLanguage: 'fr',
                handover: false,
                active: true,          // Session state active
                status: 'active',      // Status tracker: 'active' | 'escalated_to_human'
                history: [],
                bookingState: {},
                lastActive: Date.now(),
                consecutiveFails: 0,   // Anti-loop: counts unknown intents or repeated replies
                lastBotReply: null,    // Anti-loop: stores the last message sent to detect loops
                waitingForFeedback: false // Feedback flow: bypasses AI pipeline when true
            };
        }

        const session = userSessions[senderJid];

        // 2. INACTIVITY RESET: Wipe state if user returns after 2+ hours
        if (Date.now() - session.lastActive > INACTIVITY_LIMIT) {
            console.log(`🕒 Session expired (2+ hours). Wiping memory for ${senderJid}`);
            session.history = [];
            session.bookingState = {};
            session.consecutiveFails = 0;
            session.lastBotReply = null;
            session.waitingForFeedback = false;
        }

        // Update the timestamp so the 2-hour timer restarts on this new message
        session.lastActive = Date.now();

        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Universal Message Logging & DB Insertion
        if (msg.key.fromMe) {
            session.history.push({ role: 'model', parts: [{ text: textMessage }] });
            
            // Log outgoing message to ChatLogs database table
            await logToChatLogsTable({
                clientJid: senderJid,
                message: textMessage,
                sender: 'model',
                status: session.handover ? 'escalated_to_human' : 'automated',
                timestamp: new Date().toISOString()
            });

            return; // Don't process AI replies/manager responses as user messages
        } else {
            session.history.push({ role: 'user', parts: [{ text: textMessage }] });
        }

        // 🛡️ EARLY EXIT GUARD FOR ACTIVE HANDOVER
        // Check if the user's current session has handover === true.
        // If true, completely bypass LLM and automated systems, log to ChatLogs, and return.
        if (session.handover) {
            console.log(`🚩 [EARLY-EXIT] Session for ${senderJid} is in active human handover. Bypassing bot processing.`);
            
            // Log user message to ChatLogs database table as an escalated message
            await logToChatLogsTable({
                clientJid: senderJid,
                message: textMessage,
                sender: 'user',
                status: 'escalated_to_human',
                timestamp: new Date().toISOString()
            });

            return; // Return immediately so human managers can reply manually without bot interference
        }

        // 🚨 WHITELIST CHECK
        const allowedTestNumber = '212766014551@s.whatsapp.net';

        if (senderJid !== allowedTestNumber) {
            console.log(`⚠️ Ignored: JID "${senderJid}" does not match whitelist "${allowedTestNumber}"`);
            return;
        }

        // Log incoming user message to ChatLogs table
        await logToChatLogsTable({
            clientJid: senderJid,
            message: textMessage,
            sender: 'user',
            status: session.handover ? 'escalated_to_human' : 'active',
            timestamp: new Date().toISOString()
        });

        const currentLang = session.clientLanguage;

        console.log(`\n📩 New test message from ${senderJid}: ${textMessage}`);

        // 🚀 SPEED OPTIMIZATION: Only send the last 6 messages (3 interactions)
        const recentHistory = session.history.slice(-6);

        // FIXED [CRIT-1 & CRIT-3]: Wrapped all AI processing and send calls in a
        // single try/catch. An unhandled rejection inside an async event handler
        // will crash the Node process — Baileys does not catch these internally.
        try {
            // ─────────────────────────────────────────────────────────────────
            // FEEDBACK INTERCEPT
            // When waitingForFeedback is true the user is in a dedicated rating
            // flow. Bypass the entire AI pipeline and route directly to the
            // feedback handler which is purely synchronous (no LLM call).
            // ─────────────────────────────────────────────────────────────────
            if (session.waitingForFeedback) {
                console.log(`⭐ Routing message to feedback handler for ${senderJid}.`);
                const { reply, isDone, sentiment, linkType } = await handleFeedback(textMessage, currentLang, senderPhone);

                if (isDone) {
                    // Valid rating captured — clear the flag and resume normal ops
                    session.waitingForFeedback = false;
                    session.lastBotReply = null;
                    console.log(`✅ Feedback captured for ${senderJid}. Flag cleared.`);
                } else {
                    // Invalid input — keep the flag active, re-prompt on next turn
                    console.log(`⚠️ Invalid feedback input from ${senderJid}. Re-prompting.`);
                }

                await sock.sendMessage(senderJid, { text: reply });

                if (isDone && linkType && io && sessionKey) {
                    io.to(sessionKey).emit('whatsapp:feedback_initiated', {
                        phoneNumber: senderPhone,
                        sentiment,
                        linkType
                    });
                }

                return; // Short-circuit — skip AI pipeline entirely
            }

            const aiResult = await processUserMessage(
                textMessage, currentLang, recentHistory, session.bookingState, senderPhone, botPhone,
                { io, sessionKey }
            );

            // ── bot:message_flagged — security block ───────────────────────────
            // The sanitizer rejected this message before it reached the AI.
            if (aiResult.status === 'blocked' && io && sessionKey) {
                io.to(sessionKey).emit('bot:message_flagged', {
                    event: 'bot:message_flagged',
                    phoneNumber: senderPhone,
                    flaggedBy: 'bot',
                    messageText: textMessage,
                    flagReason: 'Security filter: prompt injection or malicious input detected.',
                    timestamp: new Date().toISOString(),
                });
            }

            // 3. COMPLETION RESET & SERVER-SIDE MERGE
            if (aiResult.data && aiResult.data.newContext && aiResult.data.newContext.bookingState) {
                session.bookingState = aiResult.data.newContext.bookingState;
                console.log("🔒 Current Locked Booking State:", session.bookingState);
            } else if (aiResult.data && aiResult.data.newContext === null) {
                // 🧹 Goal complete! Wipe memory so the next chat starts fresh.
                console.log(`🧹 Booking complete! Wiping session memory for ${senderJid}`);
                session.history = [];
                session.bookingState = {};
            }

            console.log(`🧠 AI Intent Detected: ${aiResult.metadata.intent}`);
            console.log(`🤖 AI Reply: ${aiResult.data.reply}`);

            // Update session language if detected
            if (aiResult.metadata && aiResult.metadata.detectedLanguage) {
                session.clientLanguage = aiResult.metadata.detectedLanguage;
                console.log(`🌐 Updated language for ${senderJid} to ${aiResult.metadata.detectedLanguage}`);
            }

            // ─────────────────────────────────────────────────────────────────
            // ANTI-LOOP MECHANISM
            // A "failure" is defined as either:
            //   (a) the intent router returned 'unknown', OR
            //   (b) the bot is about to send the exact same message it just sent
            //       (waterfall question repeated because extraction made no progress)
            // After FAIL_THRESHOLD consecutive failures, escalate to a human agent.
            // ─────────────────────────────────────────────────────────────────
            const isUnknownIntent = aiResult.metadata.intent === 'unknown';
            const isRepeatedReply = aiResult.data.reply === session.lastBotReply;

            if (isUnknownIntent || isRepeatedReply) {
                session.consecutiveFails += 1;
                console.log(`⚠️ Anti-loop: consecutive fail #${session.consecutiveFails} for ${senderJid} (unknown=${isUnknownIntent}, repeated=${isRepeatedReply})`);
            } else {
                // Progress made — reset the counter
                session.consecutiveFails = 0;
            }

            if (session.consecutiveFails >= FAIL_THRESHOLD) {
                console.log(`🔴 Anti-loop threshold reached for ${senderJid}. Forcing handover.`);
                session.consecutiveFails = 0;
                session.lastBotReply = null;
                session.handover = true;
                session.active = true;
                session.status = "escalated_to_human";

                const lang = session.clientLanguage;
                const loopBreakMessages = {
                    fr: "Je suis désolé, j'ai du mal à vous comprendre. Je vous transfère maintenant à un agent humain qui pourra mieux vous aider.",
                    en: "I'm sorry, I'm having trouble understanding you. I am now transferring you to a human agent who can assist you better.",
                    ar: "أنا آسف، أجد صعوبة في فهمك. سأحيلك الآن إلى وكيل بشري يمكنه مساعدتك بشكل أفضل.",
                    darija: "Smahliya, ma9dertch nfhemk mzyan. Ghadi ndir lik transfert m3a wa7ed l'agent bach ysawedek bsif."
                };
                const loopBreakReply = loopBreakMessages[lang] || loopBreakMessages['fr'];

                await sock.sendMessage(senderJid, { text: loopBreakReply });

                // Log loop break reply to ChatLogs database table
                await logToChatLogsTable({
                    clientJid: senderJid,
                    message: loopBreakReply,
                    sender: 'model',
                    status: 'escalated_to_human',
                    timestamp: new Date().toISOString()
                });

                const phoneNumber = senderJid.split('@')[0];
                const alertMsg = `🔴 *Anti-Loop Escalation* 🔴\n\n👤 *User:* +${phoneNumber}\n🌐 *Language:* ${lang}\n📝 *Reason:* Bot stuck in a loop (${FAIL_THRESHOLD} consecutive identical or unrecognized responses).\n\n⚠️ *Action Required:* Take over this conversation manually.`;
                await sock.sendMessage(ADMIN_JID, { text: alertMsg });

                // ── Socket.io: bot:handover_triggered (anti-loop path) ─────────
                if (io && sessionKey) {
                    io.to(sessionKey).emit('bot:handover_triggered', {
                        event: 'bot:handover_triggered',
                        phoneNumber,
                        reason: `Anti-loop escalation after ${FAIL_THRESHOLD} consecutive failures (unknown intent or repeated reply).`,
                        lastMessage: textMessage,
                        timestamp: new Date().toISOString(),
                    });
                }

                // Update in database (mocked)
                await updateChatSessionInDb(senderJid, {
                    handover: true,
                    active: true,
                    status: "escalated_to_human",
                    metadata: {
                        status: "escalated_to_human",
                        reason: `Anti-loop escalation after ${FAIL_THRESHOLD} consecutive failures`,
                        timestamp: new Date().toISOString()
                    }
                });

                return; // Short-circuit — no further processing this turn
            }

            // ── bot:message_flagged — unknown intent with repeated failures ────
            if (isUnknownIntent && session.consecutiveFails > 0 && io && sessionKey) {
                io.to(sessionKey).emit('bot:message_flagged', {
                    event: 'bot:message_flagged',
                    phoneNumber: senderPhone,
                    flaggedBy: 'bot',
                    messageText: textMessage,
                    flagReason: `Unrecognized intent (fail #${session.consecutiveFails}/${FAIL_THRESHOLD}).`,
                    timestamp: new Date().toISOString(),
                });
            }

            // Handle Handover (from handler)
            if (aiResult.data.needsHandover) {
                session.handover = true;
                session.active = true;
                session.status = "escalated_to_human";
                session.handoverMetadata = aiResult.data.metadata || { status: "escalated_to_human", timestamp: new Date().toISOString() };

                // Update in database (mocked)
                await updateChatSessionInDb(senderJid, {
                    handover: true,
                    active: true,
                    status: "escalated_to_human",
                    metadata: session.handoverMetadata
                });
            }

            // FIXED [CRIT-3]: sendMessage calls are now inside the try/catch
            // 1. Send the normal reply back to the customer
            await sock.sendMessage(senderJid, { text: aiResult.data.reply });

            // Log model reply to ChatLogs database table
            await logToChatLogsTable({
                clientJid: senderJid,
                message: aiResult.data.reply,
                sender: 'model',
                status: session.handover ? 'escalated_to_human' : 'automated',
                timestamp: new Date().toISOString()
            });

            // Track last sent message for anti-loop detection on the next turn
            session.lastBotReply = aiResult.data.reply;

            // 🚨 2. GATEWAY INTERCEPTOR FOR CALENDAR FAILURES
            if (aiResult.data && aiResult.data.adminAlert) {
                console.log("🚨 Calendar sync failed! Routing alert to admin...");
                await sock.sendMessage(ADMIN_JID, { text: aiResult.data.adminAlert });
            }

            // 3. Handle Handover Alert to Admin
            if (aiResult.data.needsHandover) {
                const phoneNumber = senderJid.split('@')[0];
                const alertMsg = `🚨 *Human Intervention Required* 🚨\n\n👤 *User:* +${phoneNumber}\n🌐 *Language:* ${session.clientLanguage}\n📝 *Reason:* ${aiResult.metadata.handoverReason || "Requested human assistance."}\n\n⚠️ *Action Required:* Log into the Expleo Company WhatsApp and search for the user's number above to take over the chat.`;
                await sock.sendMessage(ADMIN_JID, { text: alertMsg });

                // ── Socket.io: bot:handover_triggered (user-requested path) ───
                if (io && sessionKey) {
                    io.to(sessionKey).emit('bot:handover_triggered', {
                        event: 'bot:handover_triggered',
                        phoneNumber,
                        reason: aiResult.metadata.handoverReason || 'User requested human assistance.',
                        lastMessage: textMessage,
                        timestamp: new Date().toISOString(),
                    });
                }
            }

        } catch (error) {
            console.error(`❌ Fatal error processing message from ${senderJid}:`, error);
            // A hard catch-block error also counts as a consecutive fail for anti-loop purposes
            session.consecutiveFails = (session.consecutiveFails || 0) + 1;
            // Attempt to send a graceful fallback to the user so the chat doesn't go silent
            try {
                await sock.sendMessage(senderJid, {
                    text: "Je suis désolé, une erreur s'est produite. Veuillez réessayer dans un instant."
                });
            } catch (sendError) {
                console.error("❌ Could not send fallback message to user:", sendError.message);
            }
        }
    });

    // Return the live socket so callers (e.g. index.js) can pass it
    // to services that need to send proactive messages (reminders, alerts).
    return sock;
}
// src/services/whatsappGateway.js

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';

import { processUserMessage } from '../controllers/chatController.js';
import { handleFeedback } from '../handlers/feedbackHandler.js';
import { patchSessionStatus, syncChatMessage, syncHandover } from './sessionSyncService.js';
import { strings, getLocaleString } from '../locales/strings.js';
import { io as socketClient } from 'socket.io-client';

const ADMIN_JID = '212663095839@s.whatsapp.net'; // TODO: Update with real manager JID
const INACTIVITY_LIMIT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
// Number of consecutive failures (unknown intent OR repeated identical reply) before
// the anti-loop mechanism breaks the cycle and escalates to a human agent.
const FAIL_THRESHOLD = 3;

const userSessions = {};

let dashboardSocket = null;

function initDashboardSocket(sock) {
    if (dashboardSocket) return;
    const socketUrl = process.env.DASHBOARD_API_URL || 'http://localhost:5000';
    dashboardSocket = socketClient(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true
    });

    dashboardSocket.on('connect', () => {
        console.log('🔌 Connected engine to Dashboard Socket.io server:', dashboardSocket.id);
    });

    dashboardSocket.on('whatsapp:send_outbound', async ({ toPhoneNumber, messageText }) => {
        if (sock && toPhoneNumber && messageText) {
            const jid = toPhoneNumber.includes('@') ? toPhoneNumber : `${toPhoneNumber}@s.whatsapp.net`;
            try {
                await sock.sendMessage(jid, { text: messageText });
                console.log(`📤 Outbound human agent message dispatched to ${jid}`);
            } catch (err) {
                console.error(`❌ Error dispatching outbound message to ${jid}:`, err);
            }
        }
    });
}

// 💾 REAL-TIME DATABASE & SOCKET SYNCHRONIZATION HELPERS
export async function logToChatLogsTable({ clientJid, message, sender, status, timestamp }) {
    console.log(`💾 [DB INSERT - ChatLogs]`, {
        client_jid: clientJid,
        message_text: message,
        sender_type: sender,
        status: status,
        created_at: timestamp || new Date().toISOString()
    });

    const phoneNumber = clientJid ? clientJid.split('@')[0].split(':')[0] : '';
    const normalizedSender = sender === 'user' ? 'customer' : (sender === 'model' ? 'bot' : sender);

    await syncChatMessage({
        phoneNumber,
        senderType: normalizedSender,
        message,
        status: status || 'active'
    });
}

export async function updateChatSessionInDb(clientJid, fields) {
    console.log(`💾 [DB UPDATE - ChatSession] User: ${clientJid}`, fields);

    const phoneNumber = clientJid ? clientJid.split('@')[0].split(':')[0] : '';

    await syncHandover({
        phoneNumber,
        handover: fields.handover,
        reason: fields.metadata?.reason || null,
        lastMessage: fields.metadata?.lastMessage || null
    });
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

/**
 * STEP 6 NOTE (ISSUE-06): connectionFailureCount is intentionally module-level,
 * not scoped inside connectToWhatsApp().
 *
 * Rationale: connectToWhatsApp() is called recursively on each reconnect attempt,
 * which creates a new socket and a new closure. If the counter lived inside the
 * function, it would reset to 0 on every reconnect call, making the circuit breaker
 * permanently ineffective — the bot would retry indefinitely.
 *
 * By living at module scope, the counter correctly accumulates across all reconnect
 * attempts within the same process lifetime and is only reset on a successful
 * 'open' event (line ~172).
 *
 * ⚠️  Multi-session caveat: if connectToWhatsApp() is ever called concurrently for
 * multiple independent bot sessions (e.g. a multi-tenant deployment), this counter
 * must be moved into a per-session context object to avoid cross-session interference.
 */
const MAX_RECONNECT_ATTEMPTS = 5;
let connectionFailureCount = 0;

export async function connectToWhatsApp(io, sessionKey) {
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Connecting to WhatsApp Web v${version.join('.')}`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
        try {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log("📲 Scan this QR code with your WhatsApp to link the bot:");
                qrcodeTerminal.generate(qr, { small: true });

                try {
                    const base64QrImage = await QRCode.toDataURL(qr);
                    if (io && sessionKey) {
                        io.to(sessionKey).emit('whatsapp:qr', { qrCode: base64QrImage });
                    }
                    // ── HTTP PATCH: notify dashboard of PAIRING state ──────────
                    patchSessionStatus({
                        sessionKey: sessionKey || 'default',
                        status: 'PAIRING',
                        phoneNumber: null,
                        qrCode: base64QrImage,
                        connectedAt: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('❌ Failed to generate base64 QR code:', err);
                }
            }

            if (connection === 'close') {
                const error = lastDisconnect?.error;
                const statusCode = error?.output?.statusCode || error?.output?.payload?.statusCode;
                const errorMessage = error?.message || error?.output?.payload?.message || (typeof error === 'string' ? error : 'Unknown error');

                console.log(`❌ Connection closed. Reason: ${errorMessage} (Status Code: ${statusCode ?? 'N/A'})`);

                // Do not reconnect on 401 (logged out), 403 (forbidden), or 405 (corrupted/not allowed)
                const nonReconnectableCodes = [401, 403, 405, DisconnectReason.loggedOut].filter(Boolean);
                const isNonReconnectable = statusCode !== undefined && nonReconnectableCodes.includes(statusCode);

                let shouldReconnect = (error instanceof Boom) && !isNonReconnectable;

                // ── Circuit Breaker / Failsafe Check ────────────────────────────────
                if (shouldReconnect) {
                    if (connectionFailureCount >= MAX_RECONNECT_ATTEMPTS) {
                        console.error(`🚨 Fatal: Circuit breaker triggered. Maximum connection retry attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnect loop.`);
                        shouldReconnect = false;
                    } else {
                        connectionFailureCount++;
                        console.log(`🔄 Connection retry attempt ${connectionFailureCount}/${MAX_RECONNECT_ATTEMPTS}...`);
                    }
                }

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
                    // Prevent memory leak: remove old listeners before recreating the socket
                    sock.ev.removeAllListeners();
                    connectToWhatsApp(io, sessionKey);
                }
            } else if (connection === 'open') {
                connectionFailureCount = 0; // Reset circuit breaker on successful connection
                console.log('✅ WhatsApp Bot Connected & Ready!');
                const rawId = sock.user?.id || '';
                const phoneNumber = rawId ? rawId.split(':')[0].split('@')[0] : '';
                if (io && sessionKey) {
                    io.to(sessionKey).emit('whatsapp:status_change', { status: 'CONNECTED', phoneNumber: phoneNumber });
                }

                // ── HTTP PATCH: notify dashboard of CONNECTED state ────────────
                patchSessionStatus({
                    sessionKey: sessionKey || 'default',
                    status: 'CONNECTED',
                    phoneNumber,
                    qrCode: null,
                    connectedAt: new Date().toISOString(),
                });

                initDashboardSocket(sock);
            }
        } catch (error) {
            console.error('❌ Fatal error in connection.update handler:', error);
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
            
            // Log outgoing message to ChatLogs database table.
            // STEP 7 FIX (ISSUE-07): During an active handover, outgoing messages
            // from the bot's own number are typed by the human manager, not generated
            // by the AI. Logging them as 'model' corrupts the audit trail and makes
            // it impossible for the dashboard to distinguish automated from human replies.
            // Use 'human_agent' as sender_type when session.handover is true.
            const outgoingSenderType = session.handover ? 'human_agent' : 'model';
            await logToChatLogsTable({
                clientJid: senderJid,
                message: textMessage,
                sender: outgoingSenderType,
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
        const allowedTestNumbers = [
            '212766014551@s.whatsapp.net',
            '11991582249020@lid'
        ];

        if (!allowedTestNumbers.includes(senderJid)) {
            console.log(`⚠️ Ignored: JID "${senderJid}" does not match whitelist [${allowedTestNumbers.join(', ')}]`);
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

        // 🚀 SPEED OPTIMIZATION: Only send the last 3 messages to prevent TPM rate limits
        const recentHistory = session.history.slice(-3);

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
            //
            // STEP 9 FIX (ISSUE-09): The repeated-reply check is EXEMPTED for the
            // 'booking' intent. The booking confirmation waterfall legitimately repeats
            // the same askConfirmation prompt when the user says "yes" ambiguously and
            // the LLM does not yet commit user_confirmed=true. Counting this as a loop
            // failure would escalate a user who is actively trying to confirm.
            // The booking state machine has its own internal progress mechanism
            // (field population) and does not need the anti-loop as a backstop.
            // ─────────────────────────────────────────────────────────────────
            const currentIntent = aiResult.metadata.intent;
            const isUnknownIntent = currentIntent === 'unknown';
            const isInBookingFlow = currentIntent === 'booking';
            // Only flag repeated replies outside the booking flow.
            const isRepeatedReply = !isInBookingFlow && (aiResult.data.reply === session.lastBotReply);

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
                const loopBreakReply = getLocaleString(strings.antiLoop.escalation, lang);

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
                    text: getLocaleString(strings.common.fatalErrorFallback, session.clientLanguage)
                });
            } catch (sendError) {
                console.error("❌ Could not send fallback message to user:", sendError.message);
            }
        }
    });

    // Return the live socket so callers (e.g. index.js) can pass it
    // to services that need to send proactive messages (reminders, alerts).
    initDashboardSocket(sock);
    return sock;
}
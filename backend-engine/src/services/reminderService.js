import cron from 'node-cron';
import { armFeedbackFlag } from './whatsappGateway.js';
import { checkFeedbackEligibility } from './feedbackEligibility.js';
import { strings, getLocaleString } from '../locales/strings.js';
import { getConfig } from './configService.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA LAYER
// Replace `fetchAppointmentsTomorrow` with a real DB query when the database
// integration is ready. The shape of each appointment object must stay the same
// so the reminder logic below never needs to change.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches confirmed appointments scheduled for tomorrow from the backend database.
 */
async function fetchAppointmentsTomorrow() {
  const baseUrl = (await getConfig('DASHBOARD_API_URL')) || process.env.DASHBOARD_API_URL || 'http://localhost:5000';
  const url = `${baseUrl}/api/appointments/tomorrow`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch tomorrow's appointments: ${response.status}`);
  }
  return await response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA LAYER — FEEDBACK TRIGGER
// Replace with a real DB query that fetches appointments whose end time has
// passed today. The shape of each object must match the reminder shape so
// templates can reuse the same fields.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches confirmed appointments that concluded today from the backend database.
 */
async function fetchAppointmentsEndedToday() {
  const baseUrl = (await getConfig('DASHBOARD_API_URL')) || process.env.DASHBOARD_API_URL || 'http://localhost:5000';
  const url = `${baseUrl}/api/appointments/concluded-today`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch today's concluded appointments: ${response.status}`);
  }
  return await response.json();
}

/**
 * Builds a localized reminder message. Falls back to French if the client's
 * language has no template defined.
 */
function buildReminderMessage(appt) {
  return getLocaleString(strings.reminder.appointmentReminder, appt.language, appt);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE RUNNER — called by the cron job and exported for manual testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches tomorrow's appointments and dispatches a reminder to each client.
 * @param {import('@whiskeysockets/baileys').WASocket} sock — Live Baileys socket
 */
export async function sendDailyReminders(sock) {
  let appointments;
  try {
    appointments = await fetchAppointmentsTomorrow();
  } catch (err) {
    console.error('❌ Reminder service: failed to fetch appointments:', err);
    return;
  }

  if (!appointments || appointments.length === 0) {
    return;
  }
  for (const appt of appointments) {
    try {
      const message = buildReminderMessage(appt);
      await sock.sendMessage(appt.clientJid, { text: message });
    } catch (err) {
      // A single send failure must not abort the rest of the loop
      console.error(`❌ Failed to send reminder to ${appt.clientJid}:`, err.message);
    }
  }
}

/**
 * Arms the feedback flag on each completed appointment's session and sends
 * the localized 3-option rating prompt.
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 */
export async function sendFeedbackRequests(sock) {
  let appointments;
  try {
    appointments = await fetchAppointmentsEndedToday();
  } catch (err) {
    console.error('❌ Feedback service: failed to fetch appointments:', err);
    return;
  }

  if (!appointments || appointments.length === 0) {
    return;
  }
  for (const appt of appointments) {
    try {
      // Check eligibility before sending
      const phoneNumber = appt.clientJid ? appt.clientJid.split('@')[0] : '';
      const isEligible = await checkFeedbackEligibility(phoneNumber);
      if (!isEligible) {
        continue;
      }

      // 1. Arm the session flag BEFORE sending the message.
      //    This ensures the very next reply from this user is intercepted
      //    by the feedback handler, even if they respond immediately.
      armFeedbackFlag(appt.clientJid, appt.language);

      // 2. Send the rating prompt
      const message = getLocaleString(strings.reminder.feedbackPrompt, appt.language, appt);
      await sock.sendMessage(appt.clientJid, { text: message });
    } catch (err) {
      // A single failure must not abort the rest of the loop
      console.error(`❌ Failed to send feedback prompt to ${appt.clientJid}:`, err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULER — called once at server startup from index.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers the daily reminder cron job.
 * Schedule: Every day at 08:00 AM (Africa/Casablanca timezone).
 * @param {import('@whiskeysockets/baileys').WASocket} sock — Live Baileys socket
 */
export function initReminderScheduler(sock) {
  // Cron format: second(opt) minute hour day month weekday
  // '0 8 * * *' → at 08:00:00 every day
  const job = cron.schedule('0 8 * * *', async () => {
    await sendDailyReminders(sock);
  }, {
    timezone: 'Africa/Casablanca'
  });
  return job; // returned so caller can call job.stop() for graceful shutdown
}

/**
 * Registers the post-appointment feedback cron job.
 * Schedule: Every day at 20:00 (Africa/Casablanca timezone).
 * Runs after standard business hours so all same-day appointments have ended.
 * @param {import('@whiskeysockets/baileys').WASocket} sock — Live Baileys socket
 */
export function initFeedbackScheduler(sock) {
  // '0 20 * * *' → at 20:00:00 every day
  const job = cron.schedule('0 20 * * *', async () => {
    await sendFeedbackRequests(sock);
  }, {
    timezone: 'Africa/Casablanca'
  });
  return job; // returned so caller can call job.stop() for graceful shutdown
}

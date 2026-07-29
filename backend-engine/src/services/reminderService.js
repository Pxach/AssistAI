// src/services/reminderService.js
import cron from 'node-cron';
import { armFeedbackFlag } from './whatsappGateway.js';
import { checkFeedbackEligibility } from './feedbackEligibility.js';
import { strings, getLocaleString } from '../locales/strings.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA LAYER
// Replace `fetchAppointmentsTomorrow` with a real DB query when the database
// integration is ready. The shape of each appointment object must stay the same
// so the reminder logic below never needs to change.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock: returns confirmed appointments scheduled for tomorrow.
 * Each appointment must contain:
 *   - clientJid       {string}  — WhatsApp JID (e.g. "212766014551@s.whatsapp.net")
 *   - clientName      {string}  — Customer's name
 *   - service         {string}  — Service booked
 *   - specialist      {string}  — Specialist name
 *   - appointmentTime {string}  — "HH:MM" format
 *   - language        {string}  — "fr" | "en" | "ar" | "darija"
 */
async function fetchAppointmentsTomorrow() {
  // TODO: Replace with real DB query:
  // const tomorrow = getTomorrowDateString();
  // return await db.appointments.findAll({ where: { date: tomorrow, status: 'confirmed' } });

  return [
    {
      clientJid: '212766014551@s.whatsapp.net',
      clientName: 'Zayd',
      service: 'Database Optimization',
      specialist: 'Sarah',
      appointmentTime: '14:00',
      language: 'fr'
    },
    {
      clientJid: '212600000001@s.whatsapp.net',
      clientName: 'Fatima',
      service: 'UI/UX Review',
      specialist: 'Karim',
      appointmentTime: '10:30',
      language: 'darija'
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA LAYER — FEEDBACK TRIGGER
// Replace with a real DB query that fetches appointments whose end time has
// passed today. The shape of each object must match the reminder shape so
// templates can reuse the same fields.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock: returns confirmed appointments that concluded today.
 * Each appointment must contain:
 *   - clientJid       {string}  — WhatsApp JID
 *   - clientName      {string}  — Customer's name
 *   - service         {string}  — Service that was rendered
 *   - appointmentTime {string}  — "HH:MM" the appointment started
 *   - language        {string}  — "fr" | "en" | "ar" | "darija"
 */
async function fetchAppointmentsEndedToday() {
  // TODO: Replace with real DB query:
  // const today = getTodayDateString();
  // return await db.appointments.findAll({
  //   where: { date: today, status: 'confirmed', feedbackSent: false }
  // });

  return [
    {
      clientJid: '212766014551@s.whatsapp.net',
      clientName: 'Zayd',
      service: 'Database Optimization',
      appointmentTime: '14:00',
      language: 'fr'
    }
  ];
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
  console.log('⏰ Reminder service: checking for tomorrow\'s appointments...');

  let appointments;
  try {
    appointments = await fetchAppointmentsTomorrow();
  } catch (err) {
    console.error('❌ Reminder service: failed to fetch appointments:', err);
    return;
  }

  if (!appointments || appointments.length === 0) {
    console.log('✅ Reminder service: no appointments tomorrow. Nothing to send.');
    return;
  }

  console.log(`📋 Reminder service: found ${appointments.length} appointment(s) to remind.`);

  for (const appt of appointments) {
    try {
      const message = buildReminderMessage(appt);
      await sock.sendMessage(appt.clientJid, { text: message });
      console.log(`✅ Reminder sent to ${appt.clientJid} (${appt.clientName}).`);
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
  console.log('⭐ Feedback service: checking for today\'s concluded appointments...');

  let appointments;
  try {
    appointments = await fetchAppointmentsEndedToday();
  } catch (err) {
    console.error('❌ Feedback service: failed to fetch appointments:', err);
    return;
  }

  if (!appointments || appointments.length === 0) {
    console.log('✅ Feedback service: no concluded appointments today. Nothing to send.');
    return;
  }

  console.log(`📋 Feedback service: found ${appointments.length} concluded appointment(s).`);

  for (const appt of appointments) {
    try {
      // Check eligibility before sending
      const phoneNumber = appt.clientJid ? appt.clientJid.split('@')[0] : '';
      const isEligible = await checkFeedbackEligibility(phoneNumber);
      if (!isEligible) {
        console.log(`⚠️ Client ${appt.clientJid} is not eligible for feedback. Skipping.`);
        continue;
      }

      // 1. Arm the session flag BEFORE sending the message.
      //    This ensures the very next reply from this user is intercepted
      //    by the feedback handler, even if they respond immediately.
      armFeedbackFlag(appt.clientJid, appt.language);

      // 2. Send the rating prompt
      const message = getLocaleString(strings.reminder.feedbackPrompt, appt.language, appt);
      await sock.sendMessage(appt.clientJid, { text: message });

      console.log(`✅ Feedback prompt sent to ${appt.clientJid} (${appt.clientName}).`);
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
    console.log('\n📅 [CRON] Daily reminder job triggered.');
    await sendDailyReminders(sock);
  }, {
    timezone: 'Africa/Casablanca'
  });

  console.log('📅 Reminder scheduler initialized. Reminders fire daily at 08:00 AM (Casablanca).');
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
    console.log('\n⭐ [CRON] Daily feedback job triggered.');
    await sendFeedbackRequests(sock);
  }, {
    timezone: 'Africa/Casablanca'
  });

  console.log('⭐ Feedback scheduler initialized. Feedback prompts fire daily at 20:00 (Casablanca).');
  return job; // returned so caller can call job.stop() for graceful shutdown
}

// index.js
import 'dotenv/config';
import { connectToWhatsApp } from './src/services/whatsappGateway.js';
import { initReminderScheduler, initFeedbackScheduler } from './src/services/reminderService.js';

console.log("🚀 Starting Assist AI...");

// Boot the WhatsApp Gateway. connectToWhatsApp() returns the live sock
// instance so downstream services can send proactive messages.
const sock = await connectToWhatsApp();

// 📅 Daily reminder cron — fires every day at 08:00 AM (Casablanca).
// Sends a "your appointment is tomorrow" message to each confirmed client.
initReminderScheduler(sock);

// ⭐ Post-appointment feedback cron — fires every day at 20:00 (Casablanca).
// Identifies appointments that concluded today, arms the waitingForFeedback
// flag on each client's session, and sends the 3-option rating prompt.
initFeedbackScheduler(sock);
// testReminders.js
import { connectToWhatsApp } from './src/services/whatsappGateway.js';
import { sendDailyReminders, sendFeedbackRequests } from './src/services/reminderService.js';
// (Assuming you export your feedback trigger function from reminderService or a feedback service)

async function runTests() {
  console.log("Initializing WhatsApp connection for testing...");
  const sock = await connectToWhatsApp();

  // Wait a few seconds for the socket to stabilize and connect
  setTimeout(async () => {
    console.log("🧪 Triggering 24-Hour Reminder test...");
    await sendDailyReminders(sock);
    console.log("✅ 24-Hour Reminder test executed!");

    // If you want to test the feedback trigger as well:
     console.log("🧪 Triggering Post-Appointment Feedback test...");
     await sendFeedbackRequests(sock);

    process.exit(0);
  }, 5000);
}

runTests();
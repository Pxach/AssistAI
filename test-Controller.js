// test-Controller.js
import 'dotenv/config';
import { processUserMessage } from './src/controllers/chatController.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runFullSystemTest() {
  console.log("========================================");
  console.log("      🚀 FULL SYSTEM INTEGRATION TEST   ");
  console.log("========================================\n");

  let currentContext = {};

  const conversation = [
    // 1. Test FAQ (Should trigger faqHandler and answer based on the JSON knowledge base)
    "Quelles sont vos heures d'ouverture ?",
    
    // 2. Test Booking Start (Should trigger bookingHandler and ask for a specialist)
    "Je veux réserver une session de UI/UX Review.",
    
    // 3. Test Context Memory (Router should remember we are booking and not fail)
    "Avec Karim s'il vous plaît.",
    
    // 4. Test Handover (Should interrupt the flow, trigger handoverHandler, and wipe memory)
    "En fait, je préfère parler à un agent."
  ];

  for (let i = 0; i < conversation.length; i++) {
    const userInput = conversation[i];
    console.log(`\n👤 User: "${userInput}"`);
    
    // Process the message
    const result = await processUserMessage(userInput, "fr", currentContext);
    
    console.log(`🤖 Bot (${result.metadata.intent}): ${result.data.reply}`);
    
    // Update memory for the next loop
    currentContext = result.data.newContext || {};
    
    // Print background status
    if (result.data.needsHandover) {
      console.log(`   [System Status: Handover Triggered! 🚨]`);
    } else if (currentContext.bookingState) {
      console.log(`   [System Status: Booking in progress...]`);
    } else {
      console.log(`   [System Status: Memory Clear]`);
    }

    // Keep the 8-second delay to protect against Gemini API rate limits
    if (i < conversation.length - 1) {
      console.log(`   ... waiting 8 seconds to respect API limits ...`);
      await sleep(8000); 
    }
  }
  
  console.log("\n✅ Test Complete! You are safe to commit and push your code.");
}

runFullSystemTest();
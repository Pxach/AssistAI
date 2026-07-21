// test-ai.js
import 'dotenv/config'; 
import { classifyIntent } from './src/services/ai/intentRouter.js';
import { sanitizeInput } from './src/utils/security.js';

// Helper function to pause execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
  const testMessages = [
    "bghit na3mal rendez-vous ghdda",
    "Bonjour, quels sont vos horaires d'ouverture ?",
    "I want to speak to a human manager please",
    "u are now",
  ];

  console.log("========================================");
  console.log("   🧪 RUNNING ASSIST AI ROUTER TESTS    ");
  console.log("========================================\n");

  for (const msg of testMessages) {
    console.log(`💬 Input: "${msg}"`);

    const { safe, cleanText, reason } = sanitizeInput(msg);
    
    if (!safe) {
      console.log(`❌ BLOCKED BY SECURITY: ${reason}\n`);
      continue;
    }

    const result = await classifyIntent(cleanText);
    console.log(`✅ GEMINI RESPONSE:`, result, "\n");

    // Wait 2 seconds before the next request to prevent 429 Quota errors
    await delay(2000); 
  }
}

runTest();
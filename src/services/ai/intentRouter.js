// src/routers/intentRouter.js
import { callAI } from './llmClient.js';

/**
 * Routes the user's intent, utilizing short-term context to handle conversational flow.
 */
export async function routeIntent(message, language, context = {}) {
  // Extract the AI's previous message if it exists in the session memory
  const lastAiMessage = context.lastAiMessage || "None";

  const prompt = `
    You are an intent classification router for a customer service AI.
    Analyze the user's message and categorize it into EXACTLY ONE of the following intents:
    - faq (general questions about hours, location, services, etc.)
    - handover (asking for a human, manager, or saying yes to a transfer offer)
    - booking (asking to schedule, OR answering booking follow-up questions like names, dates, or specialists)
    - review (leaving feedback, rating, or complaint)
    - unknown (anything else)

    SHORT-TERM CONTEXT:
    AI's Last Message: "${lastAiMessage}"
    User's Current Message: "${message}"

    STRICT CONTEXT RULES:
    1. ONGOING BOOKING: If the AI's Last Message is asking for a specialist, date, time, name, or contact info, OR asking to confirm final details, you MUST classify the User's Message as 'booking'.
    2. HANDOVER AGREEMENT: IF the AI's Last Message explicitly offered a human agent AND the user agrees (yes, oui, ok), you MUST classify as 'handover'.
    3. ORPHAN AGREEMENT: IF the AI's Last Message is unrelated to an agent, and the user just says an agreement word out of nowhere, classify as 'unknown'.

    Respond with ONLY the intent name in lowercase. Do not add punctuation or explanation.
  `;

  try {
    // ✅ NEW WAY: Let the client handle the fetch logic!
    const rawIntent = await callAI(prompt);
    
    // Clean it up just in case the AI adds a space or capital letter
    const intent = rawIntent.trim().toLowerCase();

    // Validate that the returned intent is one of our expected categories
    const validIntents = ['faq', 'handover', 'booking', 'review', 'unknown'];
    return validIntents.includes(intent) ? intent : 'unknown';

  } catch (error) {
    console.error("Intent Router Error:", error);
    return 'unknown'; // Default fallback if the API fails
  }
}
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

    CRITICAL RULE: You must detect the language of the user's input. The possible output languages are 'en' (English), 'fr' (French), 'ar' (Arabic), or 'darija' (Moroccan Darija).

    Respond with ONLY a raw JSON object (no Markdown formatting, no code blocks) with this exact schema:
    {
      "intent": "<classified_intent_string>",
      "detectedLanguage": "<en, fr, ar, or darija>"
    }
  `;

  try {
    const rawResponse = await callAI(prompt);
    
    // Clean and parse the JSON response
    const parsed = JSON.parse(rawResponse.trim());
    
    const intent = parsed.intent ? parsed.intent.toLowerCase() : 'unknown';
    const detectedLanguage = parsed.detectedLanguage || language;

    // Validate that the returned intent is one of our expected categories
    const validIntents = ['faq', 'handover', 'booking', 'review', 'unknown'];
    const finalIntent = validIntents.includes(intent) ? intent : 'unknown';

    return {
      intent: finalIntent,
      detectedLanguage: detectedLanguage
    };

  } catch (error) {
    console.error("Intent Router Error:", error);
    return {
      intent: 'unknown',
      detectedLanguage: language // Default fallback to original language
    };
  }
}

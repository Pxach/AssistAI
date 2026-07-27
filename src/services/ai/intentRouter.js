// src/services/ai/intentRouter.js
import { callAI } from './llmClient.js';

export async function routeIntent(text, language, bookingState, history) {
  const today = new Date().toISOString().split('T')[0];
  
  const lastAiMessage = history.length > 0 && history[history.length - 1].role === 'model' 
    ? history[history.length - 1].parts[0].text 
    : "";

  const prompt = `
    You are an intent classification router for a customer service AI.
    Analyze the user's message and categorize it into EXACTLY ONE of the following intents:
    - faq (general questions, greetings like salam/hello/hi, or questions about hours, location, policies)
    - handover (asking for a human, manager, or saying yes to a transfer offer)
    - booking (asking to schedule, OR answering booking follow-up questions, OR asking what services/specialists are available during a booking)
    - review (leaving feedback, rating, or complaint)
    - unknown (anything else)
    
    Today's Date is: ${today}

    CONVERSATION HISTORY:
    ${history.map(item => `${item.role}: ${item.parts[0].text}`).join("\n")}

    CURRENT BOOKING STATE:
    ${JSON.stringify(bookingState)}

    SHORT-TERM CONTEXT:
    AI's Last Message: "${lastAiMessage}"
    User's Current Message: "${text}"

    STRICT CONTEXT RULES (THE BOOKING LOCK):
    1. ONGOING BOOKING: If the AI's Last Message is asking the user to choose a SERVICE, SPECIALIST, DATE, TIME, NAME, or CONTACT INFO, you MUST classify the User's Message as 'booking'. This applies EVEN IF the user replies with a question (e.g., "what services do you have?" or "who is available?"). Do NOT route to 'faq' if they are mid-booking.
    2. HANDOVER AGREEMENT: IF the AI's Last Message explicitly offered a human agent AND the user agrees (yes, oui, ok), you MUST classify as 'handover'.
    3. ORPHAN AGREEMENT: IF the AI's Last Message is unrelated to an agent, and the user just says an agreement word out of nowhere, classify as 'unknown'.

    CRITICAL RULE: You must detect the language of the user's input. The possible output languages are 'en' (English), 'fr' (French), 'ar' (Arabic), or 'darija' (Moroccan Darija).
    LANGUAGE DETECTION RULE: Do NOT change the detected language based on acronyms (like 'UI/UX'), single words (like 'Yes' or 'Ui'), or short ambiguous phrases. Only update the detected language if the user types a clear, multi-word sentence in a different language. Otherwise, maintain the current conversational language.

    Respond with ONLY a raw JSON object (no Markdown formatting, no code blocks) with this exact schema:
    {
      "intent": "<classified_intent_string>",
      "detectedLanguage": "<en, fr, ar, or darija>",
      "handoverReason": "<brief_summary_or_empty>"
    }

    ADDITIONAL INSTRUCTION:
    If you classify the intent as 'handover', you MUST analyze the previous conversation history to determine the actual root cause of the user's issue. Do NOT just say 'User requested handover'.
  `;

  try {
    const rawAiText = await callAI(prompt, { jsonMode: true });
    const result = JSON.parse(rawAiText);
    return result;
  } catch (error) {
    console.error("Intent Router Error:", error);
    return {
      intent: 'unknown',
      detectedLanguage: language,
      handoverReason: ''
    };
  }
}
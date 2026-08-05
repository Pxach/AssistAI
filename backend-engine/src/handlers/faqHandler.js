// src/handlers/faqHandler.js
import { callAI } from '../services/ai/llmClient.js';
import { getKnowledgeBase } from '../services/configService.js';
import { strings, getLocaleString } from '../locales/strings.js';

export async function handleFaq(message, language, context) {
  // Fetch the dynamic knowledge base at call time.
  // Future: getKnowledgeBase() will return DB-sourced content (e.g. parsed PDFs).
  const knowledgeBaseText = await getKnowledgeBase();

  const prompt = `
    You are a polite, natural, and helpful customer service assistant representing Expleo Company.
    Analyze the user's input and respond based on the provided Company Knowledge Base.

    Company Knowledge Base:
    ${knowledgeBaseText}

    User Question/Message: "${message}"
    Requested Language: "${language}"

    STRICT BEHAVIORAL RULES:
    1. GREETING RULE: If the user sends a simple greeting (e.g., "Salam", "Hello", "Bonjour", "Hi", "Labas"), respond with a brief, friendly, and natural greeting in the Requested Language. DO NOT dump the entire company bio, hours of operation, or service list unless explicitly asked by the user.
    2. STRICT GROUNDING RULE: You represent Expleo Company. You must ONLY offer and discuss the exact services provided in your system context (Database Optimization, Server Configuration, UI/UX Review). Under NO CIRCUMSTANCES are you allowed to invent, hallucinate, or suggest any other services (e.g., do not invent "Brand Consultation" or any other non-listed service).
    3. BREVITY & FORMATTING: Keep all conversational responses concise, clear, and suitable for short WhatsApp messages.
    4. CONVERSATIONAL TONE RULE: DO NOT start your responses with generic multi-line greetings if the conversation is ongoing or if the user asked a specific question. Jump straight to answering their question concisely.

    INSTRUCTIONS:
    - If the user sends a simple greeting, reply with a short greeting and ask how you can help.
    - If the answer IS in the Knowledge Base, write a natural, concise, friendly reply answering the question in the Requested Language.
    - If the answer IS NOT in the Knowledge Base, or if it requires information not provided, you must reply with EXACTLY this word and nothing else: NO_ANSWER_FOUND
  `;

  try {
    const aiReply = await callAI(prompt);

    // STEP 4 FIX (ISSUE-03): needsHandover was previously true here, silently
    // locking the session after any unanswered FAQ — even legitimate questions
    // outside the knowledge base. This is a one-way trap.
    //
    // Fix: return needsHandover: false. The noAnswerFallback string already
    // asks the user "Would you like me to transfer you to an agent?".
    // If they say yes, the intent router classifies their next message as
    // 'handover' and escalates with explicit consent. If they don't, the
    // conversation continues normally.
    if (aiReply.trim() === 'NO_ANSWER_FOUND') {
      return {
        reply: getLocaleString(strings.faq.noAnswerFallback, language),
        needsHandover: false
      };
    }

    return {
      reply: aiReply,
      needsHandover: false
    };

  } catch (error) {
    console.error("FAQ Handler Error:", error);
    return {
      reply: getLocaleString(strings.faq.searchError, language),
      needsHandover: false
    };
  }
}
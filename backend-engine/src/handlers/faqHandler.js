// src/handlers/faqHandler.js
import { callAI } from '../services/ai/llmClient.js';
import { getKnowledgeBase } from '../services/configService.js';
import { strings, getLocaleString } from '../locales/strings.js';

export async function handleFaq(message, language, context) {
  // Fetch the dynamic knowledge base at call time.
  // Future: getKnowledgeBase() will return DB-sourced content (e.g. parsed PDFs).
  const knowledgeBaseText = await getKnowledgeBase();

  const prompt = `
    You are a polite and helpful customer service assistant.
    Analyze the user's question and check if the answer exists in the provided Company Knowledge Base.

    Company Knowledge Base:
    ${knowledgeBaseText}

    User Question: "${message}"
    Requested Language: "${language}"
    Rules:
    STRICT TONE RULE: DO NOT start your responses with greetings (like "Ahlan", "Salam", "Hello", "Welcome") UNLESS the conversation history is completely empty. If there is already a conversation history, jump straight into your answer.
    
    INSTRUCTIONS:
    - If the answer IS in the Knowledge Base, write a natural, friendly reply answering the question in the Requested Language.
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
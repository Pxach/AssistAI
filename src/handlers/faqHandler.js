import fs from 'fs';
import path from 'path';
import { callAI } from '../services/ai/llmClient.js'; // ✅ ADDED THIS IMPORT

// 1. Load the knowledge base into memory
const dataPath = path.resolve('src/data/faq-data.json');
const faqKnowledge = fs.readFileSync(dataPath, 'utf-8');

export async function handleFaq(message, language, context) {
  const prompt = `
    You are a polite and helpful customer service assistant.
    Analyze the user's question and check if the answer exists in the provided Knowledge Base.

    Knowledge Base:
    ${faqKnowledge}

    User Question: "${message}"
    Requested Language: "${language}"
    Rules:
    STRICT TONE RULE: DO NOT start your responses with greetings (like "Ahlan", "Salam", "Hello", "Welcome") UNLESS the conversation history is completely empty. If there is already a conversation history, jump straight into your answer.
    
    INSTRUCTIONS:
    - If the answer IS in the Knowledge Base, write a natural, friendly reply answering the question in the Requested Language.
    - If the answer IS NOT in the Knowledge Base, or if it requires information not provided, you must reply with EXACTLY this word and nothing else: NO_ANSWER_FOUND
  `;

  try {
    // ✅ NEW WAY: Let the client handle the fetch logic!
    const aiReply = await callAI(prompt);

    // 2. Handle the Fallback (Handover trigger)
    if (aiReply.trim() === 'NO_ANSWER_FOUND') {
      // Define localized fallback messages
      const fallbacks = {
        fr: "Je suis désolé, je n'ai pas cette information. Souhaitez-vous que je vous transfère à un de nos agents ?",
        en: "I'm sorry, I don't have that information. Would you like me to transfer you to an agent?",
        ar: "عذراً، ليس لدي هذه المعلومة. هل ترغب في التحدث إلى أحد موظفينا؟",
        darija: "Smahli, ma3ndich had lma3louma. Wesh bghiti nhawlek l chi agent yjawbek?"
      };

      return {
        reply: fallbacks[language] || fallbacks['fr'],
        needsHandover: true
      };
    }

    // 3. Return the successful AI answer
    return {
      reply: aiReply,
      needsHandover: false
    };

  } catch (error) {
    console.error("FAQ Handler Error:", error);
    return {
      reply: "Une erreur est survenue lors de la recherche d'information. Veuillez réessayer.",
      needsHandover: false
    };
  }
}
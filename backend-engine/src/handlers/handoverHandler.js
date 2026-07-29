// src/handlers/handoverHandler.js
import { strings, getLocaleString } from '../locales/strings.js';

export async function handleHandover(message, language, context) {
  try {
    // Ensure safe fallback if language is missing or invalid
    const safeLang = (language && typeof language === 'string') ? language.toLowerCase() : 'fr';

    const reply = getLocaleString(strings.handover.confirmation, safeLang);

    return {
      reply,
      needsHandover: true,
      metadata: {
        status: "escalated_to_human",
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("❌ Error in handleHandover:", error);
    // Safe hardcoded fallback reply to guarantee user receives confirmation
    return {
      reply: getLocaleString(strings.handover.confirmation, 'fr'),
      needsHandover: true,
      metadata: {
        status: "escalated_to_human",
        timestamp: new Date().toISOString(),
        error: error.message
      }
    };
  }
}
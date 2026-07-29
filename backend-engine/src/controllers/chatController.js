// src/controllers/chatController.js

import { sanitizeInput } from '../utils/security.js';
import { routeIntent } from '../services/ai/intentRouter.js';
import { handleFaq } from '../handlers/faqHandler.js';
import { handleHandover } from '../handlers/handoverHandler.js';
import { handleBooking } from '../handlers/bookingHandler.js';
import { strings, getLocaleString } from '../locales/strings.js';

// FIXED: Signature updated to accept senderPhone, botPhone, and ioContext from whatsappGateway.js
export async function processUserMessage(rawInput, language = 'fr', history = [], bookingState = {}, senderPhone = "", botPhone = "", ioContext = {}) {
  
  // 1. Interactive Button Interceptor (Bypass AI & Sanitization)
  if (typeof rawInput === 'object' && rawInput.type === 'interactive_button') {
    const buttonId = rawInput.buttonId;

    // Safely fallback to French if the language isn't recognized
    const safeLang = strings.reviewReplies.positive[language] ? language : 'fr';

    if (buttonId === 'REVIEW_SCORE_5') {
      return {
        status: 'success',
        metadata: { intent: 'review_positive', language: safeLang },
        data: { 
          reply: getLocaleString(strings.reviewReplies.positive, safeLang),
          needsHandover: false,
          newContext: bookingState 
        }
      };
    } else if (buttonId === 'REVIEW_SCORE_3' || buttonId === 'REVIEW_SCORE_1') {
      return {
        status: 'success',
        metadata: { intent: 'review_critical', language: safeLang },
        data: { 
          reply: getLocaleString(strings.reviewReplies.critical, safeLang),
          needsHandover: false,
          newContext: bookingState 
        }
      };
    }
  }

  // 2. Extract standard text for normal processing
  const textToProcess = typeof rawInput === 'string' ? rawInput : rawInput.text;

  if (!textToProcess) {
    return {
      status: 'error',
      metadata: { intent: 'unknown', language },
      data: { reply: getLocaleString(strings.common.unrecognizedFormat, language), needsHandover: false, newContext: bookingState }
    };
  }

  // 3. Security Check & Sanitization
  let securityResult;
  try {
    securityResult = await sanitizeInput(textToProcess);
  } catch (error) {
    console.error("Security sanitizer threw an unexpected error:", error);
    return {
      status: 'error',
      metadata: { intent: 'unknown', detectedLanguage: language },
      data: { reply: getLocaleString(strings.common.internalError, language), needsHandover: false, newContext: bookingState }
    };
  }

  if (!securityResult.safe) {
    const activeLang = strings.security.blocked[language] ? language : 'fr';

    return {
      status: 'blocked',
      metadata: {
        intent: 'unknown',
        detectedLanguage: language
      },
      data: {
        reply: getLocaleString(strings.security.blocked, activeLang),
        needsHandover: false,
        newContext: bookingState
      }
    };
  }

  const cleanText = securityResult.cleanText;

  // 4. Intent Routing (Keyword Interceptor or LLM Classification)
  const handoverKeywords = [
    // English
    /\b(human|agent|manager|support|live help|representative)\b/i,
    // French
    /\b(humain|agent|conseiller|responsable|directeur|personne)\b/i,
    // Darija & Arabic transliterations
    /\b(bnadem|insan|3amil|director|manager)\b/i,
    /nhdr m3a/i,
    /dwi m3a/i,
    /tkelm m3a/i,
    // Arabic script
    /إنسان/i,
    /بشري/i,
    /عميل/i,
    /مدير/i,
    /مساعدة/i
  ];

  const matchesHandoverKeyword = handoverKeywords.some(regex => regex.test(cleanText));

  let aiIntent;
  let aiDetectedLang = language;
  let aiHandoverReason = "";

  if (matchesHandoverKeyword) {
    console.log(`🔍 Handover keyword matched for user input: "${cleanText}"`);
    aiIntent = 'handover';
    aiHandoverReason = "Triggered by user escalation keyword.";
  } else {
    const routerResponse = await routeIntent(cleanText, language, bookingState, history);
    aiIntent = typeof routerResponse === 'string' ? routerResponse : routerResponse.intent;
    aiDetectedLang = typeof routerResponse === 'object' ? routerResponse.detectedLanguage : language;
    aiHandoverReason = typeof routerResponse === 'object' ? routerResponse.handoverReason : "";
  }

  // SMART STICKY LANGUAGE LOCK:
  // If we are booking, prevent English/French terms (like "Brand Consultation") from overwriting Darija/Arabic.
  // But ALLOW the system to naturally transition from Arabic to Darija if the user starts speaking Darija.
  if (aiIntent === 'booking' || (bookingState && bookingState.status === 'pending')) {
      if ((aiDetectedLang === 'en' || aiDetectedLang === 'fr') && (language === 'darija' || language === 'ar')) {
          aiDetectedLang = language; // Block the English/French hijack
      }
  }

  const activeLang = aiDetectedLang || language;

  // 5. Dispatch to the correct handler
  let handlerResult;
  
  switch (aiIntent) {
    case 'faq':
      handlerResult = await handleFaq(cleanText, activeLang, bookingState);
      break;
      
    case 'handover':
      handlerResult = await handleHandover(cleanText, activeLang, bookingState);
      break;

    case 'booking': 
      // FIXED: Passed bookingState, history, senderPhone, botPhone, AND ioContext to the booking handler
      handlerResult = await handleBooking(cleanText, activeLang, bookingState, history, senderPhone, botPhone, ioContext);
      break;

    case 'unknown':
    default: {
      handlerResult = {
        reply: getLocaleString(strings.unknown.rephrase, activeLang),
        needsHandover: false,
        newContext: bookingState
      };
      break;
    }
  }

  // 6. Return structured response back to Gateway
  return {
    status: 'success',
    metadata: {
      intent: aiIntent,
      detectedLanguage: aiDetectedLang,
      handoverReason: aiHandoverReason
    },
    data: handlerResult
  };
}
// src/controllers/chatController.js

import { sanitizeInput } from '../utils/security.js';
import { routeIntent } from '../services/ai/intentRouter.js';
import { handleFaq } from '../handlers/faqHandler.js';
import { handleHandover } from '../handlers/handoverHandler.js';
import { handleBooking } from '../handlers/bookingHandler.js';

// FIXED: Signature updated to accept senderPhone, botPhone, and ioContext from whatsappGateway.js
export async function processUserMessage(rawInput, language = 'fr', history = [], bookingState = {}, senderPhone = "", botPhone = "", ioContext = {}) {
  
  // 1. Interactive Button Interceptor (Bypass AI & Sanitization)
  if (typeof rawInput === 'object' && rawInput.type === 'interactive_button') {
    const buttonId = rawInput.buttonId;

    // Localized response dictionary
    const reviewReplies = {
      positive: {
        fr: "Nous sommes ravis que vous ayez apprécié ! Soutenez-nous en laissant un avis ici : [Lien Google Review]",
        en: "We're thrilled you enjoyed your experience! Support us by leaving a review here: [Google Review Link]",
        ar: "نحن سعداء لأنك استمتعت بتجربتك! ادعمنا بترك تقييم هنا: [رابط جوجل]",
        darija: "Frahna bzaf mli 3jbatk l'expérience! 3awnouna b chi avis hna: [Lien Google Review]"
      },
      critical: {
        fr: "Désolé que votre expérience n'ait pas été parfaite. Aidez-nous à nous améliorer en remplissant ce formulaire rapide : [Lien Tally]",
        en: "We're sorry your experience wasn't perfect. Help us improve by filling out this quick form: [Tally Link]",
        ar: "نأسف لأن تجربتك لم تكن مثالية. ساعدنا على التحسن من خلال ملء هذا النموذج السريع: [رابط Tally]",
        darija: "Smahliya bzaf ila l'expérience dyalek macantch hiya hadik. 3awna n7esno mn lkhedma dyalna w 3mer had lformulaire: [Lien Tally]"
      }
    };

    // Safely fallback to French if the language isn't recognized
    const safeLang = reviewReplies.positive[language] ? language : 'fr';

    if (buttonId === 'REVIEW_SCORE_5') {
      return {
        status: 'success',
        metadata: { intent: 'review_positive', language: safeLang },
        data: { 
          reply: reviewReplies.positive[safeLang],
          needsHandover: false,
          newContext: bookingState 
        }
      };
    } else if (buttonId === 'REVIEW_SCORE_3' || buttonId === 'REVIEW_SCORE_1') {
      return {
        status: 'success',
        metadata: { intent: 'review_critical', language: safeLang },
        data: { 
          reply: reviewReplies.critical[safeLang],
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
      data: { reply: "Format non reconnu.", needsHandover: false, newContext: bookingState }
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
      data: { reply: "Une erreur interne s'est produite. Veuillez réessayer.", needsHandover: false, newContext: bookingState }
    };
  }

  if (!securityResult.safe) {
    const securityFallbackReplies = {
      fr: "Je suis désolé, je ne peux pas traiter cette demande. Comment puis-je vous aider autrement ?",
      en: "I am sorry, I cannot process this request. How else can I help you?",
      ar: "أنا آسف، لا يمكنني معالجة هذا الطلب. كيف يمكنني مساعدتك بطريقة أخرى؟",
      darija: "Smahli, ma9dertch njaweb 3la had ltalab. Kifach n9der n3awnek b chi7aja khora?"
    };

    const activeLang = securityFallbackReplies[language] ? language : 'fr';

    return {
      status: 'blocked',
      metadata: {
        intent: 'unknown',
        detectedLanguage: language
      },
      data: {
        reply: securityFallbackReplies[activeLang],
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
      const unknownReplies = {
        fr: "Je n'ai pas bien compris. Pouvez-vous reformuler ?",
        en: "I didn't quite catch that. Could you rephrase?",
        ar: "عذراً، لم أفهم ذلك. هل يمكنك توضيح سؤالك؟",
        darija: "Smahli, mafhamtch mzyan. Wach t9der t3awed b tari9a khra?"
      };
      handlerResult = {
        reply: unknownReplies[activeLang] || unknownReplies['fr'],
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
// src/controllers/chatController.js

import { sanitizeInput } from '../utils/security.js';
import { routeIntent } from '../services/ai/intentRouter.js';
import { handleFaq } from '../handlers/faqHandler.js';
import { handleHandover } from '../handlers/handoverHandler.js';
import { handleBooking } from '../handlers/bookingHandler.js';

export async function processUserMessage(rawInput, language = 'fr', context = {}) { 
  
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
          newContext: null 
        }
      };
    } else if (buttonId === 'REVIEW_SCORE_3' || buttonId === 'REVIEW_SCORE_1') {
      return {
        status: 'success',
        metadata: { intent: 'review_critical', language: safeLang },
        data: { 
          reply: reviewReplies.critical[safeLang],
          needsHandover: false,
          newContext: null 
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
      data: { reply: "Format non reconnu.", needsHandover: false, newContext: context }
    };
  }

  // 3. Security Check & Sanitization
  const securityResult = await sanitizeInput(textToProcess);
  
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
        newContext: null
      }
    };
  }

  const cleanText = securityResult.cleanText;

  // 4. Intent Routing
  const routerResponse = await routeIntent(cleanText, language, context);

  // Handle both string (old) and object (new) responses gracefully
  const aiIntent = typeof routerResponse === 'string' ? routerResponse : routerResponse.intent;
  const aiDetectedLang = typeof routerResponse === 'object' ? routerResponse.detectedLanguage : language; // Default to current language if not detected

  const activeLang = aiDetectedLang || language;

  // 5. Dispatch to the correct handler
  let handlerResult;
  
  switch (aiIntent) {
    case 'faq':
      handlerResult = await handleFaq(cleanText, activeLang, context);
      break;
      
    case 'handover':
      handlerResult = await handleHandover(cleanText, activeLang, context);
      break;

    case 'booking': 
      handlerResult = await handleBooking(cleanText, activeLang, context);
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
        newContext: context
      };
      break;
    }
  }

  // 6. Return the final structured response
    return {
      status: 'success',
      metadata: {
        intent: aiIntent,
        language: activeLang,
        detectedLanguage: aiDetectedLang
      },
      data: handlerResult
    };
}
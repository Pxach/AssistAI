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
    return {
      status: 'blocked',
      reason: securityResult.reason || 'SECURITY_FLAG',
      response: "Je suis désolé, je ne peux pas traiter cette demande. Comment puis-je vous aider autrement ?"
    };
  }

  const cleanText = securityResult.cleanText;

  // 4. Intent Routing
  const intent = await routeIntent(cleanText, language, context);

  // 5. Dispatch to the correct handler
  let handlerResult;
  
  switch (intent) {
    case 'faq':
      handlerResult = await handleFaq(cleanText, language, context);
      break;
      
    case 'handover':
      handlerResult = await handleHandover(cleanText, language, context);
      break;

    case 'booking': 
      handlerResult = await handleBooking(cleanText, language, context);
      break;

    case 'unknown':
    default:
      handlerResult = {
        reply: "Je n'ai pas bien compris. Pouvez-vous reformuler ?",
        needsHandover: false,
        newContext: context
      };
      break;
  }

  // 6. Return the final structured response
  return {
    status: 'success',
    metadata: {
      intent: intent,
      language: language
    },
    data: handlerResult
  };
}
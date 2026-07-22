// src/controllers/chatController.js

import { sanitizeInput } from '../utils/security.js';
import { routeIntent } from '../services/ai/intentRouter.js';
import { handleFaq } from '../handlers/faqHandler.js';
import { handleHandover } from '../handlers/handoverHandler.js'; // 1. Import the new handler
import { handleBooking } from '../handlers/bookingHandler.js';

/**
 * Main controller to process incoming chat messages.
 */
// 2. Add `context = {}` to the parameters
export async function processUserMessage(rawInput, language = 'fr', context = {}) { 
  
  // 1. Security Check & Sanitization
  const securityResult = await sanitizeInput(rawInput);
  
  if (!securityResult.safe) {
    return {
      status: 'blocked',
      reason: securityResult.reason || 'SECURITY_FLAG',
      response: "Je suis désolé, je ne peux pas traiter cette demande. Comment puis-je vous aider autrement ?"
    };
  }

  const cleanText = securityResult.cleanText;

  // 2. Intent Routing
  // 3. Pass the context object to the router so it has short-term memory
  const intent = await routeIntent(cleanText, language, context);

  // 3. Dispatch to the correct handler
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
    // case 'review':  (We will add this later)

    case 'unknown':
    default:
      handlerResult = {
        reply: "Je n'ai pas bien compris. Pouvez-vous reformuler ?",
        needsHandover: false
      };
      break;
  }

  // 4. Return the final structured response
  return {
    status: 'success',
    metadata: {
      intent: intent,
      language: language
    },
    data: handlerResult
  };
}
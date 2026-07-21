// src/controllers/chatController.js

import { sanitizeInput } from '../utils/security.js'; 
import { classifyIntent } from '../services/ai/intentRouter.js';

import { handleFaq } from '../handlers/faqHandler.js';
import { handleBooking } from '../handlers/bookingHandler.js';
import { handleHandover } from '../handlers/handoverHandler.js';
import { handleReview } from '../handlers/reviewHandler.js';

/**
 * Main chat pipeline controller.
 * @param {string} rawInput - The unprocessed user message.
 * @param {object} context - Session metadata (e.g., userId, history)
 * @returns {Promise<object>} Standardized response payload
 */
export async function processUserMessage(rawInput, context = {}) {
  // 1. Security Check & Sanitization
  const securityResult = await sanitizeInput(rawInput);
  
  if (!securityResult.safe) {
    return {
      status: 'blocked',
      reason: securityResult.reason || 'SECURITY_FLAG',
      response: "Désolé, je n'ai pas bien compris votre demande. Pouvez-vous reformuler ?"
    };
  }

  const cleanMessage = securityResult.cleanText;

  // 2. Intent & Language Classification 
  const { intent, language, confidence } = await classifyIntent(cleanMessage);

  // 3. Dispatch to Specific Intent Handler
  let handlerResponse;

  switch (intent) {
    case 'booking':
      handlerResponse = await handleBooking(cleanMessage, language, context);
      break;

    case 'handover':
      handlerResponse = await handleHandover(cleanMessage, language, context);
      break;

    case 'review':
      handlerResponse = await handleReview(cleanMessage, language, context);
      break;

    case 'faq':
    default:
      handlerResponse = await handleFaq(cleanMessage, language, context);
      break;
  }

  // 4. Return Unified Output
  return {
    status: 'success',
    metadata: {
      intent,
      language,
      confidence
    },
    data: handlerResponse
  };
}
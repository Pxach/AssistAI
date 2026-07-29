// src/handlers/feedbackHandler.js
//
// Pure handler — NO LLM call needed.
// Classifies the user's text as 'good' | 'average' | 'bad' | 'invalid'
// using a multilingual keyword/number table, then returns the appropriate
// localized reply and a flag telling the gateway whether to clear the
// waitingForFeedback state.

import { getConfig } from '../services/configService.js';
import { strings, getLocaleString } from '../locales/strings.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// URLs are now fetched dynamically via configService so the dashboard can
// update them without a server restart or redeployment.
// Set these keys in .env (or the future DB config table):
//   GOOGLE_REVIEW_URL  — Your Google Business review link
//   TALLY_FORM_URL     — Your Tally feedback form base URL
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION TABLE
// Maps every accepted token → sentiment bucket.
// Numbers 1/2/3 are universal. Each language also has word aliases.
// All comparisons are done on the lowercased, trimmed input.
// ─────────────────────────────────────────────────────────────────────────────

const SENTIMENT_MAP = {
  // ── Universal numeric shortcuts ──────────────────────────────────────────
  '1': 'good',
  '2': 'average',
  '3': 'bad',

  // ── French ───────────────────────────────────────────────────────────────
  'bien':       'good',
  'bon':        'good',
  'bonne':      'good',
  'parfait':    'good',
  'excellent':  'good',
  'super':      'good',
  'moyen':      'average',
  'moyenne':    'average',
  'passable':   'average',
  'mauvais':    'bad',
  'mauvaise':   'bad',
  'mal':        'bad',
  'nul':        'bad',
  'nulle':      'bad',

  // ── English ──────────────────────────────────────────────────────────────
  'good':       'good',
  'great':      'good',
  'perfect':    'good',
  'awesome':    'good',
  'excellent':  'good',
  'average':    'average',
  'ok':         'average',
  'okay':       'average',
  'alright':    'average',
  'so-so':      'average',
  'bad':        'bad',
  'poor':       'bad',
  'terrible':   'bad',
  'awful':      'bad',

  // ── Arabic ───────────────────────────────────────────────────────────────
  'جيد':        'good',
  'ممتاز':      'good',
  'رائع':       'good',
  'حسن':        'good',
  'متوسط':      'average',
  'عادي':       'average',
  'سيئ':        'bad',
  'ضعيف':       'bad',
  'سيئة':       'bad',

  // ── Moroccan Darija (Latin script) ───────────────────────────────────────
  'mzyan':      'good',
  'mezyan':     'good',
  'zwina':      'good',
  'zwin':       'good',
  'bahi':       'good',
  'la bas':     'average',
  'labas':      'average',
  'wsat':       'average',
  'machi mzyan':'bad',
  'khayb':      'bad',
  'khayba':     'bad',
  'ma3jbniش':  'bad',
};

/**
 * Classifies a raw user message into a sentiment bucket.
 * @param {string} text
 * @returns {'good'|'average'|'bad'|'invalid'}
 */
function classifyFeedback(text) {
  const normalized = text.trim().toLowerCase();
  return SENTIMENT_MAP[normalized] ?? 'invalid';
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a user's raw feedback reply.
 *
 * @param {string} text        - Raw message text from the user.
 * @param {string} language    - Active session language ('fr'|'en'|'ar'|'darija').
 * @param {string} phoneNumber - User's phone number to append to the Tally Form URL.
 * @returns {Promise<{ reply: string, isDone: boolean, sentiment?: string, linkType?: string }>}
 *   reply     — The bot's response to send back.
 *   isDone    — true if a valid rating was captured (gateway should clear the flag).
 *               false if the input was invalid and we need to re-prompt.
 *   sentiment — Classified sentiment ('good'|'average'|'bad').
 *   linkType  — The type of link sent ('google_review'|'tally_form').
 */
export async function handleFeedback(text, language, phoneNumber = '') {
  // Fetch URLs via configService — future DB call replaces getConfig() internals.
  const GOOGLE_REVIEW_URL = await getConfig('GOOGLE_REVIEW_URL') || 'https://g.page/r/YOUR_GOOGLE_REVIEW_LINK';
  const TALLY_FORM_URL    = await getConfig('TALLY_FORM_URL')    || 'https://tally.so/r/YOUR_TALLY_FORM_ID';

  const lang = strings.feedback.good[language] ? language : 'fr'; // safe language fallback
  const sentiment = classifyFeedback(text);

  if (sentiment === 'invalid') {
    return {
      reply: getLocaleString(strings.feedback.invalid, lang),
      isDone: false  // keep waitingForFeedback = true, user must try again
    };
  }

  let linkType = null;
  let targetUrl = GOOGLE_REVIEW_URL;

  if (sentiment === 'good') {
    linkType = 'google_review';
    targetUrl = GOOGLE_REVIEW_URL;
  } else if (sentiment === 'average' || sentiment === 'bad') {
    linkType = 'tally_form';
    targetUrl = phoneNumber ? `${TALLY_FORM_URL}?phone=${phoneNumber}` : TALLY_FORM_URL;
  }

  const reply = getLocaleString(strings.feedback[sentiment], lang, targetUrl);

  return {
    reply,
    isDone: true,  // valid choice captured — gateway clears the flag
    sentiment,
    linkType
  };
}

// src/handlers/feedbackHandler.js
//
// Pure handler — NO LLM call needed.
// Classifies the user's text as 'good' | 'average' | 'bad' | 'invalid'
// using a multilingual keyword/number table, then returns the appropriate
// localized reply and a flag telling the gateway whether to clear the
// waitingForFeedback state.

import { getConfig } from '../services/configService.js';

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

  // ─── Localized reply strings (built with runtime URL values) ────────────────
  const REPLIES = {
    good: {
      fr:     `🌟 Merci beaucoup pour votre retour positif ! Cela nous touche vraiment.\n\nSoutenez-nous en laissant un avis Google ici :\n${GOOGLE_REVIEW_URL}`,
      en:     `🌟 Thank you so much for your positive feedback! It truly means a lot to us.\n\nPlease support us by leaving a Google review here:\n${GOOGLE_REVIEW_URL}`,
      ar:     `🌟 شكراً جزيلاً على تقييمك الإيجابي! يسعدنا سماع ذلك.\n\nادعمنا بترك تقييم على Google هنا:\n${GOOGLE_REVIEW_URL}`,
      darija: `🌟 Shokran bzaf 3la ra'yak! Farhna mnek.\n\n3awnouna b chi avis Google hna:\n${GOOGLE_REVIEW_URL}`
    },
    average: {
      fr:     `🙏 Merci pour votre retour. Nous sommes désolés que votre expérience n'ait pas été parfaite.\n\nAidez-nous à nous améliorer en remplissant ce formulaire rapide :\n${TALLY_FORM_URL}`,
      en:     `🙏 Thank you for your feedback. We're sorry your experience wasn't perfect.\n\nHelp us improve by filling out this quick form:\n${TALLY_FORM_URL}`,
      ar:     `🙏 شكراً على ملاحظتك. نأسف لأن تجربتك لم تكن مثالية.\n\nساعدنا على التحسن بملء هذا النموذج السريع:\n${TALLY_FORM_URL}`,
      darija: `🙏 Shokran 3la ra'yak. Hna mtsafin ila l-expérience macantch kamla.\n\n3awna n7esno w 3mer had formulaire:\n${TALLY_FORM_URL}`
    },
    bad: {
      fr:     `🙏 Merci pour votre honnêteté. Nous sommes vraiment désolés.\n\nVotre retour est précieux — aidez-nous à nous améliorer ici :\n${TALLY_FORM_URL}`,
      en:     `🙏 Thank you for your honesty. We are truly sorry to hear that.\n\nYour feedback is valuable — help us improve here:\n${TALLY_FORM_URL}`,
      ar:     `🙏 نقدر صراحتك. نحن آسفون جداً لسماع ذلك.\n\nملاحظتك ثمينة — ساعدنا على التحسن هنا:\n${TALLY_FORM_URL}`,
      darija: `🙏 Shokran 3la sra7tek. Hna mtsafin bzaf.\n\nRa'yek mhim 3lina — 3awna n7esno hna:\n${TALLY_FORM_URL}`
    },
    invalid: {
      fr:     `Je n'ai pas compris votre choix. Veuillez répondre avec :\n*1* — Bien 👍\n*2* — Moyen 😐\n*3* — Mauvais 👎`,
      en:     `I didn't catch that. Please reply with:\n*1* — Good 👍\n*2* — Average 😐\n*3* — Bad 👎`,
      ar:     `لم أفهم إجابتك. يرجى الرد بـ:\n*1* — جيد 👍\n*2* — متوسط 😐\n*3* — سيئ 👎`,
      darija: `Mafhamtch. 3afak jaweb b:\n*1* — Mzyan 👍\n*2* — Wsat 😐\n*3* — Khayb 👎`
    }
  };

  const lang = REPLIES.good[language] ? language : 'fr'; // safe language fallback
  const sentiment = classifyFeedback(text);

  if (sentiment === 'invalid') {
    return {
      reply: REPLIES.invalid[lang],
      isDone: false  // keep waitingForFeedback = true, user must try again
    };
  }

  let reply = REPLIES[sentiment][lang];
  let linkType = null;

  if (sentiment === 'good') {
    linkType = 'google_review';
  } else if (sentiment === 'average' || sentiment === 'bad') {
    linkType = 'tally_form';
    const dynamicTallyUrl = phoneNumber ? `${TALLY_FORM_URL}?phone=${phoneNumber}` : TALLY_FORM_URL;
    reply = reply.replace(TALLY_FORM_URL, dynamicTallyUrl);
  }

  return {
    reply,
    isDone: true,  // valid choice captured — gateway clears the flag
    sentiment,
    linkType
  };
}

// src/services/llmService.js
//
// Lightweight multi-provider AI gateway for the backend (dashboard API).
//
// This is a self-contained copy of the same provider pattern used in
// backend-engine/src/services/ai/llmClient.js. It exists here so the
// backend process can call LLMs without importing across process boundaries.
//
// Provider priority: Gemini → Groq → Mistral
// Keys are read from process.env (set in backend/.env).
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_REGISTRY = [
  {
    id:           'gemini',
    keyEnvVar:    'GEMINI_API_KEY',
    modelEnvVar:  'GEMINI_MODEL',
    defaultModel: 'gemini-3.5-flash-lite',

    buildUrl: (model, apiKey) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,

    buildHeaders: () => ({ 'Content-Type': 'application/json' }),

    buildBody: (prompt, model, options) => {
      const generationConfig = { temperature: 0.0 };
      if (options.jsonMode) generationConfig.responseMimeType = 'application/json';
      return JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      });
    },

    parseResponse: (data) => data.candidates[0].content.parts[0].text.trim(),
  },

  {
    id:           'groq',
    keyEnvVar:    'GROQ_API_KEY',
    modelEnvVar:  'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',

    buildUrl: () => 'https://api.groq.com/openai/v1/chat/completions',

    buildHeaders: (apiKey) => ({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),

    buildBody: (prompt, model, options) => {
      const body = {
        model,
        messages:    [{ role: 'user', content: prompt }],
        temperature: options.jsonMode ? 0.0 : 0.7,
        max_tokens:  options.jsonMode ? 2048 : 512,
      };
      if (options.jsonMode) body.response_format = { type: 'json_object' };
      return JSON.stringify(body);
    },

    parseResponse: (data) => data.choices[0].message.content.trim(),
  },

  {
    id:           'mistral',
    keyEnvVar:    'MISTRAL_API_KEY',
    modelEnvVar:  'MISTRAL_MODEL',
    defaultModel: 'open-mistral-nemo',

    buildUrl: () => 'https://api.mistral.ai/v1/chat/completions',

    buildHeaders: (apiKey) => ({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),

    buildBody: (prompt, model, options) => {
      const body = {
        model,
        messages:    [{ role: 'user', content: prompt }],
        temperature: options.jsonMode ? 0.0 : 0.7,
        max_tokens:  options.jsonMode ? 2048 : 512,
      };
      if (options.jsonMode) body.response_format = { type: 'json_object' };
      return JSON.stringify(body);
    },

    parseResponse: (data) => data.choices[0].message.content.trim(),
  },
];

const RETRIABLE_CODES = new Set([429, 500, 502, 503, 504]);

function getApiKey(provider) {
  const val = process.env[provider.keyEnvVar];
  return val && val.trim().length > 0 ? val.trim().replace(/^["']|["']$/g, '') : null;
}

function buildActiveProviders() {
  return PROVIDER_REGISTRY
    .filter((p) => Boolean(getApiKey(p)))
    .map((p) => ({
      ...p,
      apiKey: getApiKey(p),
      model: (process.env[p.modelEnvVar] || p.defaultModel).trim().replace(/^["']|["']$/g, ''),
    }));
}

async function callProvider(provider, prompt, options) {
  const url     = provider.buildUrl(provider.model, provider.apiKey);
  const headers = provider.buildHeaders(provider.apiKey);
  const body    = provider.buildBody(prompt, provider.model, options);
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body });
  } catch (networkErr) {
    throw new Error(`Network error from "${provider.id}": ${networkErr.message}`);
  }

  if (!response.ok) {
    const isRetriable = RETRIABLE_CODES.has(response.status);
    const errorBody   = await response.text().catch(() => '(unreadable)');
    throw new Error(
      `${isRetriable ? 'Retriable' : 'Fatal'} HTTP ${response.status} from "${provider.id}": ${errorBody.slice(0, 300)}`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error(`JSON parse failure from "${provider.id}": ${parseErr.message}`);
  }

  try {
    return provider.parseResponse(data);
  } catch (extractErr) {
    throw new Error(
      `Response extraction failure from "${provider.id}": ${extractErr.message} — ` +
      `Raw keys: ${Object.keys(data).join(', ')}`
    );
  }
}

/**
 * Calls the configured LLM with automatic failover.
 *
 * @param {string}  prompt           - The full prompt to send.
 * @param {object}  [options={}]
 * @param {boolean} [options.jsonMode] - Request structured JSON output.
 * @returns {Promise<string>}        - Raw text response.
 */
export async function callAI(prompt, options = {}) {
  const active = buildActiveProviders();

  if (active.length === 0) {
    throw new Error(
      '[LLM Service] No AI providers configured. ' +
      'Set GEMINI_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY in backend/.env'
    );
  }

  const errors = [];

  for (const provider of active) {
    try {
      return await callProvider(provider, prompt, options);
    } catch (err) {
      errors.push(`${provider.id}: ${err.message}`);
      console.warn(`[LLM Service] ⚠️ "${provider.id}" failed — rotating. Reason: ${err.message}`);
      if (err.message.includes('429')) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  throw new Error(`[LLM Service] All providers failed. ${errors.join(' | ')}`);
}

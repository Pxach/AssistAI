// src/services/ai/llmClient.js

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-PROVIDER AI GATEWAY WITH AUTOMATIC FAILOVER
//
// Architecture:
//   1. PROVIDER_REGISTRY  — static definitions for every supported provider:
//      how to build the URL, headers, request body, and parse the response.
//
//   2. buildActiveProviders() — scans process.env at call time and assembles
//      an ordered array of providers whose API key is non-empty. This means:
//        • New credentials added to the env take effect instantly (no restart
//          once the DB config swap is live).
//        • Zero-config: if a key is absent, the provider is silently skipped.
//
//   3. callAI() — iterates the active array; on a retriable error (429, 5xx,
//      network failure) it logs a warning and rotates to the next provider.
//      The exported signature is UNCHANGED so all callers continue to work.
//
//   4. callProvider() — executes the HTTP call for a single provider, adapts
//      the request format (Gemini-native vs OpenAI-compatible), and parses
//      the response. Throws on any failure so the outer loop can decide.
//
// Adding a new provider: append one entry to PROVIDER_REGISTRY — nothing else.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDER_REGISTRY = [

  // ── 1. GEMINI (Primary Default — Google) ───────────────────────────────────
  // Uses Gemini's native generateContent format (not OpenAI-compatible).
  {
    id:           'gemini',
    keyEnvVar:    'GEMINI_API_KEY',
    modelEnvVar:  'GEMINI_MODEL',
    defaultModel: 'gemini-2.0-flash',

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

  // ── 2. CEREBRAS INFERENCE ──────────────────────────────────────────────────
  // High-speed Llama inference platform. OpenAI-compatible endpoint.
  {
    id:           'cerebras',
    keyEnvVar:    'CEREBRAS_API_KEY',
    modelEnvVar:  'CEREBRAS_MODEL',
    defaultModel: 'llama3.1-70b',

    buildUrl: () => 'https://api.cerebras.ai/v1/chat/completions',

    buildHeaders: (apiKey) => ({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),

    buildBody: (prompt, model, options) => {
      const body = {
        model,
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.0,
      };
      if (options.jsonMode) body.response_format = { type: 'json_object' };
      return JSON.stringify(body);
    },

    parseResponse: (data) => data.choices[0].message.content.trim(),
  },

  // ── 3. OPENROUTER (Fallback Aggregator) ────────────────────────────────────
  // Routes to hundreds of models. Useful as a last-resort fallback.
  // OpenAI-compatible endpoint with additional Referer/Title headers.
  {
    id:           'openrouter',
    keyEnvVar:    'OPENROUTER_API_KEY',
    modelEnvVar:  'OPENROUTER_MODEL',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',

    buildUrl: () => 'https://openrouter.ai/api/v1/chat/completions',

    buildHeaders: (apiKey) => ({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // Required by OpenRouter for attribution and analytics
      'HTTP-Referer':  process.env.OPENROUTER_SITE_URL || 'http://localhost:5000',
      'X-Title':       process.env.OPENROUTER_SITE_NAME || 'AssistAI',
    }),

    buildBody: (prompt, model, options) => {
      const body = {
        model,
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.0,
      };
      if (options.jsonMode) body.response_format = { type: 'json_object' };
      return JSON.stringify(body);
    },

  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RETRIABLE STATUS CODES
// These represent transient infrastructure failures that warrant a provider
// rotation. Hard client errors (400, 401, 403) are NOT retried — they signal
// a misconfiguration that rotating providers will not fix.
// ─────────────────────────────────────────────────────────────────────────────
const RETRIABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// ─────────────────────────────────────────────────────────────────────────────
// BUILD ACTIVE PROVIDER LIST
// Scanned at callAI() invocation time so env changes take effect without a
// server restart. Providers are returned in PROVIDER_REGISTRY order —
// which defines the failover priority.
// ─────────────────────────────────────────────────────────────────────────────
function buildActiveProviders() {
  return PROVIDER_REGISTRY
    .filter((p) => {
      const key = process.env[p.keyEnvVar];
      return key && key.trim().length > 0;
    })
    .map((p) => ({
      ...p,
      apiKey: process.env[p.keyEnvVar].trim(),
      model:  (process.env[p.modelEnvVar] || p.defaultModel).trim(),
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: execute one provider attempt
// Network errors and non-OK HTTP responses are thrown so callAI() can rotate.
// ─────────────────────────────────────────────────────────────────────────────
async function callProvider(provider, prompt, options) {
  const url     = provider.buildUrl(provider.model, provider.apiKey);
  const headers = provider.buildHeaders(provider.apiKey);
  const body    = provider.buildBody(prompt, provider.model, options);

  console.log(`[LLM Client] Provider: ${provider.id} | Model: ${provider.model}`);

  // ── Network call ────────────────────────────────────────────────────────────
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body });
  } catch (networkError) {
    // fetch() throws on DNS failure, connection refused, timeout, etc.
    throw new Error(`Network error from "${provider.id}": ${networkError.message}`);
  }

  // ── HTTP status check ───────────────────────────────────────────────────────
  if (!response.ok) {
    const isRetriable = RETRIABLE_STATUS_CODES.has(response.status);
    const errorBody   = await response.text().catch(() => '(unreadable body)');
    const label       = isRetriable ? 'Retriable' : 'Fatal';
    throw new Error(
      `${label} HTTP ${response.status} from "${provider.id}": ${errorBody.slice(0, 300)}`
    );
  }

  // ── Parse JSON ──────────────────────────────────────────────────────────────
  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error(`JSON parse failure from "${provider.id}": ${parseError.message}`);
  }

  // ── Extract text ────────────────────────────────────────────────────────────
  try {
    return provider.parseResponse(data);
  } catch (extractError) {
    throw new Error(
      `Response extraction failure from "${provider.id}": ${extractError.message} — ` +
      `Raw keys: ${Object.keys(data).join(', ')}`
    );
  }
}

/**
 * Centralized multi-provider AI gateway with automatic failover.
 *
 * Signature is UNCHANGED from the original single-provider version.
 * All callers (intentRouter, bookingHandler, faqHandler, security) continue
 * to work without modification.
 *
 * @param {string}  prompt                  - The full instruction/prompt for the AI.
 * @param {object}  [options={}]            - Optional settings.
 * @param {boolean} [options.jsonMode]      - Request structured JSON output from the model.
 * @param {string}  [options.provider]      - Pin to a specific provider id (no failover).
 * @returns {Promise<string>}               - Raw text response from whichever model ran.
 */
export async function callAI(prompt, options = {}) {
  const activeProviders = buildActiveProviders();

  if (activeProviders.length === 0) {
    throw new Error(
      '[LLM Client] ❌ No AI providers are configured. ' +
      'Set at least one API key (GEMINI_API_KEY, CEREBRAS_API_KEY, or OPENROUTER_API_KEY) in your environment.'
    );
  }

  // ── Pinned provider: honour the explicit request, skip failover ─────────────
  if (options.provider) {
    const pinned = activeProviders.find((p) => p.id === options.provider);
    if (!pinned) {
      throw new Error(
        `[LLM Client] Requested provider "${options.provider}" is not active. ` +
        `Active providers: [${activeProviders.map((p) => p.id).join(', ')}]`
      );
    }
    return callProvider(pinned, prompt, options);
  }

  // ── Automatic sequential failover ──────────────────────────────────────────
  const errorLog = [];

  for (const provider of activeProviders) {
    try {
      return await callProvider(provider, prompt, options);
    } catch (err) {
      errorLog.push({ provider: provider.id, message: err.message });
      console.warn(
        `[LLM Client] ⚠️ Provider "${provider.id}" failed — rotating to next. ` +
        `Reason: ${err.message}`
      );
    }
  }

  // ── All providers exhausted ─────────────────────────────────────────────────
  const summary = errorLog.map((e) => `${e.provider}: ${e.message}`).join(' | ');
  console.error(`[LLM Client] ❌ All ${activeProviders.length} provider(s) failed. Errors: ${summary}`);
  throw new Error(`[LLM Client] All configured AI providers failed. ${summary}`);
}
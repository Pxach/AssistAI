// src/utils/security.js

// Common patterns used in prompt injection attacks
const PROMPT_INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system override/i,
  /you are now/i,
  /u are now/i,
  /forget your rules/i,
  /act as/i
];

/**
 * Sanitizes user input and checks for prompt injections.
 * @param {string} text - The raw text from the user.
 * @returns {object} { safe: boolean, cleanText: string, reason?: string }
 */
export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') {
    return { safe: false, cleanText: '' };
  }

  // 1. Check for prompt injection attempts
  const isMalicious = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));

  if (isMalicious) {
    return { safe: false, reason: "PROMPT_INJECTION_DETECTED" };
  }

  // 2. Strip dangerous characters (<, >, ', ", ;) to prevent basic injection issues
  const cleanText = text.replace(/[<>'";]/g, '').trim();

  return { safe: true, cleanText };
}
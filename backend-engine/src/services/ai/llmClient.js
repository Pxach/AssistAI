// src/services/ai/llmClient.js
import { getConfig } from '../configService.js';

/**
 * A centralized gateway for all AI model requests.
 * @param {string} prompt - The instructions for the AI.
 * @param {object} options - Configuration (e.g., jsonMode: true, provider: 'gemini' | 'ollama').
 */
export async function callAI(prompt, options = {}) {
  const provider = options.provider || 'gemini';
  const jsonMode = options.jsonMode || false;

  try {
    // ---------------------------------------------------------
    // ROUTE 1: GEMINI (Current Default)
    // ---------------------------------------------------------
    if (provider === 'gemini') {
      const geminiApiKey = await getConfig('GEMINI_API_KEY');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`;
      
      const generationConfig = { temperature: 0.0 };
      if (jsonMode) generationConfig.responseMimeType = "application/json";

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        })
      });

      if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    }

    // ---------------------------------------------------------
    // ROUTE 2: LOCAL OLLAMA (Future Expansion Example)
    // ---------------------------------------------------------
    if (provider === 'ollama') {
      // Future logic for local models (e.g., llama3) running via WSL/Docker
      // const response = await fetch('http://localhost:11434/api/generate', {...})
      // return data.response;
      throw new Error("Ollama provider not yet implemented.");
    }

    throw new Error(`Unknown AI provider: ${provider}`);

  } catch (error) {
    console.error(`[LLM Client Error] Provider: ${provider} -`, error);
    throw error; // Let the handler decide what to do if the AI fails
  }
}
// src/services/ai/intentRouter.js

export async function classifyIntent(userMessage) {
  const prompt = `
    You are an intent classifier for Assist AI.
    Analyze the following user input and determine their intent and language.
    User input: "${userMessage}"

    Respond ONLY in raw JSON matching this exact structure:
    {
      "intent": "booking" | "faq" | "handover" | "review",
      "language": "en" | "fr" | "ar" | "darija",
      "confidence": 0.95
    }
  `;

  try {
    // Pointing directly to the new Gemini 3.1 Flash-Lite endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json" // Guarantees valid JSON natively
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text.trim();
    
    return JSON.parse(rawText);

  } catch (error) {
    console.error("AI Routing Error:", error.message);
    if (error.cause) {
      console.error("🔍 Root Cause:", error.cause);
    }
    // Safe fallback response if network fails
    return { intent: "faq", language: "fr", confidence: 0.5 };
  }
}
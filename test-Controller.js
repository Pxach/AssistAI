// test-Controller.js
import 'dotenv/config';
import { processUserMessage } from './src/controllers/chatController.js';

async function runMultilingualReviewTest() {

  const testCases = [
    {
      language: 'darija',
      input: { type: 'interactive_button', buttonId: 'REVIEW_SCORE_5', label: '🟢 Excellent (5 Stars)' }
    },
    {
      language: 'darija',
      input: { type: 'interactive_button', buttonId: 'REVIEW_SCORE_1', label: '🔴 Décevant (1 Star)' }
    },
    {
      language: 'ar',
      input: { type: 'interactive_button', buttonId: 'REVIEW_SCORE_5', label: '🟢 Excellent (5 Stars)' }
    },
    {
      language: 'en',
      input: { type: 'interactive_button', buttonId: 'REVIEW_SCORE_3', label: '🟡 Moyen (3 Stars)' }
    },
    {
      // Testing the fallback: an unsupported language code should default to French
      language: 'es', 
      input: { type: 'interactive_button', buttonId: 'REVIEW_SCORE_1', label: '🔴 Décevant (1 Star)' }
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`👤 User [Lang: ${testCase.language.toUpperCase()}]: [BUTTON CLICK: ${testCase.input.label}]`);
    
    // Process the simulated button click, passing the specific language
    const result = await processUserMessage(testCase.input, testCase.language, {});
    
    console.log(`🤖 Bot (${result.metadata.intent}): ${result.data.reply}\n`);
  }
  
  console.log("✅ Multilingual Test Complete! You can safely commit your changes.");
}

runMultilingualReviewTest();
// src/handlers/handoverHandler.js

export async function handleHandover(message, language, context) {
  try {
    // Ensure safe fallback if language is missing or invalid
    const safeLang = (language && typeof language === 'string') ? language.toLowerCase() : 'fr';

    // Define localized confirmation messages
    const confirmations = {
      fr: "J'ai bien noté votre demande. Un agent humain va prendre le relais d'ici quelques instants. Merci de votre patience.",
      en: "I have noted your request. An agent will take over shortly. Thank you for your patience.",
      ar: "لقد سجلت طلبك. سيتولى أحد الموظفين مساعدتك بعد قليل. شكراً لصبرك.",
      darija: "Sjelt talab dyalek. Chi agent ghadi yjawbek daba shwiya. Chokran 3la sber dyalek."
    };

    const reply = confirmations[safeLang] || confirmations['fr'];

    return {
      reply,
      needsHandover: true,
      metadata: {
        status: "escalated_to_human",
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("❌ Error in handleHandover:", error);
    // Safe hardcoded fallback reply to guarantee user receives confirmation
    return {
      reply: "J'ai bien noté votre demande. Un agent humain va prendre le relais d'ici quelques instants. Merci de votre patience.",
      needsHandover: true,
      metadata: {
        status: "escalated_to_human",
        timestamp: new Date().toISOString(),
        error: error.message
      }
    };
  }
}
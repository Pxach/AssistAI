// src/handlers/handoverHandler.js

export async function handleHandover(message, language, context) {
  // Define localized confirmation messages
  const confirmations = {
    fr: "J'ai bien noté votre demande. Un agent humain va prendre le relais d'ici quelques instants. Merci de votre patience.",
    en: "I have noted your request. An agent will take over shortly. Thank you for your patience.",
    ar: "لقد سجلت طلبك. سيتولى أحد الموظفين مساعدتك بعد قليل. شكراً لصبرك.",
    darija: "Sjelt talab dyalek. Chi agent ghadi yjawbek daba shwiya. Chokran 3la sber dyalek."
  };

  return {
    reply: confirmations[language] || confirmations['fr'],
    needsHandover: true,
    metadata: {
      status: "escalated_to_human",
      timestamp: new Date().toISOString()
    }
  };
}
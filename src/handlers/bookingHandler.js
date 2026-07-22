// src/handlers/bookingHandler.js
import { callAI } from '../services/ai/llmClient.js';
const companyCatalog = {
  services: [
    { id: 1, name: "Database Optimization", department: "it", duration: 60 },
    { id: 2, name: "Server Configuration", department: "it", duration: 120 },
    { id: 3, name: "UI/UX Review", department: "design", duration: 45 },
    { id: 4, name: "Brand Consultation", department: "marketing", duration: 30 }
  ],
  specialists: [
    { id: 101, name: "Sarah", department: "it", services: [1, 2] },
    { id: 102, name: "Alex", department: "it", services: [1] },
    { id: 103, name: "Karim", department: "design", services: [3] }
  ]
};

export async function handleBooking(message, language, context = {}) {
  // 1. Initialize State (Added user_confirmed flag)
  let currentBookingState = context.bookingState || {
    customer_name: null,
    contact_info: null,
    department: null,
    specialist_name: null,
    service_requested: null,
    appointment_date: null,
    appointment_time: null,
    status: "pending",
    user_confirmed: false // NEW FLAG
  };

  const today = new Date().toISOString().split('T')[0];

  // 2. Extract Entities
  const prompt = `
    You are an AI data extractor for a booking system. 
    Analyze the User's Message and update the Current State.
    
    Today's Date is: ${today}
    Current State: ${JSON.stringify(currentBookingState)}
    User's Message: "${message}"

    Rules:
    - Update the JSON with any new information provided.
    - If the user mentions a relative time (e.g., "demain"), calculate the exact YYYY-MM-DD date.
    - IF the user confirms the final details (e.g., "yes", "oui", "parfait", "looks good"), set "user_confirmed" to true.
    - IF the user corrects a detail (e.g., "change the time to 4 PM"), update that field and ensure "user_confirmed" remains false.
    - Respond strictly with valid JSON only.
  `;

  try {
    // ✅ NEW WAY: Call the client and tell it we strictly need JSON format back
    const rawAiText = await callAI(prompt, { jsonMode: true });
    
    // Parse the JSON string returned by the client
    const extractedData = JSON.parse(rawAiText);
    
    // Merge the extracted data into our state
    currentBookingState = { ...currentBookingState, ...extractedData };

  } catch (error) {
    console.error("Booking Extraction Error:", error);
    return {
      reply: "Désolé, j'ai eu un problème pour traiter votre réservation. Pouvez-vous répéter ?",
      needsHandover: false,
      newContext: { bookingState: currentBookingState }
    };
  }

  // 3. Waterfall Validation
  let botReply = "";
  let isComplete = false;
  const lang = language || 'fr'; 

  const replies = {
    askService: {
      fr: "Quel type de service souhaitez-vous réserver ?",
      en: "What type of service would you like to book?",
      ar: "ما نوع الخدمة التي ترغب في حجزها؟",
      darija: "Chno no3 dyal service li bghiti tréserver?"
    },
    askSpecialist: {
      fr: `Souhaitez-vous planifier ce rendez-vous pour ${currentBookingState.service_requested} avec un spécialiste en particulier ?`,
      en: `Would you like to schedule your ${currentBookingState.service_requested} with a specific specialist?`,
      ar: `هل ترغب في تحديد موعد لـ ${currentBookingState.service_requested} مع متخصص معين؟`,
      darija: `Bghiti tbooker had ${currentBookingState.service_requested} m3a chi spécialiste wla n3tik awel wahed dispo?`
    },
    askDateTime: {
      fr: `Parfait. À quelle date et à quelle heure aimeriez-vous rencontrer ${currentBookingState.specialist_name || 'notre spécialiste'} ?`,
      en: `Perfect. What date and time would you like to meet with ${currentBookingState.specialist_name || 'our specialist'}?`,
      ar: `ممتاز. ما هو التاريخ والوقت الذي ترغب فيه بلقاء ${currentBookingState.specialist_name || 'المتخصص'}؟`,
      darija: `Mezyan. Inna nhar w w9t bghiti ttlaqa m3a ${currentBookingState.specialist_name || 'spécialiste dyalna'}?`
    },
    askName: {
      fr: "Presque terminé ! Quel est votre nom complet pour la réservation ?",
      en: "Almost done! What is your full name for the booking?",
      ar: "شارفنا على الانتهاء! ما هو اسمك الكامل للحجز؟",
      darija: "B9a lina shwiya! Chno smaytek lkamla 3la 9bel la réservation?"
    },
    askContact: {
      fr: "Quel est votre numéro de téléphone ou adresse e-mail pour vous envoyer la confirmation ?",
      en: "What is your phone number or email address so we can send the confirmation?",
      ar: "ما هو رقم هاتفك أو بريدك الإلكتروني لإرسال التأكيد؟",
      darija: "Chno nemra dyal tlfoun wla l'email dyalek bach nsifto lik confirmation?"
    },
    askConfirmation: { 
      fr: `Voici un récapitulatif :\n- Service : ${currentBookingState.service_requested}\n- Spécialiste : ${currentBookingState.specialist_name}\n- Date & Heure : ${currentBookingState.appointment_date} à ${currentBookingState.appointment_time}\n- Nom : ${currentBookingState.customer_name}\n- Contact : ${currentBookingState.contact_info}\n\nEst-ce que tout est correct ?`,
      en: `Here is a summary:\n- Service: ${currentBookingState.service_requested}\n- Specialist: ${currentBookingState.specialist_name}\n- Date & Time: ${currentBookingState.appointment_date} at ${currentBookingState.appointment_time}\n- Name: ${currentBookingState.customer_name}\n- Contact: ${currentBookingState.contact_info}\n\nIs everything correct to confirm?`,
      ar: `إليك ملخص لطلبك:\n- الخدمة: ${currentBookingState.service_requested}\n- المتخصص: ${currentBookingState.specialist_name}\n- التاريخ والوقت: ${currentBookingState.appointment_date} الساعة ${currentBookingState.appointment_time}\n- الاسم: ${currentBookingState.customer_name}\n- معلومات الاتصال: ${currentBookingState.contact_info}\n\nهل كل شيء صحيح لتأكيد الحجز؟`,
      darija: `Hada lkholasa dyal talab dyalek:\n- Service: ${currentBookingState.service_requested}\n- Spécialiste: ${currentBookingState.specialist_name}\n- Nhar w w9t: ${currentBookingState.appointment_date} m3a ${currentBookingState.appointment_time}\n- Smya: ${currentBookingState.customer_name}\n- Contact: ${currentBookingState.contact_info}\n\nWash kolchi mzyan bash nkonfirmiw?`
    },
    finalConfirm: { 
      fr: `Parfait ! Votre rendez-vous est maintenant officiellement confirmé. Vous recevrez une notification sur ${currentBookingState.contact_info} sous peu.`,
      en: `Perfect! Your appointment is now officially confirmed. You will receive a notification at ${currentBookingState.contact_info} shortly.`,
      ar: `ممتاز! تم تأكيد موعدك رسمياً الآن. ستتلقى إشعاراً على ${currentBookingState.contact_info} قريباً.`,
      darija: `Nadi! Lmawid dyalek tkonfirma. Gha twsellek notification f ${currentBookingState.contact_info} mn hna chwiya.`
    }
  };

  if (!currentBookingState.service_requested) botReply = replies.askService[lang] || replies.askService['fr'];
  else if (!currentBookingState.specialist_name) botReply = replies.askSpecialist[lang] || replies.askSpecialist['fr'];
  else if (!currentBookingState.appointment_date || !currentBookingState.appointment_time) botReply = replies.askDateTime[lang] || replies.askDateTime['fr'];
  else if (!currentBookingState.customer_name) botReply = replies.askName[lang] || replies.askName['fr'];
  else if (!currentBookingState.contact_info) botReply = replies.askContact[lang] || replies.askContact['fr'];
  else if (!currentBookingState.user_confirmed) botReply = replies.askConfirmation[lang] || replies.askConfirmation['fr'];
  else {
    // Everything is filled AND confirmed by the user!
    currentBookingState.status = "confirmed";
    isComplete = true;
    botReply = replies.finalConfirm[lang] || replies.finalConfirm['fr'];
    
    // TODO (Future): Add the PostgreSQL insertion query here. This is where it becomes permanent.
  }

  return {
    reply: botReply,
    needsHandover: false,
    newContext: isComplete ? null : { bookingState: currentBookingState }
  };
}
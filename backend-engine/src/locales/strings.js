// src/locales/strings.js

/**
 * Centralized i18n Localization Dictionary
 * Supported Languages: 'fr' (French - default), 'en' (English), 'ar' (Arabic), 'darija' (Moroccan Arabic)
 */

export const strings = {
  // ─────────────────────────────────────────────────────────────────────────
  // INTERACTIVE REVIEWS
  // ─────────────────────────────────────────────────────────────────────────
  reviewReplies: {
    positive: {
      fr: "Nous sommes ravis que vous ayez apprécié ! Soutenez-nous en laissant un avis ici : [Lien Google Review]",
      en: "We're thrilled you enjoyed your experience! Support us by leaving a review here: [Google Review Link]",
      ar: "نحن سعداء لأنك استمتعت بتجربتك! ادعمنا بترك تقييم هنا: [رابط جوجل]",
      darija: "Frahna bzaf mli 3jbatk l'expérience! 3awnouna b chi avis hna: [Lien Google Review]"
    },
    critical: {
      fr: "Désolé que votre expérience n'ait pas été parfaite. Aidez-nous à nous améliorer en remplissant ce formulaire rapide : [Lien Tally]",
      en: "We're sorry your experience wasn't perfect. Help us improve by filling out this quick form: [Tally Link]",
      ar: "نأسف لأن تجربتك لم تكن مثالية. ساعدنا على التحسن من خلال ملء هذا النموذج السريع: [رابط Tally]",
      darija: "Smahliya bzaf ila l'expérience dyalek macantch hiya hadik. 3awna n7esno mn lkhedma dyalna w 3mer had lformulaire: [Lien Tally]"
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SECURITY & SYSTEM FALLBACKS
  // ─────────────────────────────────────────────────────────────────────────
  security: {
    blocked: {
      fr: "Je suis désolé, je ne peux pas traiter cette demande. Comment puis-je vous aider autrement ?",
      en: "I am sorry, I cannot process this request. How else can I help you?",
      ar: "أنا آسف، لا يمكنني معالجة هذا الطلب. كيف يمكنني مساعدتك بطريقة أخرى؟",
      darija: "Smahli, ma9dertch njaweb 3la had ltalab. Kifach n9der n3awnek b chi7aja khora?"
    }
  },

  common: {
    unrecognizedFormat: {
      fr: "Format non reconnu.",
      en: "Unrecognized format.",
      ar: "نسق غير معروف.",
      darija: "Format ma m3roufch."
    },
    internalError: {
      fr: "Une erreur interne s'est produite. Veuillez réessayer.",
      en: "An internal error occurred. Please try again.",
      ar: "حدث خطأ داخلي. يرجى المحاولة مرة أخرى.",
      darija: "W9a3 khata2 dakhili. 3awd 7awel mn b3d."
    },
    fatalErrorFallback: {
      fr: "Je suis désolé, une erreur s'est produite. Veuillez réessayer dans un instant.",
      en: "I'm sorry, an error occurred. Please try again in a moment.",
      ar: "أنا آسف، حدث خطأ. يرجى المحاولة بعد قليل.",
      darija: "Smahli, w9a3 khata2. 3afak 3awd 7awel mn hna chwiya."
    }
  },

  unknown: {
    rephrase: {
      fr: "Je n'ai pas bien compris. Pouvez-vous reformuler ?",
      en: "I didn't quite catch that. Could you rephrase?",
      ar: "عذراً، لم أفهم ذلك. هل يمكنك توضيح سؤالك؟",
      darija: "Smahli, mafhamtch mzyan. Wach t9der t3awed b tari9a khra?"
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOOKING HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  booking: {
    extractionError: {
      fr: "Désolé, j'ai eu un problème pour traiter votre réservation. Pouvez-vous répéter ?",
      en: "Sorry, I encountered an issue processing your booking. Could you repeat?",
      ar: "عذراً، واجهت مشكلة في معالجة حجزك. هل يمكنك الإعادة؟",
      darija: "Smahli, w9a3 mushkil f traitement dyal la réservation. Wach t9der t3awd?"
    },
    askService: {
      fr: "Quel type de service souhaitez-vous réserver ?",
      en: "What type of service would you like to book?",
      ar: "ما نوع الخدمة التي ترغب في حجزها؟",
      darija: "Chno no3 dyal service li bghiti tréserver?"
    },
    askSpecialist: {
      fr: (service) => `Souhaitez-vous planifier ce rendez-vous pour ${service} avec un spécialiste en particulier ?`,
      en: (service) => `Would you like to schedule your ${service} with a specific specialist?`,
      ar: (service) => `هل ترغب في تحديد موعد لـ ${service} مع متخصص معين؟`,
      darija: (service) => `Bghiti tbooker had ${service} m3a chi spécialiste wla n3tik awel wahed dispo?`
    },
    askDate: {
      fr: (service) => `Parfait. À quelle date aimeriez-vous planifier votre ${service} ?`,
      en: (service) => `Perfect. What date would you like to schedule your ${service}?`,
      ar: (service) => `ممتاز. في أي تاريخ ترغب في تحديد موعدك؟`,
      darija: (service) => `Mezyan. Inna nhar bghiti tdir had l-rendezvous?`
    },
    askTime: {
      fr: "À quelle heure précise souhaitez-vous fixer le rendez-vous ?",
      en: "At what exact time would you like to schedule the appointment?",
      ar: "في اي ساعة تحديداً ترغب في تحديد الموعد؟",
      darija: "F w9t bghiti tdir l-rendezvous? (3tini ssa3a bdabt)"
    },
    askName: {
      fr: "Presque terminé ! Quel est votre nom complet pour la réservation ?",
      en: "Almost done! What is your full name for the booking?",
      ar: "شارفنا على الانتهاء! ما هو اسمك الكامل للحجز؟",
      darija: "B9a lina shwiya! Chno smaytek lkamla 3la 9bel la réservation?"
    },
    askContact: {
      fr: "Quel est votre numéro de téléphone valide ou votre adresse e-mail pour vous envoyer la confirmation ?",
      en: "What is a valid phone number or email address so we can send the confirmation?",
      ar: "ما هو رقم هاتفك الصحيح أو بريدك الإلكتروني لإرسال التأكيد؟",
      darija: "3tini nemra d tlfoun s7i7a wla email bach nsifto lik confirmation."
    },
    askConfirmation: {
      fr: (state) => `Voici un récapitulatif :\n- Service : ${state.service_requested}\n- Spécialiste : ${state.specialist_name}\n- Date & Heure : ${state.appointment_date} à ${state.appointment_time}\n- Nom : ${state.customer_name}\n- Contact : ${state.contact_info}\n\nEst-ce que tout est correct ?`,
      en: (state) => `Here is a summary:\n- Service: ${state.service_requested}\n- Specialist: ${state.specialist_name}\n- Date & Time: ${state.appointment_date} at ${state.appointment_time}\n- Name: ${state.customer_name}\n- Contact: ${state.contact_info}\n\nIs everything correct to confirm?`,
      ar: (state) => `إليك ملخص لطلبك:\n- الخدمة: ${state.service_requested}\n- المتخصص: ${state.specialist_name}\n- التاريخ والوقت: ${state.appointment_date} الساعة ${state.appointment_time}\n- الاسم: ${state.customer_name}\n- معلومات الاتصال: ${state.contact_info}\n\nهل كل شيء صحيح لتأكيد الحجز؟`,
      darija: (state) => `Hada lkholasa dyal talab dyalek:\n- Service: ${state.service_requested}\n- Spécialiste: ${state.specialist_name}\n- Nhar w w9t: ${state.appointment_date} m3a ${state.appointment_time}\n- Smya: ${state.customer_name}\n- Contact: ${state.contact_info}\n\nWash kolchi mzyan bash nkonfirmiw?`
    },
    finalConfirm: {
      fr: (contact) => `Parfait ! Votre rendez-vous est maintenant officiellement confirmé. Vous recevrez une notification sur ${contact} sous peu.`,
      en: (contact) => `Perfect! Your appointment is now officially confirmed. You will receive a notification at ${contact} shortly.`,
      ar: (contact) => `ممتاز! تم تأكيد موعدك رسمياً الآن. ستتلقى إشعاراً على ${contact} قريباً.`,
      darija: (contact) => `Nadi! Lmawid dyalek tkonfirma. Gha twsellek notification f ${contact} mn hna chwiya.`
    },
    calendarAppend: {
      fr: (link) => `\n\n📅 Ajoutez-le à votre calendrier : ${link}`,
      en: (link) => `\n\n📅 Add it to your calendar: ${link}`,
      ar: (link) => `\n\n📅 أضفه إلى تقويمك : ${link}`,
      darija: (link) => `\n\n📅 Zidha f l-calendrier dyalek : ${link}`
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FAQ HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  faq: {
    noAnswerFallback: {
      fr: "Je suis désolé, je n'ai pas cette information. Souhaitez-vous que je vous transfère à un de nos agents ?",
      en: "I'm sorry, I don't have that information. Would you like me to transfer you to an agent?",
      ar: "عذراً، ليس لدي هذه المعلومة. هل ترغب في التحدث إلى أحد موظفينا؟",
      darija: "Smahli, ma3ndich had lma3louma. Wesh bghiti nhawlek l chi agent yjawbek?"
    },
    searchError: {
      fr: "Une erreur est survenue lors de la recherche d'information. Veuillez réessayer.",
      en: "An error occurred while searching for information. Please try again.",
      ar: "حدث خطأ أثناء البحث عن المعلومات. يرجى المحاولة مرة أخرى.",
      darija: "W9a3 khata2 f lb7et 3la lma3louma. 3awd 7awel."
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FEEDBACK HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  feedback: {
    good: {
      fr: (url) => `🌟 Merci beaucoup pour votre retour positif ! Cela nous touche vraiment.\n\nSoutenez-nous en laissant un avis Google ici :\n${url}`,
      en: (url) => `🌟 Thank you so much for your positive feedback! It truly means a lot to us.\n\nPlease support us by leaving a Google review here:\n${url}`,
      ar: (url) => `🌟 شكراً جزيلاً على تقييمك الإيجابي! يسعدنا سماع ذلك.\n\nادعمنا بترك تقييم على Google هنا:\n${url}`,
      darija: (url) => `🌟 Shokran bzaf 3la ra'yak! Farhna mnek.\n\n3awnouna b chi avis Google hna:\n${url}`
    },
    average: {
      fr: (url) => `🙏 Merci pour votre retour. Nous sommes désolés que votre expérience n'ait pas été parfaite.\n\nAidez-nous à nous améliorer en remplissant ce formulaire rapide :\n${url}`,
      en: (url) => `🙏 Thank you for your feedback. We're sorry your experience wasn't perfect.\n\nHelp us improve by filling out this quick form:\n${url}`,
      ar: (url) => `🙏 شكراً على ملاحظتك. نأسف لأن تجربتك لم تكن مثالية.\n\nساعدنا على التحسن بملء هذا النموذج السريع:\n${url}`,
      darija: (url) => `🙏 Shokran 3la ra'yak. Hna mtsafin ila l-expérience macantch kamla.\n\n3awna n7esno w 3mer had formulaire:\n${url}`
    },
    bad: {
      fr: (url) => `🙏 Merci pour votre honnêteté. Nous sommes vraiment désolés.\n\nVotre retour est précieux — aidez-nous à nous améliorer ici :\n${url}`,
      en: (url) => `🙏 Thank you for your honesty. We are truly sorry to hear that.\n\nYour feedback is valuable — help us improve here:\n${url}`,
      ar: (url) => `🙏 نقدر صراحتك. نحن آسفون جداً لسماع ذلك.\n\nملاحظتك ثمينة — ساعدنا على التحسن هنا:\n${url}`,
      darija: (url) => `🙏 Shokran 3la sra7tek. Hna mtsafin bzaf.\n\nRa'yek mhim 3lina — 3awna n7esno hna:\n${url}`
    },
    invalid: {
      fr: "Je n'ai pas compris votre choix. Veuillez répondre avec :\n*1* — Bien 👍\n*2* — Moyen 😐\n*3* — Mauvais 👎",
      en: "I didn't catch that. Please reply with:\n*1* — Good 👍\n*2* — Average 😐\n*3* — Bad 👎",
      ar: "لم أفهم إجابتك. يرجى الرد بـ:\n*1* — جيد 👍\n*2* — متوسط 😐\n*3* — سيئ 👎",
      darija: "Mafhamtch. 3afak jaweb b:\n*1* — Mzyan 👍\n*2* — Wsat 😐\n*3* — Khayb 👎"
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HANDOVER HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  handover: {
    confirmation: {
      fr: "J'ai bien noté votre demande. Un agent humain va prendre le relais d'ici quelques instants. Merci de votre patience.",
      en: "I have noted your request. An agent will take over shortly. Thank you for your patience.",
      ar: "لقد سجلت طلبك. سيتولى أحد الموظفين مساعدتك بعد قليل. شكراً لصبرك.",
      darija: "Sjelt talab dyalek. Chi agent ghadi yjawbek daba shwiya. Chokran 3la sber dyalek."
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REMINDER SERVICE
  // ─────────────────────────────────────────────────────────────────────────
  reminder: {
    appointmentReminder: {
      fr: (appt) => `📅 *Rappel de rendez-vous*\n\nBonjour ${appt.clientName} ! Votre rendez-vous *${appt.service}* avec *${appt.specialist}* est prévu *demain à ${appt.appointmentTime}*.\n\nSi vous devez annuler ou reporter, veuillez nous contacter dès que possible.`,
      en: (appt) => `📅 *Appointment Reminder*\n\nHello ${appt.clientName}! Your *${appt.service}* appointment with *${appt.specialist}* is scheduled for *tomorrow at ${appt.appointmentTime}*.\n\nIf you need to cancel or reschedule, please contact us as soon as possible.`,
      ar: (appt) => `📅 *تذكير بالموعد*\n\nمرحباً ${appt.clientName}! موعدك لـ *${appt.service}* مع *${appt.specialist}* مقرر *غداً في تمام الساعة ${appt.appointmentTime}*.\n\nإذا كنت بحاجة إلى الإلغاء أو التغيير، يرجى الاتصال بنا في أقرب وقت.`,
      darija: (appt) => `📅 *Reminder d lmawid*\n\nSalam ${appt.clientName}! Lmawid dyalek dyal *${appt.service}* m3a *${appt.specialist}* ghadi ykoun *ghedda f ${appt.appointmentTime}*.\n\nIla bghiti tannuli aw tbeddel lwaqt, kellmna bekri.`
    },
    feedbackPrompt: {
      fr: (appt) => `⭐ *Votre avis compte !*\n\nBonjour ${appt.clientName}, votre rendez-vous *${appt.service}* de ${appt.appointmentTime} est terminé.\n\nComment s'est passée votre expérience ?\n\n*1* — Bien 👍\n*2* — Moyen 😐\n*3* — Mauvais 👎`,
      en: (appt) => `⭐ *Your feedback matters!*\n\nHello ${appt.clientName}, your *${appt.service}* appointment at ${appt.appointmentTime} has concluded.\n\nHow was your experience?\n\n*1* — Good 👍\n*2* — Average 😐\n*3* — Bad 👎`,
      ar: (appt) => `⭐ *رأيك يهمنا!*\n\nمرحباً ${appt.clientName}، انتهى موعدك لـ *${appt.service}* الساعة ${appt.appointmentTime}.\n\nكيف كانت تجربتك؟\n\n*1* — جيد 👍\n*2* — متوسط 😐\n*3* — سيئ 👎`,
      darija: (appt) => `⭐ *Ra'yek mhim 3lina!*\n\nSalam ${appt.clientName}, lmawid dyalek dyal *${appt.service}* f ${appt.appointmentTime} tmm.\n\nKifach kanet l-expérience dyalek?\n\n*1* — Mzyan 👍\n*2* — Wsat 😐\n*3* — Khayb 👎`
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ANTI-LOOP ESCALATION
  // ─────────────────────────────────────────────────────────────────────────
  antiLoop: {
    escalation: {
      fr: "Je suis désolé, j'ai du mal à vous comprendre. Je vous transfère maintenant à un agent humain qui pourra mieux vous aider.",
      en: "I'm sorry, I'm having trouble understanding you. I am now transferring you to a human agent who can assist you better.",
      ar: "أنا آسف، أجد صعوبة في فهمك. سأحيلك الآن إلى وكيل بشري يمكنه مساعدتك بشكل أفضل.",
      darija: "Smahliya, ma9dertch nfhemk mzyan. Ghadi ndowzek nwhd l'agent li y9dar y3awnek."
    }
  }
};

/**
 * Universal helper function to safely retrieve localized strings with fallback to French ('fr').
 * @param {object} dictSection - Target category dictionary object (e.g. strings.security.blocked)
 * @param {string} lang - Active language code ('fr' | 'en' | 'ar' | 'darija')
 * @param {any} [arg] - Optional parameter to pass if the entry is a function template
 * @returns {string}
 */
export function getLocaleString(dictSection, lang = 'fr', arg) {
  if (!dictSection) return "";
  const safeLang = dictSection[lang] ? lang : 'fr';
  const target = dictSection[safeLang];
  if (typeof target === 'function') {
    return target(arg);
  }
  return target;
}

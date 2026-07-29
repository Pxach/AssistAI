// src/handlers/bookingHandler.js
import { callAI } from '../services/ai/llmClient.js';
import { insertEvent } from '../services/calendarService.js'; 
import { strings, getLocaleString } from '../locales/strings.js';

// 🚀 DATABASE MOCK FUNCTION (Future-Proofed)
async function fetchCompanyCatalogFromDB() {
  return {
    services: [
      { id: 1, name: "Database Optimization", department: "it", duration: 60 },
      { id: 2, name: "Server Configuration", department: "it", duration: 120 },
      { id: 3, name: "UI/UX Review", department: "design", duration: 45 },
      { id: 4, name: "Brand Consultation", department: "marketing", duration: 30 }
    ],
    specialists: [
      { id: 101, name: "Sarah", department: "it", services: [1, 2] },
      { id: 102, name: "Alex", department: "it", services: [1, 4] },
      { id: 103, name: "Karim", department: "design", services: [3] }
    ]
  };
}

export async function handleBooking(message, language, bookingState = {}, history = [], senderPhone = "", botPhone = "", ioContext = {}) {
  // 1. Initialize State (Merged with server memory)
  let currentBookingState = {
    customer_name: null,
    contact_info: null,
    specialist_name: null,
    service_requested: null,
    appointment_date: null,
    appointment_time: null,
    status: "pending",
    user_confirmed: false,
    ...bookingState
  };

  // NOTE (ISSUE-01 REVERTED): Auto-seeding contact_info from senderPhone was
  // removed. WhatsApp now routes some connections through an @lid identifier
  // (a non-dialable opaque ID), so senderPhone cannot be relied upon as a real
  // phone number. The askContact waterfall step is intentionally preserved to
  // force the user to type their actual contact number or email manually.

  // 🚀 Dynamic local timezone locking
  const today = new Date().toLocaleString('en-US', { 
    timeZone: 'Africa/Casablanca',
    dateStyle: 'full', 
    timeStyle: 'short' 
  });
  
  const liveCatalog = await fetchCompanyCatalogFromDB();

  // 2. Extract Entities
  const prompt = `
    You are a SILENT AI data extractor for a booking system. 
    Analyze the User's Message and update the Current State.
    
    Today's Date is: ${today}
    USER'S WHATSAPP PHONE NUMBER: "${senderPhone}"
    BUSINESS/BOT PHONE NUMBER: "${botPhone}"
    ACTIVE CONVERSATION LANGUAGE: "${language}"

    CRITICAL LANGUAGE LOCK:
    You MUST generate 'ai_direct_reply' strictly in the ACTIVE CONVERSATION LANGUAGE ("${language}"). 
    - If the language is 'darija', use Moroccan Arabic written in Latin letters (e.g., "Nhar w w9t..."). It is FORBIDDEN to use French when 'darija' is active.

    AVAILABLE CATALOG (Services & Specialists with mapped service IDs):
    ${JSON.stringify(liveCatalog)}

    CONVERSATION HISTORY:
    ${history.map(item => `${item.role}: ${item.parts[0].text}`).join("\n")}
    
    CURRENT BOOKING STATE: 
    ${JSON.stringify(currentBookingState)}
    
    User's Message: "${message}"

    Rules & Validations:
    - Update the JSON with any new information provided.
    - SPECIALIST VALIDATION & "FIRST AVAILABLE": Check the AVAILABLE CATALOG mapping. If a user asks for "first available", pick a specialist whose 'services' array contains the requested service ID. 
    - SPECIALIST REJECTION: If a user rejects a specialist, check if anyone else provides that service. If NO ONE else is available for that service, keep 'specialist_name' as null and explicitly tell the user in 'ai_direct_reply' that this specialist is the only one who handles this service.
    - SPLIT DATE & TIME: Extract 'appointment_date' (YYYY-MM-DD) first. Do NOT extract an appointment time unless the user specifies a precise hour. 
    - STRICT TIME RULE: Vague time words (like "morning", "afternoon", "sbah", "lil") are NOT valid appointment times. Keep 'appointment_time' as null until an exact hour is given.
    - SENDER PHONE RESOLUTION: If the user refers to their current chat line ("this number", "my number"), extract their actual phone number ("${senderPhone}") into 'contact_info'.
    - STRICT CONTACT FORMAT & TROLL PROTECTION: 'contact_info' MUST be perfectly formatted. 
      * For Phone: Only numbers, optional spaces, and an optional leading '+'. Reject obvious fake numbers (e.g., 12345678) AND the business's own phone number ("${botPhone}").
      * For Email: MUST contain EXACTLY ONE '@' symbol, and end with a valid domain. Do NOT accept multiple '@' symbols. 
      * If invalid, keep 'contact_info' as null and use 'ai_direct_reply' to politely ask for a real format.
    - STRICT CONFIRMATION RULE: ONLY set "user_confirmed" to true IF the user is explicitly confirming the FINAL summary of all their details. Do NOT set it to true if they are just saying "yes" or "oui" in the middle of the conversation. If ANY of the core fields (customer_name, contact_info, appointment_date, appointment_time) are null, "user_confirmed" MUST remain false.
    - IF the user corrects a detail, update that field and ensure "user_confirmed" remains false.
    - STRICT TONE RULE: DO NOT start your responses with greetings (like "Ahlan", "Salam") if conversation history exists.
    
    JSON STATE CARRYOVER (STRICT): 
    - You are acting as a state machine. If a field is already filled, assume it is locked in. Copy that exact value into your current JSON response.
    - NEVER leave 'service_requested' empty if it was already established.
    - NEVER extract generic conversational words ('dispo', 'yes', 'specialist', 'awl whd', 'oui') as a 'service_requested'.
    
    Q&A & DYNAMIC REPLIES (STRICT RULES):
    - YOU ARE NOT A CHATBOT. Do not ask the user for missing booking info.
    - ONLY populate the 'ai_direct_reply' field IF the user explicitly asks a direct question OR if a validation error occurs.
    - CATALOG FORMATTING RULE: When a user asks what services are available, you MUST explicitly pair each service with the specialists who provide it, reading the ID mappings from the catalog. Formulate this STRICTLY in the ACTIVE CONVERSATION LANGUAGE.

    Respond strictly with a valid JSON object matching EXACTLY this schema:
    {
      "customer_name": "<string or null>",
      "contact_info": "<valid phone/email string or null>",
      "specialist_name": "<string or null>",
      "service_requested": "<string or null>",
      "appointment_date": "<YYYY-MM-DD or null>",
      "appointment_time": "<exact time string or null>",
      "user_confirmed": <boolean true or false>,
      "ai_direct_reply": "<string for warnings/Q&A, or null>"
    }
  `;

  try {
    const rawAiText = await callAI(prompt, { jsonMode: true });
    const extractedData = JSON.parse(rawAiText);
    
    const { ai_direct_reply, ...stateData } = extractedData;
    currentBookingState = { ...currentBookingState, ...stateData };
    
    if (ai_direct_reply) {
      currentBookingState._temp_reply = ai_direct_reply;
    }

  } catch (error) {
    console.error("Booking Extraction Error:", error);
    return {
      reply: getLocaleString(strings.booking.extractionError, language),
      needsHandover: false,
      newContext: { bookingState: currentBookingState }
    };
  }

  // 3. Waterfall Validation
  let botReply = "";
  let isComplete = false;
  let adminAlertMsg = null; // 🚀 FIXED: Declared at the correct scope level!
  const lang = language || 'fr'; 

  // Always clean up the ephemeral reply field before any branch returns.
  // Without this, _temp_reply leaks into the persisted bookingState in the gateway
  // and can ghost-fire on a future message turn. [CRIT-5 fix]
  const tempReply = currentBookingState._temp_reply || null;
  delete currentBookingState._temp_reply;

  // 🚀 THE MAGIC OVERRIDE (FIXED ORDER OF OPERATIONS)

  // FIXED [CRIT-4]: Hard server-side guard. LLM prompts are a soft constraint —
  // a hallucinating or jailbroken model could return user_confirmed=true with null
  // fields. This gate vetoes that and forces the waterfall to re-ask the missing field.
  const allRequiredFieldsPresent =
    currentBookingState.customer_name &&
    currentBookingState.contact_info &&
    currentBookingState.appointment_date &&
    currentBookingState.appointment_time;

  if (currentBookingState.user_confirmed && !allRequiredFieldsPresent) {
    console.error("⚠️ State machine guard: LLM set user_confirmed=true with missing fields. Vetoing.");
    currentBookingState.user_confirmed = false;
  }

  // 1. Highest Priority: If the user explicitly confirmed, finalize and trigger the Calendar
  if (currentBookingState.user_confirmed) {
    currentBookingState.status = "confirmed";
    isComplete = true;
    botReply = getLocaleString(strings.booking.finalConfirm, lang, currentBookingState.contact_info);
    
    // 🚀 THE CALENDAR EVENT TRIGGER
    try {
      const calendarLink = await insertEvent(currentBookingState, ioContext);
      
      // ✅ Mark as synced for your future database/dashboard
      currentBookingState.calendar_synced = true; 

      if (calendarLink) {
        botReply += getLocaleString(strings.booking.calendarAppend, lang, calendarLink);
      }
    } catch (error) {
      console.error("Failed to generate Google Calendar link:", error);
      
      // ❌ Flag as failed so it pops up as an error on your future dashboard
      currentBookingState.calendar_synced = false;
      
      // 🚨 Draft the emergency text message for the admin
      adminAlertMsg = `⚠️ URGENT: Calendar sync failed for ${currentBookingState.customer_name}. Please add manually. \nDate: ${currentBookingState.appointment_date}\nTime: ${currentBookingState.appointment_time}\nContact: ${currentBookingState.contact_info}`;
    }
  }
  // 2. Medium Priority: If not confirmed yet, did the AI generate a custom Q&A/Warning?
  else if (tempReply) {
    botReply = tempReply;
  }
  // 3. Lowest Priority: The standard hardcoded fallback questions
  else if (!currentBookingState.service_requested) botReply = getLocaleString(strings.booking.askService, lang);
  else if (!currentBookingState.specialist_name) botReply = getLocaleString(strings.booking.askSpecialist, lang, currentBookingState.service_requested);
  else if (!currentBookingState.appointment_date) botReply = getLocaleString(strings.booking.askDate, lang, currentBookingState.service_requested);
  else if (!currentBookingState.appointment_time) botReply = getLocaleString(strings.booking.askTime, lang);
  else if (!currentBookingState.customer_name) botReply = getLocaleString(strings.booking.askName, lang);
  else if (!currentBookingState.contact_info) botReply = getLocaleString(strings.booking.askContact, lang);
  else if (!currentBookingState.user_confirmed) botReply = getLocaleString(strings.booking.askConfirmation, lang, currentBookingState);

  return {
    reply: botReply,
    needsHandover: false,
    adminAlert: adminAlertMsg,
    newContext: isComplete ? null : { bookingState: currentBookingState }
  };
}
import { callAI } from '../services/ai/llmClient.js';
import { insertEvent } from '../services/calendarService.js'; 
import { strings, getLocaleString } from '../locales/strings.js';
import { syncAppointment } from '../services/sessionSyncService.js';
import { minifyState } from '../utils/stateMinifier.js';
import { getConfig } from '../services/configService.js';

async function fetchCompanyCatalogFromDB() {
  try {
    const baseUrl = (await getConfig('DASHBOARD_API_URL')) || process.env.DASHBOARD_API_URL || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/business/services`);
    if (!response.ok) {
      console.error(`[BookingHandler] Failed to fetch services: ${response.statusText}`);
      return { services: [], specialists: [] };
    }
    const data = await response.json();
    return { services: data.services || [], specialists: [] };
  } catch (error) {
    console.error(`[BookingHandler] Error fetching services:`, error.message);
    return { services: [], specialists: [] };
  }
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

  const recentHistory = Array.isArray(history) ? history.slice(-3) : [];
  const minifiedPromptState = minifyState(currentBookingState);

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
    - STRICT SERVICE GROUNDING: You must present the EXACT list of services provided in the context. Do NOT omit any services. Do NOT invent, guess, or offer any services that are not explicitly listed in the injected catalog.

    CONVERSATION HISTORY:
    ${recentHistory.map(item => `${item.role}: ${item.parts[0].text}`).join("\n")}
    
    CURRENT BOOKING STATE: 
    ${JSON.stringify(minifiedPromptState)}
    
    User's Message: "${message}"

    Rules & Validations:
    - Update the JSON with any new information provided.
    - SPECIALIST SELECTION & AUTO-ASSIGNMENT: Check the AVAILABLE CATALOG mapping. If the user names a specialist, use that name. If the user asks for "first available" or proceeds to specify date, time, name, or contact without specifying a specialist, automatically pick the first available specialist whose 'services' array contains the requested service ID (e.g., Sarah for Database Optimization).
    - SPECIALIST REJECTION: If a user rejects a specialist, check if anyone else provides that service. If NO ONE else is available for that service, keep 'specialist_name' as null and explicitly tell the user in 'ai_direct_reply' that this specialist is the only one who handles this service.
    - DARIJA TIME PARSING & SLOT FILLING: Note that users will speak Moroccan Darija. Words like "ghada" or "ghda" mean "tomorrow" and refer to the appointment DATE, NOT the user's name.
    - SPLIT DATE & TIME: Convert relative date terms ("Ghada", "demain", "tomorrow") into exact YYYY-MM-DD format based on Today's Date. "Ghada" means tomorrow. Extract 'appointment_date' (YYYY-MM-DD) first. When the user specifies an hour (e.g., "10", "f 10", "10h", "at 10", "10:00"), extract it as a formatted time string (e.g., "10:00").
    - STRICT TIME RULE: Vague time words without a specific number (like "morning", "afternoon", "sbah", "lil") are NOT valid appointment times. Keep 'appointment_time' as null until a specific hour is given. Explicit numbers like "10", "f 10", "10h" ARE valid exact hours ("10:00").
    - SENDER PHONE RESOLUTION: If the user refers to their current chat line ("this number", "my number"), extract their actual phone number ("${senderPhone}") into 'contact_info'.
    - STRICT CONTACT FORMAT & TROLL PROTECTION: 'contact_info' MUST be perfectly formatted. 
      * For Phone: Only numbers, optional spaces, and an optional leading '+'. Reject obvious fake numbers (e.g., 12345678) AND the business's own phone number ("${botPhone}").
      * For Email: MUST contain EXACTLY ONE '@' symbol, and end with a valid domain. Do NOT accept multiple '@' symbols. 
      * If invalid, keep 'contact_info' as null and use 'ai_direct_reply' to politely ask for a real format.
    - STRICT CONFIRMATION RULE: If all core fields (customer_name, contact_info, appointment_date, appointment_time) are already filled in CURRENT BOOKING STATE and the user responds with any confirmation/agreement word (e.g., "Oui kolchi mzian", "Oui", "Kolchi mzian", "C'est bon", "Confirmed", "Yes", "Ok"), you MUST set "user_confirmed": true and set "ai_direct_reply": null. Do NOT set "user_confirmed": true if any required field is still null.
    - IF the user corrects a detail, update that field and ensure "user_confirmed" remains false.
    - STRICT TONE RULE: DO NOT start your responses with greetings (like "Ahlan", "Salam") if conversation history exists.
    
    - CUSTOMER NAME EXTRACTION: When the user provides a name (e.g., "Zayd", "Karim", "John"), extract it directly into 'customer_name'.
    - JSON STATE CARRYOVER (STRICT & CRITICAL): You are acting as a persistent state machine. If a field in CURRENT BOOKING STATE is already filled (not null), you MUST copy that exact value into your response. NEVER overwrite or reset an already filled field to null unless the user explicitly asks to cancel or change it.
    - NEVER leave 'service_requested' empty if it was already established.
    - NEVER extract generic conversational words ('dispo', 'yes', 'specialist', 'awl whd', 'oui') as a 'service_requested'.
    
    Q&A & COLLECTION FLOW (STRICT SEQUENTIAL RULES):
    - You are a CONVERSATIONAL data collector. You must collect information ONE step at a time. 1. Ask for the service. 2. Ask for the date and time. 3. Explicitly ask for the user's full name and wait for their reply. 4. Ask for contact info. NEVER fill in the user's name without explicitly asking them for it first.
    - REQUIRED FIELDS (in collection order): service_requested → specialist_name → appointment_date → appointment_time → customer_name → contact_info → user_confirmed.
    - MISSING FIELD HANDLING: If the user's message fills one field but other required fields are still null, set 'ai_direct_reply' to politely ask for the NEXT missing field. Do NOT silently skip fields.
    - contact_info IS STRICTLY REQUIRED. Never proceed to confirmation if contact_info is null. If the user gives only their name, ask for their phone number or email next.
    - CATALOG FORMATTING RULE: When a user asks what services are available, you MUST explicitly pair each service with the specialists who provide it, reading the ID mappings from the catalog. Formulate this STRICTLY in the ACTIVE CONVERSATION LANGUAGE.

    ====================================================================
    BOOKING CONFIRMATION GATING RULE — READ THIS CAREFULLY:
    ====================================================================
    You MUST NOT set "user_confirmed": true UNLESS ALL of the following conditions are true SIMULTANEOUSLY:
      1. customer_name    is a non-null, non-empty string in the CURRENT BOOKING STATE.
      2. contact_info     is a non-null, non-empty string in the CURRENT BOOKING STATE.
      3. service_requested is a non-null, non-empty string in the CURRENT BOOKING STATE.
      4. appointment_date  is a non-null YYYY-MM-DD string in the CURRENT BOOKING STATE.
      5. appointment_time  is a non-null time string in the CURRENT BOOKING STATE.
      6. The user's CURRENT message is an EXPLICIT, UNAMBIGUOUS confirmation of the booking summary
         (e.g., "Oui", "Yes", "Ok", "C'est bon", "Confirmed", "Kolchi mzian", "Oui kolchi mzian", "d'accord").
         A user's name, phone number, or any data-providing message is NOT a confirmation.

    If ANY of conditions 1–5 is not yet met, you MUST set "user_confirmed": false and populate
    'ai_direct_reply' asking for the NEXT missing field — even if the user used a word that sounds like confirmation.
    ====================================================================

    Respond strictly with a valid JSON object matching EXACTLY this schema.
    Fields marked [REQUIRED] must NEVER be null when user_confirmed is true:
    {
      "customer_name":      "<string or null>",
      "contact_info":       "<valid phone/email string or null>  [REQUIRED for confirmation]",
      "specialist_name":    "<string or null>",
      "service_requested":  "<string or null>",
      "appointment_date":   "<YYYY-MM-DD or null>  [REQUIRED for confirmation]",
      "appointment_time":   "<exact time string or null>  [REQUIRED for confirmation]",
      "user_confirmed":     <boolean — MUST be false unless ALL 6 gating conditions above are met>,
      "ai_direct_reply":    "<string asking for the next missing field, or confirmation summary, or null>"
    }
  `;

  try {
    const rawAiText = await callAI(prompt, { jsonMode: true });
    const extractedData = JSON.parse(rawAiText);
    
    const { ai_direct_reply, ...stateData } = extractedData;
    for (const [key, val] of Object.entries(stateData)) {
      if (val !== null && val !== undefined) {
        currentBookingState[key] = val;
      }
    }
    
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

  // Server-side confirmation fallback guard:
  // If all required fields are present and the user's message is an UNAMBIGUOUS, EXACT confirmation phrase,
  // force user_confirmed to true.
  // ⚠️  The regex must ONLY match standalone confirmation words — NOT partial matches such as an
  //     email address that contains "confirm" (e.g., "confirmation@mail.com") or any data message.
  if (allRequiredFieldsPresent && !currentBookingState.user_confirmed) {
    const textLower = message.trim().toLowerCase();
    // Anchored full-string match: only exact, unambiguous confirmation phrases trigger this guard.
    const isConfirmationText = /^(oui|yes|ok|c'est bon|confirmed|kolchi mzian|oui kolchi mzian|d'accord|parfait|mzian|nhaar)$/i.test(textLower);
    if (isConfirmationText) {
      currentBookingState.user_confirmed = true;
    }
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

      // 🚀 THE DATABASE EVENT TRIGGER
      await syncAppointment(currentBookingState);

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
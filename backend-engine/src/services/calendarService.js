// src/services/calendarService.js
import { google } from 'googleapis';
import { getConfig } from './configService.js';

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG HELPER
// Performs a best-effort name-match against the mock catalog to resolve the
// numeric IDs and department expected by the bot:booking_created payload.
// When the DB is live, this will be replaced by a single query joining the
// Services and Specialists tables.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveCatalogIds(bookingState) {
  // TODO: replace with real DB query when catalog tables are ready.
  const catalog = {
    services: [
      { id: 1, name: 'Database Optimization', department: 'it' },
      { id: 2, name: 'Server Configuration',  department: 'it' },
      { id: 3, name: 'UI/UX Review',           department: 'design' },
    ],
    specialists: [
      { id: 101, name: 'Sarah', services: [1, 2] },
      { id: 102, name: 'Alex',  services: [1] },
      { id: 103, name: 'Karim', services: [3] },
    ],
  };

  const serviceName    = bookingState.service_requested || '';
  const specialistName = bookingState.specialist_name   || '';

  const service    = catalog.services.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
  const specialist = catalog.specialists.find(s => s.name.toLowerCase() === specialistName.toLowerCase());

  return {
    serviceId:    service?.id    ?? null,
    specialistId: specialist?.id ?? null,
    department:   service?.department ?? null,
  };
}

/**
 * Inserts a new booking into the Google Calendar.
 *
 * Credentials are fetched via getConfig() on every call so the dashboard can
 * update them without a server restart. The GoogleAuth client is therefore
 * constructed lazily inside this function rather than at module-load time.
 *
 * After a successful insert, emits `bot:booking_created` via Socket.io so the
 * dashboard can update its bookings panel in real time.
 *
 * Environment variables used (all configurable via configService in the future):
 *   GOOGLE_CLIENT_EMAIL   — Service account client_email from calendar-key.json
 *   GOOGLE_PRIVATE_KEY    — Service account private_key from calendar-key.json
 *   CALENDAR_ID           — Target Google Calendar ID
 *
 * @param {Object} bookingState          - The locked booking state from WhatsApp.
 * @param {Object} [ioContext]           - Optional Socket.io context for real-time emission.
 * @param {Object} [ioContext.io]        - The Socket.io server instance.
 * @param {string} [ioContext.sessionKey] - The room/session key to emit into.
 * @returns {Promise<string>}            - The Google Calendar event HTML link.
 */
export async function insertEvent(bookingState, { io, sessionKey } = {}) {
  // 1. Fetch credentials and config at call time (future: from DB via configService)
  const calendarId  = await getConfig('CALENDAR_ID');
  const clientEmail = await getConfig('GOOGLE_CLIENT_EMAIL');
  const privateKey  = await getConfig('GOOGLE_PRIVATE_KEY');

  // 2. Build auth client from config-sourced credentials.
  //    Using `credentials` instead of `keyFile` keeps the setup database-ready:
  //    when getConfig() is backed by a DB, no file access is needed at all.
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : undefined,
    },
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    // 3. Format the Date and Time for Google Calendar
    const startDateTime = new Date(`${bookingState.appointment_date}T${bookingState.appointment_time}:00`);

    // Automatically set the appointment duration to 1 hour
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const event = {
      summary: `${bookingState.service_requested} - ${bookingState.customer_name}`,
      description: `Specialist: ${bookingState.specialist_name}\nContact: ${bookingState.contact_info}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Africa/Casablanca',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Africa/Casablanca',
      },
    };

    // 4. Insert the event into the calendar
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });
    // 5. Emit bot:booking_created to the dashboard in real time
    if (io && sessionKey) {
      // Resolve catalog IDs for the structured event payload
      const { serviceId, specialistId, department } = await resolveCatalogIds(bookingState);

      io.to(sessionKey).emit('bot:booking_created', {
        event:           'bot:booking_created',
        customerName:    bookingState.customer_name,
        contactInfo:     bookingState.contact_info,
        department,
        serviceId,
        specialistId,
        appointmentDate: bookingState.appointment_date,
        // Normalize time to HH:MM:SS (pad with :00 if only HH:MM was stored)
        appointmentTime: bookingState.appointment_time.includes(':')
          && bookingState.appointment_time.split(':').length === 2
          ? `${bookingState.appointment_time}:00`
          : bookingState.appointment_time,
        timestamp: new Date().toISOString(),
      });
    }

    return response.data.htmlLink;

  } catch (error) {
    console.error('❌ Error inserting calendar event:', error);
    throw error;
  }
}
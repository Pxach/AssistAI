// src/services/bookingHandler.js
//
// Dashboard-side booking helper.
//
// ─── Phase 2 Note ─────────────────────────────────────────────────────────────
// The previous implementation matched against a hardcoded mock catalog imported
// from `data/mockBookingData.js` (now deleted). That file has been removed as
// part of the Phase 1 mock data cleanup.
//
// The real services/specialists catalog will be seeded from the document
// ingestion pipeline (POST /api/business/upload) in Phase 2. At that point,
// processBookingRequest should query the DB tables instead.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * processBookingRequest
 *
 * Accepts a raw booking input object and returns a normalised booking record
 * ready for DB insertion via appointmentController.
 *
 * TODO (Phase 2): replace this stub with real catalog DB lookups:
 *   const matchedService = await db('services').where({ name: input.service_name }).first();
 *   const matchedSpecialist = await db('specialists').where({ name: input.specialist_name }).first();
 *
 * @param {object} input - Raw booking fields from the request body.
 * @returns {object}     - Normalised booking result object.
 */
export function processBookingRequest(input) {
  const {
    customer_name,
    contact_info,
    service_name,
    specialist_name,
    appointment_date,
    appointment_time,
  } = input;

  // Phase 2: catalog matching will be implemented once the DB is seeded
  // via the /api/business/upload ingestion pipeline.
  return {
    customer_name: customer_name || 'Pending',
    contact_info: contact_info || 'Pending',
    department: 'general',
    specialist_id: null,
    specialist_name: specialist_name || null,
    service_id: null,
    service_requested: service_name || null,
    appointment_date: appointment_date || null,
    appointment_time: appointment_time || null,
    duration_minutes: 60,
    status: 'pending',
    review_prompt_sent: false,
  };
}
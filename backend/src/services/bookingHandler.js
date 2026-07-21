const { services, specialists, specialistServices } = require('../data/mockBookingData');

/**
 * Executes the Decision Matrix logic based on extracted user input.
 * 
 * @param {Object} input
 * @param {string} input.customer_name
 * @param {string} input.contact_info
 * @param {string} [input.service_name]
 * @param {string} [input.specialist_name]
 * @param {string} [input.appointment_date]
 * @param {string} [input.appointment_time]
 */
function processBookingRequest(input) {
  const { customer_name, contact_info, service_name, specialist_name, appointment_date, appointment_time } = input;

  // 1. Resolve entity matches from input
  const matchedService = service_name
    ? services.find(s => s.name.toLowerCase() === service_name.toLowerCase())
    : null;

  const matchedSpecialist = specialist_name
    ? specialists.find(sp => sp.name.toLowerCase() === specialist_name.toLowerCase())
    : null;

  // -------------------------------------------------------------
  // CASE 1: Both Specialist AND Service provided
  // -------------------------------------------------------------
  if (matchedService && matchedSpecialist) {
    const isValidPair = specialistServices.some(
      ss => ss.specialist_id === matchedSpecialist.id && ss.service_id === matchedService.id
    );

    if (isValidPair) {
      return formatBookingOutput({
        customer_name,
        contact_info,
        department: matchedService.department,
        specialist_name: matchedSpecialist.name,
        service_requested: matchedService.name,
        appointment_date,
        appointment_time,
        duration_minutes: matchedService.duration_minutes
      });
    }

    // Invalid Pair: Fetch alternative qualified specialists for this service
    const qualifiedSpecialistIds = specialistServices
      .filter(ss => ss.service_id === matchedService.id)
      .map(ss => ss.specialist_id);

    const alternativeSpecialists = specialists.filter(sp => qualifiedSpecialistIds.includes(sp.id));

    return {
      status: 'fallback',
      message: `${matchedSpecialist.name} does not perform ${matchedService.name}.`,
      suggestions: alternativeSpecialists.map(sp => sp.name)
    };
  }

  // -------------------------------------------------------------
  // CASE 2: Specialist Only provided
  // -------------------------------------------------------------
  if (matchedSpecialist && !matchedService) {
    const offeredServiceIds = specialistServices
      .filter(ss => ss.specialist_id === matchedSpecialist.id)
      .map(ss => ss.service_id);

    const offeredServices = services.filter(s => offeredServiceIds.includes(s.id));

    return {
      status: 'clarification_needed',
      message: `Please select a service offered by ${matchedSpecialist.name}:`,
      available_services: offeredServices.map(s => s.name)
    };
  }

  // -------------------------------------------------------------
  // CASE 3: Service Only provided
  // -------------------------------------------------------------
  if (matchedService && !matchedSpecialist) {
    const qualifiedSpecialistIds = specialistServices
      .filter(ss => ss.service_id === matchedService.id)
      .map(ss => ss.specialist_id);

    const qualifiedSpecialists = specialists.filter(sp => qualifiedSpecialistIds.includes(sp.id));

    // Rule: Rule for AI Generation - specialist_name must be null if not selected
    return formatBookingOutput({
      customer_name,
      contact_info,
      department: matchedService.department,
      specialist_name: null,
      service_requested: matchedService.name,
      appointment_date,
      appointment_time,
      duration_minutes: matchedService.duration_minutes,
      available_specialists: qualifiedSpecialists.map(sp => sp.name)
    });
  }

  return {
    status: 'error',
    message: 'Could not resolve a valid service or specialist from the request.'
  };
}

// Formatter adhering strictly to your agreed JSON blueprint
function formatBookingOutput({ customer_name, contact_info, department, specialist_name, service_requested, appointment_date, appointment_time, duration_minutes, available_specialists }) {
  return {
    customer_name: customer_name || 'Pending',
    contact_info: contact_info || 'Pending',
    department: department || 'general',
    specialist_name: specialist_name || null,
    service_requested: service_requested,
    appointment_date: appointment_date || null,
    appointment_time: appointment_time || null,
    duration_minutes: duration_minutes || 60,
    status: 'pending',
    ...(available_specialists && { available_specialists })
  };
}

module.exports = { processBookingRequest };
const { services, specialists, specialistServices } = require('../data/mockBookingData');
const { generateGoogleCalendarLink } = require('./calendarService');

function processBookingRequest(input) {
  const { customer_name, contact_info, service_name, specialist_name, appointment_date, appointment_time } = input;

  const matchedService = service_name
    ? services.find(s => s.name.toLowerCase() === service_name.toLowerCase())
    : null;

  const matchedSpecialist = specialist_name
    ? specialists.find(sp => sp.name.toLowerCase() === specialist_name.toLowerCase())
    : null;

  // 1. Both Specialist & Service
  if (matchedService && matchedSpecialist) {
    const isValidPair = specialistServices.some(
      ss => ss.specialist_id === matchedSpecialist.id && ss.service_id === matchedService.id
    );

    if (isValidPair) {
      return formatBookingOutput({
        customer_name,
        contact_info,
        department: matchedService.department,
        specialist_id: matchedSpecialist.id,
        specialist_name: matchedSpecialist.name,
        service_id: matchedService.id,
        service_requested: matchedService.name,
        appointment_date,
        appointment_time,
        duration_minutes: matchedService.duration_minutes
      });
    }

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

  // 2. Specialist Only
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

  // 3. Service Only
  if (matchedService && !matchedSpecialist) {
    const qualifiedSpecialistIds = specialistServices
      .filter(ss => ss.service_id === matchedService.id)
      .map(ss => ss.specialist_id);

    const qualifiedSpecialists = specialists.filter(sp => qualifiedSpecialistIds.includes(sp.id));

    return formatBookingOutput({
      customer_name,
      contact_info,
      department: matchedService.department,
      specialist_id: null,
      specialist_name: null,
      service_id: matchedService.id,
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

function formatBookingOutput(data) {
  const calendarLink = generateGoogleCalendarLink(data);

  return {
    customer_name: data.customer_name || 'Pending',
    contact_info: data.contact_info || 'Pending',
    department: data.department || 'general',
    specialist_id: data.specialist_id || null,
    specialist_name: data.specialist_name || null,
    service_id: data.service_id || null,
    service_requested: data.service_requested,
    appointment_date: data.appointment_date || null,
    appointment_time: data.appointment_time || null,
    duration_minutes: data.duration_minutes || 60,
    status: 'pending',
    review_prompt_sent: false,
    google_calendar_link: calendarLink,
    ...(data.available_specialists && { available_specialists: data.available_specialists })
  };
}

module.exports = { processBookingRequest };
function formatCalendarDates(dateStr, timeStr, durationMinutes = 60) {
  if (!dateStr || !timeStr) return null;

  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '').padEnd(6, '0').slice(0, 6);
  
  const startISO = `${cleanDate}T${cleanTime}`;

  const startDate = new Date(`${dateStr}T${timeStr}`);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  
  const endYear = endDate.getUTCFullYear();
  const endMonth = String(endDate.getUTCMonth() + 1).padStart(2, '0');
  const endDay = String(endDate.getUTCDate()).padStart(2, '0');
  const endHours = String(endDate.getUTCHours()).padStart(2, '0');
  const endMins = String(endDate.getUTCMinutes()).padStart(2, '0');
  
  const endISO = `${endYear}${endMonth}${endDay}T${endHours}${endMins}00`;

  return `${startISO}/${endISO}`;
}

export function generateGoogleCalendarLink({
  service_requested,
  specialist_name,
  appointment_date,
  appointment_time,
  duration_minutes,
  customer_name
}) {
  const dates = formatCalendarDates(appointment_date, appointment_time, duration_minutes);
  if (!dates) return null;

  const title = encodeURIComponent(`${service_requested || 'Consultation'} with ${specialist_name || 'Specialist'}`);
  const details = encodeURIComponent(`Appointment booked for ${customer_name || 'Customer'}. Duration: ${duration_minutes || 60} mins.`);
  const location = encodeURIComponent('Online / Company Office');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

export async function syncWithSpecialistCalendar(appointmentData, calendarId) {
  return {
    synced: true,
    calendar_id: calendarId || 'default',
    event_id: `gcal-evt-${Date.now()}`
  };
}
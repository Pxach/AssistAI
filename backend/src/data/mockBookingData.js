export const services = [
  { id: 1, name: 'UI/UX Review', department: 'it', duration_minutes: 45 },
  { id: 2, name: 'Database Optimization', department: 'it', duration_minutes: 60 },
  { id: 3, name: 'Code Audit', department: 'it', duration_minutes: 30 },
  { id: 4, name: 'Financial Consultation', department: 'finance', duration_minutes: 60 }
];

export const specialists = [
  { id: 1, name: 'Sarah', department: 'it', calendar_id: 'sarah@company.com' },
  { id: 2, name: 'Karim', department: 'it', calendar_id: 'karim@company.com' },
  { id: 3, name: 'Lina', department: 'finance', calendar_id: 'lina@company.com' }
];

export const specialistServices = [
  { specialist_id: 1, service_id: 1 }, // Sarah -> UI/UX Review
  { specialist_id: 1, service_id: 3 }, // Sarah -> Code Audit
  { specialist_id: 2, service_id: 2 }, // Karim -> Database Optimization
  { specialist_id: 2, service_id: 3 }, // Karim -> Code Audit
  { specialist_id: 3, service_id: 4 }  // Lina  -> Financial Consultation
];

export let mockAppointments = [
  {
    id: 1,
    customer_name: 'John Doe',
    contact_info: 'john@example.com',
    department: 'it',
    specialist_id: 1,
    service_id: 1,
    appointment_date: '2026-07-25',
    appointment_time: '10:00:00',
    status: 'completed',
    review_prompt_sent: false,
    created_at: new Date().toISOString()
  }
];
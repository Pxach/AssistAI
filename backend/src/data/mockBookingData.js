// Mock dataset mirroring the PostgreSQL tables
const services = [
  { id: 1, name: 'UI/UX Review', department: 'it', duration_minutes: 45 },
  { id: 2, name: 'Database Optimization', department: 'it', duration_minutes: 60 },
  { id: 3, name: 'Code Audit', department: 'it', duration_minutes: 30 },
  { id: 4, name: 'Financial Consultation', department: 'finance', duration_minutes: 60 }
];

const specialists = [
  { id: 101, name: 'Sarah', department: 'it', calendar_id: 'sarah@company.com' },
  { id: 102, name: 'Karim', department: 'it', calendar_id: 'karim@company.com' },
  { id: 103, name: 'Lina', department: 'finance', calendar_id: 'lina@company.com' }
];

// Junction table: Mapping specialist capabilities to services
const specialistServices = [
  { specialist_id: 101, service_id: 1 }, // Sarah -> UI/UX Review
  { specialist_id: 101, service_id: 3 }, // Sarah -> Code Audit
  { specialist_id: 102, service_id: 2 }, // Karim -> Database Optimization
  { specialist_id: 102, service_id: 3 }, // Karim -> Code Audit
  { specialist_id: 103, service_id: 4 }  // Lina  -> Financial Consultation
];

module.exports = {
  services,
  specialists,
  specialistServices
};
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries in child -> parent order
  await knex('specialist_services').del();
  await knex('specialists').del();
  await knex('services').del();

  // 1. Insert Services
  const [s1, s2, s3, s4] = await knex('services').insert([
    { name: 'UI/UX Review', department: 'it', duration_minutes: 45 },
    { name: 'Database Optimization', department: 'it', duration_minutes: 60 },
    { name: 'Code Audit', department: 'it', duration_minutes: 30 },
    { name: 'Financial Consultation', department: 'finance', duration_minutes: 60 }
  ]).returning('id');

  // 2. Insert Specialists
  const [sp1, sp2, sp3] = await knex('specialists').insert([
    { name: 'Sarah', department: 'it', calendar_id: 'sarah@company.com' },
    { name: 'Karim', department: 'it', calendar_id: 'karim@company.com' },
    { name: 'Lina', department: 'finance', calendar_id: 'lina@company.com' }
  ]).returning('id');

  // 3. Insert Specialist-Services Mappings
  await knex('specialist_services').insert([
    { specialist_id: sp1.id || sp1, service_id: s1.id || s1 }, // Sarah -> UI/UX Review
    { specialist_id: sp1.id || sp1, service_id: s3.id || s3 }, // Sarah -> Code Audit
    { specialist_id: sp2.id || sp2, service_id: s2.id || s2 }, // Karim -> Database Optimization
    { specialist_id: sp2.id || sp2, service_id: s3.id || s3 }, // Karim -> Code Audit
    { specialist_id: sp3.id || sp3, service_id: s4.id || s4 }  // Lina  -> Financial Consultation
  ]);
};
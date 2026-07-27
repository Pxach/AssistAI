import crypto from 'crypto';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  console.log('🧹 Clearing old data...');

  // 1. Clean existing data in reverse order of foreign key constraints
  await knex('Review').del();
  await knex('ChatLogs').del();
  await knex('ChatSession').del();
  await knex('appointments').del();
  await knex('specialist_services').del();
  await knex('specialists').del();
  await knex('services').del();
  await knex('Customer').del();
  await knex('AdminUser').del();
  await knex('Company').del();

  console.log('🌱 Seeding dashboard test data...');

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // 2. Seed Company
  const [company] = await knex('Company')
    .insert({
      Name: 'AssistAI Corp',
      Email: 'contact@assistai.com',
      WorkingAt: 'Main HQ'
    })
    .returning('*');

  // 3. Seed Admin User
  await knex('AdminUser').insert({
    CompanyID: company.CompanyID,
    Email: 'samwheeler@example.com',
    Password: 'hashedpassword123',
    Role: 'admin'
  });

  // 4. Seed Customers
  const customer1Id = crypto.randomUUID();
  const customer2Id = crypto.randomUUID();
  const customer3Id = crypto.randomUUID();
  const customer4Id = crypto.randomUUID();

  await knex('Customer').insert([
    { CustomerID: customer1Id, Name: 'Alice Smith', PhoneNumber: '+12345678901', PreferredLanguage: 'English' },
    { CustomerID: customer2Id, Name: 'Bob Johnson', PhoneNumber: '+19876543210', PreferredLanguage: 'Spanish' },
    { CustomerID: customer3Id, Name: 'Charlie Davis', PhoneNumber: '+15551234567', PreferredLanguage: 'English' },
    { CustomerID: customer4Id, Name: 'Diana Prince', PhoneNumber: '+15559876543', PreferredLanguage: 'French' }
  ]);

  // 5. Seed Services & Specialists
  const [service1, service2] = await knex('services')
    .insert([
      { name: 'Initial Consultation', department: 'Customer Support', duration_minutes: 30 },
      { name: 'Technical Diagnostics', department: 'Engineering', duration_minutes: 60 }
    ])
    .returning('*');

  const [specialist1] = await knex('specialists')
    .insert([
      { name: 'Dr. Sarah Connor', department: 'Customer Support', calendar_id: 'cal_sarah_123' }
    ])
    .returning('*');

  await knex('specialist_services').insert([
    { specialist_id: specialist1.id, service_id: service1.id }
  ]);

  // 6. Seed Appointments (For Total Bookings & CSV Export)
  await knex('appointments').insert([
    { 
      customer_name: 'Alice Smith', 
      contact_info: '+12345678901', 
      department: 'Customer Support', 
      specialist_id: specialist1.id, 
      service_id: service1.id, 
      appointment_date: '2026-07-24', 
      appointment_time: '10:00:00', 
      status: 'confirmed', 
      created_at: hoursAgo(2) 
    },
    { 
      customer_name: 'Bob Johnson', 
      contact_info: '+19876543210', 
      department: 'Engineering', 
      specialist_id: null, 
      service_id: service2.id, 
      appointment_date: '2026-07-25', 
      appointment_time: '14:30:00', 
      status: 'pending', 
      created_at: daysAgo(1) 
    },
    { 
      customer_name: 'Charlie Davis', 
      contact_info: '+15551234567', 
      department: 'Customer Support', 
      specialist_id: specialist1.id, 
      service_id: service1.id, 
      appointment_date: '2026-07-20', 
      appointment_time: '11:00:00', 
      status: 'completed', 
      created_at: daysAgo(5) 
    },
    { 
      customer_name: 'Diana Prince', 
      contact_info: '+15559876543', 
      department: 'Customer Support', 
      specialist_id: specialist1.id, 
      service_id: service1.id, 
      appointment_date: '2026-07-10', 
      appointment_time: '09:00:00', 
      status: 'completed', 
      created_at: daysAgo(15) 
    }
  ]);

  // 7. Seed Chat Sessions (Handover Deadlines Testing)
  await knex('ChatSession').insert([
    // RED BAR (< 3 hrs left): Created 22 hours ago -> 2 hours left
    { PhoneNumber: '+12345678901', Active: true, Handover: true, Sentiment: 'Negative', CreatedAt: hoursAgo(22) },
    
    // ORANGE BAR (3 to 10 hrs left): Created 14 hours ago -> 10 hours left
    { PhoneNumber: '+19876543210', Active: true, Handover: true, Sentiment: 'Neutral', CreatedAt: hoursAgo(14) },
    
    // GREEN BAR (> 10 hrs left): Created 2 hours ago -> 22 hours left
    { PhoneNumber: '+15551234567', Active: true, Handover: true, Sentiment: 'Positive', CreatedAt: hoursAgo(2) },
      // ORANGE BAR (3 to 10 hrs left): Created 14 hours ago -> 10 hours left
    { PhoneNumber: '+19876555210', Active: true, Handover: true, Sentiment: 'Neutral', CreatedAt: hoursAgo(14) },
    
    // GREEN BAR (> 10 hrs left): Created 2 hours ago -> 22 hours left
    { PhoneNumber: '+15551666567', Active: true, Handover: true, Sentiment: 'Positive', CreatedAt: hoursAgo(2) },
        // ORANGE BAR (3 to 10 hrs left): Created 14 hours ago -> 10 hours left
    { PhoneNumber: '+19576543210', Active: true, Handover: true, Sentiment: 'Neutral', CreatedAt: hoursAgo(14) },
    
    // GREEN BAR (> 10 hrs left): Created 2 hours ago -> 22 hours left
    { PhoneNumber: '+15551234557', Active: true, Handover: true, Sentiment: 'Positive', CreatedAt: hoursAgo(2) },
      // ORANGE BAR (3 to 10 hrs left): Created 14 hours ago -> 10 hours left
    { PhoneNumber: '+19876555550', Active: true, Handover: true, Sentiment: 'Neutral', CreatedAt: hoursAgo(14) },
    
    // GREEN BAR (> 10 hrs left): Created 2 hours ago -> 22 hours left
    { PhoneNumber: '+15551666565', Active: true, Handover: true, Sentiment: 'Positive', CreatedAt: hoursAgo(2) },
    
    // Inactive regular session
    { PhoneNumber: '+15559876543', Active: false, Handover: false, Sentiment: 'Positive', CreatedAt: daysAgo(4) }
  ]);

  // 8. Seed Chat Logs (Spread across time to populate Activity Chart)
  const sampleMessages = [
    'Hello, I would like to inquire about booking an appointment.',
    'Is there an available specialist today?',
    'I need human support regarding my service.',
    'Thank you for your help!'
  ];

  const chatLogs = [];
  const customers = [customer1Id, customer2Id, customer3Id, customer4Id];

  // Generates 40 chat logs spread over the last 120 days
  for (let i = 0; i < 40; i++) {
    const daysBack = Math.floor(Math.random() * 120);
    chatLogs.push({
      CustomerID: customers[i % customers.length],
      message: sampleMessages[i % sampleMessages.length],
      CreatedAt: daysAgo(daysBack)
    });
  }

  await knex('ChatLogs').insert(chatLogs);

  // 9. Seed Reviews
  await knex('Review').insert([
    { CustomerID: customer1Id, Rating: 5, ReviewText: 'Excellent support team!', Sentiment: 'Positive', Category: 'Bot Usability', CreatedAt: hoursAgo(4) },
    { CustomerID: customer2Id, Rating: 2, ReviewText: 'Delayed response on WhatsApp.', Sentiment: 'Negative', Category: 'Long Response Delay', CreatedAt: daysAgo(2) },
    { CustomerID: customer3Id, Rating: 4, ReviewText: 'Quick booking process.', Sentiment: 'Positive', Category: 'Booking System', CreatedAt: daysAgo(6) },
    { CustomerID: customer4Id, Rating: 1, ReviewText: 'Wrong availability slot selected.', Sentiment: 'Negative', Category: 'Wrong Availability Slot', CreatedAt: daysAgo(12) }
  ]);

  console.log('✨ Database populated successfully!');
}
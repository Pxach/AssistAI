/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // ---------------------------------------------------------------------------
  // 1. CREATE TABLES
  // ---------------------------------------------------------------------------
  await knex.schema
    // 1. Company Table
    .createTable('Company', (table) => {
      table.uuid('CompanyID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('Name').notNullable();
      table.string('Email').notNullable().unique();
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
      table.string('WorkingAt');
    })
    // 2. AdminUser Table
    .createTable('AdminUser', (table) => {
      table.uuid('AdminUserID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('CompanyID').references('CompanyID').inTable('Company').onDelete('CASCADE');
      table.string('Email').notNullable().unique();
      table.string('Password').notNullable();
      table.string('Role').defaultTo('admin');
    })
    // 3. WhatsApp Sessions Table (NEW: Tracks QR Pairing & Baileys Session State)
    .createTable('whatsapp_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').references('CompanyID').inTable('Company').onDelete('CASCADE').nullable();
      table.string('phone_number').nullable();
      table.string('status').defaultTo('DISCONNECTED'); // 'DISCONNECTED' | 'PAIRING' | 'CONNECTED'
      table.text('qr_code').nullable(); // Stores raw QR string or base64 image
      table.string('session_key').unique().defaultTo('default'); // Identifier used by Baileys for local auth folder
      table.timestamp('connected_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    // 4. Customer Table
    .createTable('Customer', (table) => {
      table.uuid('CustomerID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('PhoneNumber').notNullable().unique();
      table.string('Name');
      table.string('PreferredLanguage').defaultTo('English');
    })
    // 5. Services Table
    .createTable('services', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('department').notNullable();
      table.integer('duration_minutes').defaultTo(60);
    })
    // 6. Specialists Table
    .createTable('specialists', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('department').notNullable();
      table.string('calendar_id').nullable();
    })
    // 7. Specialist Services Junction Table
    .createTable('specialist_services', (table) => {
      table.integer('specialist_id').unsigned().notNullable()
        .references('id').inTable('specialists').onDelete('CASCADE');
      table.integer('service_id').unsigned().notNullable()
        .references('id').inTable('services').onDelete('CASCADE');
      table.primary(['specialist_id', 'service_id']);
    })
    // 8. Appointments Table
    .createTable('appointments', (table) => {
      table.increments('id').primary();
      table.string('customer_name').notNullable();
      table.string('contact_info').notNullable();
      table.string('department').notNullable();
      table.integer('specialist_id').unsigned().nullable()
        .references('id').inTable('specialists').onDelete('SET NULL');
      table.integer('service_id').unsigned().notNullable()
        .references('id').inTable('services').onDelete('CASCADE');
      table.date('appointment_date').notNullable();
      table.time('appointment_time').notNullable();
      table.string('status').defaultTo('pending');
      table.boolean('review_prompt_sent').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.boolean('reminder_sent').defaultTo(false);
    })
    // 9. ChatSession Table
    .createTable('ChatSession', (table) => {
      table.string('PhoneNumber').primary();
      table.boolean('Active').defaultTo(true);
      table.boolean('Handover').defaultTo(false);
      table.string('Status').defaultTo('active');
      table.string('Sentiment');
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
    })
    // 10. ChatLogs Table (UPDATED: Added sender_type & PhoneNumber reference for live intervention)
    .createTable('ChatLogs', (table) => {
      table.uuid('ChatID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('CustomerID').references('CustomerID').inTable('Customer').onDelete('CASCADE').nullable();
      table.string('PhoneNumber').references('PhoneNumber').inTable('ChatSession').onDelete('CASCADE').nullable();
      table.string('sender_type').defaultTo('customer'); // 'customer' | 'bot' | 'human_agent'
      table.text('message').notNullable();
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
    })
    // 11. Review Table
    .createTable('Review', (table) => {
      table.uuid('ReviewID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('CustomerID').references('CustomerID').inTable('Customer').onDelete('CASCADE');
      table.integer('Rating');
      table.text('ReviewText');
      table.string('Sentiment');
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
      table.string('Category');
    })
    // 12. Conversations Table (Required for Chat Analytics Queries)
    .createTable('conversations', (table) => {
      table.increments('id').primary();
      table.uuid('customer_id').references('CustomerID').inTable('Customer').onDelete('CASCADE').nullable();
      table.string('phone_number').nullable();
      table.boolean('handover').defaultTo(false);
      table.string('sentiment').nullable();
      table.string('handled_by').defaultTo('bot');
      table.string('status').defaultTo('active');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // 13. FlaggedMessages Table
    .createTable('FlaggedMessages', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.integer('conversation_id').references('id').inTable('conversations').onDelete('CASCADE').nullable();
      table.string('flagged_by').notNullable(); // 'customer' or 'bot'
      table.text('message_text').notNullable();
      table.string('flag_reason').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });

  // ---------------------------------------------------------------------------
  // 2. SEED MOCK DATA FOR CHAT ANALYTICS & WHATSAPP SESSIONS TESTING
  // ---------------------------------------------------------------------------

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // Seed Default WhatsApp Session
  await knex('whatsapp_sessions').insert([
    {
      session_key: 'default',
      status: 'DISCONNECTED',
      phone_number: null,
      qr_code: null,
      connected_at: null
    }
  ]);

  // Seed Customers
  const insertedCustomers = await knex('Customer')
    .insert([
      { Name: 'Alice Smith', PhoneNumber: '+15551000001', PreferredLanguage: 'English' },
      { Name: 'Bob Jones', PhoneNumber: '+15551000002', PreferredLanguage: 'English' },
      { Name: 'Carla Gomez', PhoneNumber: '+15551000003', PreferredLanguage: 'Spanish' },
      { Name: 'David Miller', PhoneNumber: '+15551000004', PreferredLanguage: 'English' },
      { Name: 'Eva Green', PhoneNumber: '+15551000005', PreferredLanguage: 'English' },
      { Name: 'Frank Wright', PhoneNumber: '+15551000006', PreferredLanguage: 'English' },
      { Name: 'Grace Lee', PhoneNumber: '+15551000007', PreferredLanguage: 'Korean' },
      { Name: 'Henry Ford', PhoneNumber: '+15551000008', PreferredLanguage: 'English' },
    ])
    .returning(['CustomerID', 'PhoneNumber']);

  const [c1, c2, c3, c4, c5, c6, c7, c8] = insertedCustomers;

  // Seed Chat Sessions
  await knex('ChatSession').insert([
    { PhoneNumber: c1.PhoneNumber, Active: false, Handover: false, Sentiment: 'Positive', CreatedAt: hoursAgo(2) },
    { PhoneNumber: c2.PhoneNumber, Active: false, Handover: true, Sentiment: 'Negative', CreatedAt: hoursAgo(5) },
    { PhoneNumber: c3.PhoneNumber, Active: false, Handover: false, Sentiment: 'Neutral', CreatedAt: daysAgo(3) },
    { PhoneNumber: c4.PhoneNumber, Active: false, Handover: true, Sentiment: 'Negative', CreatedAt: daysAgo(5) },
    { PhoneNumber: c5.PhoneNumber, Active: false, Handover: false, Sentiment: 'Positive', CreatedAt: daysAgo(15) },
    { PhoneNumber: c6.PhoneNumber, Active: false, Handover: false, Sentiment: 'Positive', CreatedAt: daysAgo(22) },
    { PhoneNumber: c7.PhoneNumber, Active: false, Handover: true, Sentiment: 'Negative', CreatedAt: daysAgo(90) },
    { PhoneNumber: c8.PhoneNumber, Active: false, Handover: false, Sentiment: 'Positive', CreatedAt: daysAgo(180) },
  ]);

  // Seed Chat Logs with sender_type
  await knex('ChatLogs').insert([
    { CustomerID: c1.CustomerID, PhoneNumber: c1.PhoneNumber, sender_type: 'customer', message: 'Hello, I want to book an appointment.', CreatedAt: hoursAgo(2) },
    { CustomerID: c1.CustomerID, PhoneNumber: c1.PhoneNumber, sender_type: 'bot', message: 'Sure! What date works best for you?', CreatedAt: hoursAgo(2) },
    { CustomerID: c2.CustomerID, PhoneNumber: c2.PhoneNumber, sender_type: 'customer', message: 'Your bot is giving me incorrect answers.', CreatedAt: hoursAgo(5) },
    { CustomerID: c2.CustomerID, PhoneNumber: c2.PhoneNumber, sender_type: 'human_agent', message: 'Hi Bob, human support agent stepping in here. How can I help?', CreatedAt: hoursAgo(4) },
  ]);

  // Seed Conversations
  const insertedConversations = await knex('conversations')
    .insert([
      { customer_id: c1.CustomerID, phone_number: c1.PhoneNumber, handover: false, sentiment: 'Positive', created_at: hoursAgo(3) },
      { customer_id: c2.CustomerID, phone_number: c2.PhoneNumber, handover: true, sentiment: 'Negative', created_at: hoursAgo(1) },
      { customer_id: c3.CustomerID, phone_number: c3.PhoneNumber, handover: false, sentiment: 'Neutral', created_at: daysAgo(4) },
      { customer_id: c4.CustomerID, phone_number: c4.PhoneNumber, handover: true, sentiment: 'Negative', created_at: daysAgo(2) },
      { customer_id: c5.CustomerID, phone_number: c5.PhoneNumber, handover: false, sentiment: 'Positive', created_at: daysAgo(18) },
      { customer_id: c6.CustomerID, phone_number: c6.PhoneNumber, handover: false, sentiment: 'Positive', created_at: daysAgo(25) },
      { customer_id: c7.CustomerID, phone_number: c7.PhoneNumber, handover: true, sentiment: 'Negative', created_at: daysAgo(120) },
    ])
    .returning(['id']);

  // Seed Flagged Messages referencing valid conversation IDs
  await knex('FlaggedMessages').insert([
    {
      conversation_id: insertedConversations[0]?.id || null,
      flagged_by: 'customer',
      message_text: 'I have been waiting for 20 minutes and nobody answered my question about refund policies!',
      flag_reason: 'Frustrated / Unresolved issue',
      created_at: hoursAgo(3)
    },
    {
      conversation_id: insertedConversations[1]?.id || null,
      flagged_by: 'bot',
      message_text: 'Sorry, I did not understand your input. Would you like to check our business hours?',
      flag_reason: 'Repetitive fallback response triggered 3x',
      created_at: hoursAgo(1)
    },
    {
      conversation_id: insertedConversations[2]?.id || null,
      flagged_by: 'customer',
      message_text: 'Your bot gave me completely incorrect pricing for the consultation service.',
      flag_reason: 'Incorrect pricing provided',
      created_at: daysAgo(4)
    },
    {
      conversation_id: insertedConversations[3]?.id || null,
      flagged_by: 'bot',
      message_text: 'I cannot assist with appointment cancellation at this time.',
      flag_reason: 'Failed intent match for booking cancellation',
      created_at: daysAgo(2)
    },
    {
      conversation_id: insertedConversations[4]?.id || null,
      flagged_by: 'customer',
      message_text: 'Can I speak to a real human person please? This bot is frustrating.',
      flag_reason: 'Explicit request for human handover',
      created_at: daysAgo(18)
    },
    {
      conversation_id: insertedConversations[5]?.id || null,
      flagged_by: 'bot',
      message_text: 'Error 500: Database connection timed out while checking availability.',
      flag_reason: 'System exception logged during flow',
      created_at: daysAgo(25)
    },
    {
      conversation_id: insertedConversations[6]?.id || null,
      flagged_by: 'bot',
      message_text: 'Thank you for calling. Good bye.',
      flag_reason: 'Premature session closure',
      created_at: daysAgo(120)
    }
  ]);

  // Seed Reviews
  await knex('Review').insert([
    { CustomerID: c1.CustomerID, Rating: 5, ReviewText: 'Bot answered my question immediately!', Sentiment: 'Positive', Category: 'Chatbot', CreatedAt: hoursAgo(2) },
    { CustomerID: c2.CustomerID, Rating: 1, ReviewText: 'Had to wait for a human agent for too long.', Sentiment: 'Negative', Category: 'Support', CreatedAt: hoursAgo(4) },
    { CustomerID: c3.CustomerID, Rating: 4, ReviewText: 'Good experience overall.', Sentiment: 'Positive', Category: 'Booking', CreatedAt: daysAgo(4) },
  ]);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  return knex.schema
    .dropTableIfExists('FlaggedMessages')
    .dropTableIfExists('conversations')
    .dropTableIfExists('Review')
    .dropTableIfExists('ChatLogs')
    .dropTableIfExists('ChatSession')
    .dropTableIfExists('appointments')
    .dropTableIfExists('specialist_services')
    .dropTableIfExists('specialists')
    .dropTableIfExists('services')
    .dropTableIfExists('Customer')
    .dropTableIfExists('whatsapp_sessions')
    .dropTableIfExists('AdminUser')
    .dropTableIfExists('Company');
}
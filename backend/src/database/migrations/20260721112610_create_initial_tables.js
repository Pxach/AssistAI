/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema
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
    // 3. Customer Table
    .createTable('Customer', (table) => {
      table.uuid('CustomerID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('PhoneNumber').notNullable().unique();
      table.string('Name');
      table.string('PreferredLanguage').defaultTo('English');
    })
    // 4. Services Table
    .createTable('services', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('department').notNullable();
      table.integer('duration_minutes').defaultTo(60);
    })
    // 5. Specialists Table
    .createTable('specialists', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('department').notNullable();
      table.string('calendar_id').nullable();
    })
    // 6. Specialist Services Junction Table
    .createTable('specialist_services', (table) => {
      table.integer('specialist_id').unsigned().notNullable()
        .references('id').inTable('specialists').onDelete('CASCADE');
      table.integer('service_id').unsigned().notNullable()
        .references('id').inTable('services').onDelete('CASCADE');
      table.primary(['specialist_id', 'service_id']);
    })
    // 7. Appointments Table
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
      table.string('status').defaultTo('pending'); // Supports: 'pending', 'confirmed', 'completed', 'cancelled'
      table.boolean('review_prompt_sent').defaultTo(false); // Tracks review trigger status
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // 8. ChatSession Table
    .createTable('ChatSession', (table) => {
      table.string('PhoneNumber').primary();
      table.boolean('Active').defaultTo(true);
      table.boolean('Handover').defaultTo(false);
      table.string('Sentiment');
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
    })
    // 9. ChatLogs Table
    .createTable('ChatLogs', (table) => {
      table.uuid('ChatID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('CustomerID').references('CustomerID').inTable('Customer').onDelete('CASCADE');
      table.text('message').notNullable();
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
    })
    // 10. Review Table
    .createTable('Review', (table) => {
      table.uuid('ReviewID').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('CustomerID').references('CustomerID').inTable('Customer').onDelete('CASCADE');
      table.integer('Rating');
      table.text('ReviewText');
      table.string('Sentiment');
      table.timestamp('CreatedAt').defaultTo(knex.fn.now());
      table.string('Category');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema
    .dropTableIfExists('Review')
    .dropTableIfExists('ChatLogs')
    .dropTableIfExists('ChatSession')
    .dropTableIfExists('appointments')
    .dropTableIfExists('specialist_services')
    .dropTableIfExists('specialists')
    .dropTableIfExists('services')
    .dropTableIfExists('Customer')
    .dropTableIfExists('AdminUser')
    .dropTableIfExists('Company');
}
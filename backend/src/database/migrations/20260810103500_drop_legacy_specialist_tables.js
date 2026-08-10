/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Alter appointments table: drop specialist_id, add company_id (relational link to profile_data owner) and specialist_name (historical snapshot)
  await knex.schema.alterTable('appointments', (table) => {
    table.dropForeign('specialist_id');
    table.dropColumn('specialist_id');
    
    table.uuid('company_id').references('CompanyID').inTable('Company').onDelete('CASCADE').nullable();
    table.string('specialist_name').nullable();
  });

  // 2. Drop junction table
  await knex.schema.dropTableIfExists('specialist_services');

  // 3. Drop specialists table
  await knex.schema.dropTableIfExists('specialists');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Reverse the drops
  await knex.schema.createTable('specialists', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('department').notNullable();
    table.string('calendar_id').nullable();
  });

  await knex.schema.createTable('specialist_services', (table) => {
    table.integer('specialist_id').unsigned().notNullable()
      .references('id').inTable('specialists').onDelete('CASCADE');
    table.integer('service_id').unsigned().notNullable()
      .references('id').inTable('services').onDelete('CASCADE');
    table.primary(['specialist_id', 'service_id']);
  });

  await knex.schema.alterTable('appointments', (table) => {
    table.dropColumn('specialist_name');
    table.dropForeign('company_id');
    table.dropColumn('company_id');
    table.integer('specialist_id').unsigned().nullable()
      .references('id').inTable('specialists').onDelete('SET NULL');
  });
}

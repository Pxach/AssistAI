/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('services', (table) => {
    table.uuid('company_id').references('CompanyID').inTable('Company').onDelete('CASCADE').nullable();
  });
  
  await knex.schema.alterTable('knowledge_base', (table) => {
    table.uuid('company_id').references('CompanyID').inTable('Company').onDelete('CASCADE').nullable();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('knowledge_base', (table) => {
    table.dropForeign('company_id');
    table.dropColumn('company_id');
  });
  
  await knex.schema.alterTable('services', (table) => {
    table.dropForeign('company_id');
    table.dropColumn('company_id');
  });
}

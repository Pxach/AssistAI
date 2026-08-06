/**
 * Migration: Create knowledge_base table
 *
 * Stores the AI-extracted company_info text produced by the document
 * ingestion pipeline (POST /api/business/upload).
 *
 * Only one active row is needed at a time — the ingestion pipeline
 * uses an upsert pattern (delete-then-insert) to replace stale content.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  await knex.schema.createTable('knowledge_base', (table) => {
    table.increments('id').primary();
    // The full company info text extracted and summarised by the LLM
    table.text('content').notNullable();
    // Source document filename for audit/traceability
    table.string('source_file').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

/**
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('knowledge_base');
}

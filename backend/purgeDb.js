import db from './src/database/db.js';

async function purgeDatabase() {
  const tables = ['AdminUser', 'ChatLogs', 'ChatSession', 'Review', 'appointments', 'conversations', 'FlaggedMessages', 'Customer'];
  const summary = {};

  try {
    for (const table of tables) {
      try {
        const rows = await db(table).count('* as count').first();
        const count = parseInt(rows?.count || 0, 10);

        if (count > 0) {
          await db(table).del(); // delete all rows
          summary[table] = count;
        } else {
          summary[table] = 0;
        }
      } catch (err) {
        console.error(`Error processing table ${table}:`, err.message);
      }
    }
    console.log(JSON.stringify({ success: true, summary }));
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await db.destroy();
  }
}

purgeDatabase();

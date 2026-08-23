/**
 * Simple migration runner: syncs all Sequelize models to the database.
 * For a production system you'd use sequelize-cli migrations for
 * versioned, reversible schema changes; this keeps the take-home setup
 * to a single command as requested in the brief.
 */
const { sequelize } = require('../models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('[migrate] Database connection OK.');
    await sequelize.sync({ alter: true });
    console.log('[migrate] All tables synced successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Failed:', err);
    process.exit(1);
  }
}

migrate();

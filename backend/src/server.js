const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const medicationReminderJob = require('./jobs/medicationReminderJob');
const notificationRetryJob = require('./jobs/notificationRetryJob');
const slotHoldCleanupJob = require('./jobs/slotHoldCleanupJob');

async function start() {
  await sequelize.authenticate();
  console.log('[server] Database connected.');

  // In production you'd run `npm run migrate` as a separate deploy step;
  // syncing here too keeps first-run setup to a single `npm start`.
  await sequelize.sync({ alter: env.nodeEnv !== 'production' });

  medicationReminderJob.start();
  notificationRetryJob.start();
  slotHoldCleanupJob.start();

  app.listen(env.port, () => {
    console.log(`[server] Listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`[server] LLM mocked: ${env.isLlmMocked} | Email mocked: ${env.isEmailMocked} | Calendar mocked: ${env.isCalendarMocked}`);
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

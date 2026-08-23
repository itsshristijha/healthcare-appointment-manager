/**
 * Retries any NotificationLog row that failed to send, respecting the
 * exponential-backoff `nextRetryAt` set by emailService, up to
 * NOTIFICATION_MAX_RETRIES attempts (after which it's marked
 * permanently_failed and surfaced to the admin dashboard instead of
 * retried forever).
 */
const cron = require('node-cron');
const { Op } = require('sequelize');
const env = require('../config/env');
const { NotificationLog } = require('../models');
const { attemptSend } = require('../services/emailService');

async function runOnce() {
  const due = await NotificationLog.findAll({
    where: {
      status: 'failed',
      [Op.or]: [{ nextRetryAt: null }, { nextRetryAt: { [Op.lte]: new Date() } }],
    },
    limit: 100,
  });

  for (const log of due) {
    await attemptSend(log);
  }
  if (due.length) console.log(`[notificationRetryJob] retried ${due.length} notification(s).`);
  return due.length;
}

function start() {
  cron.schedule(env.notificationRetryCron, () => {
    runOnce().catch((err) => console.error('[notificationRetryJob] run failed:', err));
  });
  console.log(`[notificationRetryJob] scheduled with cron "${env.notificationRetryCron}".`);
}

module.exports = { start, runOnce };

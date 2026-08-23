/**
 * Deletes expired SlotHold rows so they don't block real bookings forever.
 * Booking logic also treats an expired hold as free on read, so this job
 * is a housekeeping pass rather than a correctness requirement.
 */
const cron = require('node-cron');
const { Op } = require('sequelize');
const { SlotHold } = require('../models');

async function runOnce() {
  const deleted = await SlotHold.destroy({ where: { expiresAt: { [Op.lte]: new Date() } } });
  if (deleted) console.log(`[slotHoldCleanupJob] removed ${deleted} expired hold(s).`);
  return deleted;
}

function start() {
  cron.schedule('* * * * *', () => {
    runOnce().catch((err) => console.error('[slotHoldCleanupJob] run failed:', err));
  });
  console.log('[slotHoldCleanupJob] scheduled every minute.');
}

module.exports = { start, runOnce };

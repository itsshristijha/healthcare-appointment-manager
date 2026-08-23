/**
 * Sends a medication reminder email whenever "now" has just crossed one of
 * a reminder's scheduled times-of-day, and the reminder is within its
 * active date range. Runs on MEDICATION_REMINDER_CRON (default every 15
 * minutes); a reminder is only sent once per (day, time-slot) thanks to
 * the lastSentAt check below.
 */
const cron = require('node-cron');
const { Op } = require('sequelize');
const env = require('../config/env');
const { MedicationReminder, Appointment, User } = require('../models');
const { sendEmail } = require('../services/emailService');

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function minutesSinceMidnight(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

async function runOnce() {
  const today = todayStr();
  const now = new Date();

  const reminders = await MedicationReminder.findAll({
    where: {
      active: true,
      startDate: { [Op.lte]: today },
      endDate: { [Op.gte]: today },
    },
  });

  let sentCount = 0;
  for (const reminder of reminders) {
    const nowMinutes = minutesSinceMidnight(now);
    // Fire for any time-of-day slot that has just passed within the last
    // job interval (15 min window) and hasn't already fired today.
    const dueSlot = (reminder.timesOfDay || []).find((t) => {
      const slotMinutes = timeToMinutes(t);
      return nowMinutes >= slotMinutes && nowMinutes - slotMinutes < 15;
    });
    if (!dueSlot) continue;

    const lastSentDay = reminder.lastSentAt ? todayStr(new Date(reminder.lastSentAt)) : null;
    const alreadySentThisSlotToday =
      lastSentDay === today &&
      reminder.lastSentAt &&
      Math.abs(minutesSinceMidnight(new Date(reminder.lastSentAt)) - timeToMinutes(dueSlot)) < 15;
    if (alreadySentThisSlotToday) continue;

    const patient = await User.findByPk(reminder.patientId);
    if (!patient) continue;

    await sendEmail({
      type: 'medication_reminder',
      recipientEmail: patient.email,
      recipientUserId: patient.id,
      appointmentId: reminder.appointmentId,
      subject: `Medication reminder: ${reminder.medicationName}`,
      body:
        `Hi ${patient.name},\n\nThis is a reminder to take your medication: ${reminder.medicationName}` +
        `${reminder.dosage ? ` (${reminder.dosage})` : ''} at ${dueSlot}.\n\n` +
        `Schedule: ${reminder.frequencyPerDay}x/day, from ${reminder.startDate} to ${reminder.endDate}.\n\n` +
        `- Healthcare Appointment & Follow-up Manager`,
    });

    reminder.lastSentAt = now;
    await reminder.save();
    sentCount += 1;
  }
  if (sentCount) console.log(`[medicationReminderJob] sent ${sentCount} reminder(s).`);
  return sentCount;
}

function start() {
  cron.schedule(env.medicationReminderCron, () => {
    runOnce().catch((err) => console.error('[medicationReminderJob] run failed:', err));
  });
  console.log(`[medicationReminderJob] scheduled with cron "${env.medicationReminderCron}".`);
}

module.exports = { start, runOnce };

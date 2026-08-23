/**
 * Email service. Every outbound email is first written to NotificationLog
 * as `pending`, then an actual send is attempted. This way a crash or
 * process restart mid-send never silently loses a notification: the retry
 * job (jobs/notificationRetryJob.js) picks up anything not marked `sent`.
 *
 * In mock mode (no SMTP_HOST configured) nodemailer uses a JSON transport,
 * so nothing actually leaves the box, but the full pipeline (log -> attempt
 * -> mark sent/failed) still runs exactly as it would in production.
 */
const nodemailer = require('nodemailer');
const env = require('../config/env');
const { NotificationLog } = require('../models');

function buildTransport() {
  if (env.isEmailMocked) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  });
}

const transporter = buildTransport();

async function attemptSend(log) {
  try {
    const info = await transporter.sendMail({
      from: env.emailFrom,
      to: log.recipientEmail,
      subject: log.subject,
      text: log.body,
    });
    if (env.isEmailMocked) {
      console.log(`[emailService:mock] -> ${log.recipientEmail} | ${log.subject}`);
    }
    log.status = 'sent';
    log.lastError = null;
    await log.save();
    return { ok: true, info };
  } catch (err) {
    log.retryCount += 1;
    log.lastError = err.message;
    if (log.retryCount >= env.notificationMaxRetries) {
      log.status = 'permanently_failed';
    } else {
      log.status = 'failed';
      // Exponential backoff: 1m, 2m, 4m, 8m, 16m...
      const backoffMinutes = Math.pow(2, log.retryCount);
      log.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    }
    await log.save();
    return { ok: false, error: err };
  }
}

/**
 * Queue + immediately attempt an email. Never throws — callers (booking,
 * cancellation, reminders) should never fail because notifications did.
 */
async function sendEmail({ type, recipientEmail, recipientUserId, appointmentId, subject, body }) {
  const log = await NotificationLog.create({
    type,
    channel: 'email',
    recipientEmail,
    recipientUserId: recipientUserId || null,
    appointmentId: appointmentId || null,
    subject,
    body,
    status: 'pending',
  });
  await attemptSend(log);
  return log;
}

module.exports = { sendEmail, attemptSend };

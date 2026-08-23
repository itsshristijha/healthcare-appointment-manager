require('dotenv').config();

function bool(v, def = false) {
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1';
}

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  databaseUrl: process.env.DATABASE_URL || null,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'healthcare_appointments',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
  },
  emailFrom: process.env.EMAIL_FROM || 'Healthcare Appointment Manager <no-reply@clinic.example.com>',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/calendar/oauth/callback',
  },

  medicationReminderCron: process.env.MEDICATION_REMINDER_CRON || '*/15 * * * *',
  notificationRetryCron: process.env.NOTIFICATION_RETRY_CRON || '*/10 * * * *',
  slotHoldTtlMinutes: Number(process.env.SLOT_HOLD_TTL_MINUTES || 5),
  notificationMaxRetries: Number(process.env.NOTIFICATION_MAX_RETRIES || 5),

  isLlmMocked: !process.env.OPENAI_API_KEY,
  isEmailMocked: !process.env.SMTP_HOST,
  isCalendarMocked: !(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
};

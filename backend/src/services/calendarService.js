/**
 * Google Calendar integration. When GOOGLE_CLIENT_ID/SECRET are not set
 * (mock mode), calendar operations generate a fake event id and log to the
 * console instead of calling Google — the rest of the app (storing the
 * event id on the appointment, updating/deleting on reschedule/cancel)
 * behaves identically either way.
 *
 * Real mode expects each user (patient/doctor) to have connected their
 * Google account via the OAuth flow in routes/calendar.js, which stores a
 * refresh token. See README "Google Calendar setup" for the full flow.
 */
const { google } = require('googleapis');
const crypto = require('crypto');
const env = require('../config/env');

function getOAuthClient() {
  return new google.auth.OAuth2(env.google.clientId, env.google.clientSecret, env.google.redirectUri);
}

function getAuthUrl(state) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

function getCalendarClient(refreshToken) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * @param {object} opts
 * @param {string} opts.refreshToken - required in real mode; ignored in mock mode
 * @param {string} opts.summary
 * @param {string} opts.description
 * @param {Date} opts.start
 * @param {Date} opts.end
 * @param {string[]} opts.attendeeEmails
 */
async function createEvent({ refreshToken, summary, description, start, end, attendeeEmails = [] }) {
  if (env.isCalendarMocked || !refreshToken) {
    const fakeId = `mock-evt-${crypto.randomBytes(6).toString('hex')}`;
    console.log(`[calendarService:mock] created event ${fakeId} "${summary}" ${start.toISOString()} - ${end.toISOString()}`);
    return { id: fakeId, mocked: true };
  }
  try {
    const calendar = getCalendarClient(refreshToken);
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: attendeeEmails.map((email) => ({ email })),
      },
    });
    return { id: data.id, mocked: false };
  } catch (err) {
    console.error('[calendarService] createEvent failed, degrading to mock id:', err.message);
    const fakeId = `mock-evt-error-${crypto.randomBytes(6).toString('hex')}`;
    return { id: fakeId, mocked: true, error: err.message };
  }
}

async function updateEvent({ refreshToken, eventId, summary, description, start, end }) {
  if (env.isCalendarMocked || !refreshToken || String(eventId || '').startsWith('mock-evt-')) {
    console.log(`[calendarService:mock] updated event ${eventId}`);
    return { id: eventId, mocked: true };
  }
  try {
    const calendar = getCalendarClient(refreshToken);
    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
    return { id: data.id, mocked: false };
  } catch (err) {
    console.error('[calendarService] updateEvent failed:', err.message);
    return { id: eventId, mocked: true, error: err.message };
  }
}

async function deleteEvent({ refreshToken, eventId }) {
  if (env.isCalendarMocked || !refreshToken || String(eventId || '').startsWith('mock-evt-')) {
    console.log(`[calendarService:mock] deleted event ${eventId}`);
    return { ok: true, mocked: true };
  }
  try {
    const calendar = getCalendarClient(refreshToken);
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return { ok: true, mocked: false };
  } catch (err) {
    console.error('[calendarService] deleteEvent failed:', err.message);
    return { ok: false, mocked: true, error: err.message };
  }
}

module.exports = { getAuthUrl, exchangeCodeForTokens, createEvent, updateEvent, deleteEvent };

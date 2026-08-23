const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const calendarService = require('../services/calendarService');
const { User } = require('../models');
const env = require('../config/env');

const router = express.Router();

// Step 1: patient/doctor clicks "Connect Google Calendar" in the frontend,
// which redirects the browser here.
router.get(
  '/oauth/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (env.isCalendarMocked) {
      throw new HttpError(400, 'Google Calendar credentials are not configured on this server (running in mock mode).');
    }
    const url = calendarService.getAuthUrl(req.user.id);
    res.json({ url });
  })
);

// Step 2: Google redirects back here with a `code` and our `state` (userId).
router.get(
  '/oauth/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) throw new HttpError(400, 'Missing code or state.');
    const tokens = await calendarService.exchangeCodeForTokens(code);
    await User.update({ googleRefreshToken: tokens.refresh_token }, { where: { id: state } });
    res.redirect(`${env.frontendUrl}/settings?calendar=connected`);
  })
);

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);
    res.json({
      mocked: env.isCalendarMocked,
      connected: env.isCalendarMocked ? true : Boolean(user.googleRefreshToken),
    });
  })
);

module.exports = router;

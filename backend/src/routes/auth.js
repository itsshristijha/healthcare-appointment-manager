const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { google } = require('googleapis');
const { User, DoctorProfile } = require('../models');
const { signToken, verifyToken } = require('../utils/jwt');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const env = require('../config/env');

const router = express.Router();

function googleOAuthClient() {
  return new google.auth.OAuth2(env.google.clientId, env.google.clientSecret, env.google.authRedirectUri);
}

router.get('/google/start', (req, res) => {
  const role = ['patient', 'doctor'].includes(req.query.role) ? req.query.role : 'patient';
  if (!env.google.clientId || !env.google.clientSecret) {
    return res.status(503).send('Google sign-in is not configured on this server.');
  }
  const state = signToken({ id: crypto.randomUUID(), role, type: 'google_auth' });
  const url = googleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
  return res.redirect(url);
});

router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) throw new HttpError(400, 'Missing Google authorization code or state.');

  let authState;
  try {
    authState = verifyToken(state);
  } catch {
    throw new HttpError(400, 'Invalid or expired Google sign-in state.');
  }
  if (authState.type !== 'google_auth') throw new HttpError(400, 'Invalid Google sign-in state.');

  const oauth = googleOAuthClient();
  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);
  const { data: googleUser } = await google.oauth2({ version: 'v2', auth: oauth }).userinfo.get();
  if (!googleUser.email || !googleUser.verified_email) throw new HttpError(401, 'Google account email is not verified.');

  let user = await User.findOne({ where: { email: googleUser.email } });
  if (user && user.role !== authState.role) throw new HttpError(403, `This is the ${user.role} account. Use the correct login.`);
  if (!user) {
    if (authState.role !== 'patient') throw new HttpError(403, 'Doctor accounts must be created by the clinic admin first.');
    user = await User.create({
      name: googleUser.name || googleUser.email.split('@')[0],
      email: googleUser.email,
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      role: 'patient',
    });
  }

  const token = signToken(user);
  const loginPath = authState.role === 'doctor' ? '/doctor/login' : '/patient/login';
  res.redirect(`${env.frontendUrl}${loginPath}?token=${encodeURIComponent(token)}`);
}));

// Patients self-register. Doctor and admin accounts are created by an
// admin (see routes/admin.js) so random users can't grant themselves
// clinical access.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      throw new HttpError(400, 'name, email and password are required.');
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: 'patient', phone });
    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, expectedRole } = req.body;
    if (!email || !password) throw new HttpError(400, 'email and password are required.');

    const user = await User.findOne({ where: { email } });
    if (!user) throw new HttpError(401, 'Invalid email or password.');
    if (expectedRole && user.role !== expectedRole) {
      throw new HttpError(403, `This is the ${expectedRole} login. Use the correct account.`);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Invalid email or password.');

    let doctorProfileId = null;
    if (user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ where: { userId: user.id } });
      doctorProfileId = profile ? profile.id : null;
    }

    const token = signToken(user);
    res.json({ token, user: { ...user.toSafeJSON(), doctorProfileId } });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (!user) throw new HttpError(404, 'User not found.');
    let doctorProfileId = null;
    if (user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ where: { userId: user.id } });
      doctorProfileId = profile ? profile.id : null;
    }
    res.json({ user: { ...user.toSafeJSON(), doctorProfileId } });
  })
);

module.exports = router;

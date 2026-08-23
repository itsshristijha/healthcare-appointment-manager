const express = require('express');
const bcrypt = require('bcryptjs');
const { User, DoctorProfile } = require('../models');
const { signToken } = require('../utils/jwt');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'email and password are required.');

    const user = await User.findOne({ where: { email } });
    if (!user) throw new HttpError(401, 'Invalid email or password.');

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

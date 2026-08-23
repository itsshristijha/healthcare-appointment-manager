const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { sequelize, User, DoctorProfile, DoctorLeave, Appointment, NotificationLog } = require('../models');
const { sendEmail } = require('../services/emailService');
const calendarService = require('../services/calendarService');
const { markDoctorLeave } = require('../services/leaveService');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// ---- Doctor profile CRUD ----

router.get(
  '/doctors',
  asyncHandler(async (req, res) => {
    const doctors = await DoctorProfile.findAll({
      include: [{ model: User, as: 'user', attributes: { exclude: ['passwordHash', 'googleRefreshToken'] } }],
    });
    res.json({ doctors });
  })
);

router.post(
  '/doctors',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, specialization, bio, workingHours, slotDurationMinutes } = req.body;
    if (!name || !email || !password || !specialization) {
      throw new HttpError(400, 'name, email, password and specialization are required.');
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const result = await sequelize.transaction(async (t) => {
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, passwordHash, role: 'doctor', phone }, { transaction: t });
      const profile = await DoctorProfile.create(
        {
          userId: user.id,
          specialization,
          bio: bio || null,
          workingHours: workingHours || {},
          slotDurationMinutes: slotDurationMinutes || 30,
        },
        { transaction: t }
      );
      return { user, profile };
    });

    res.status(201).json({ doctor: { ...result.profile.toJSON(), user: result.user.toSafeJSON() } });
  })
);

router.put(
  '/doctors/:id',
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findByPk(req.params.id);
    if (!profile) throw new HttpError(404, 'Doctor not found.');

    const { specialization, bio, workingHours, slotDurationMinutes, name, phone } = req.body;
    if (specialization !== undefined) profile.specialization = specialization;
    if (bio !== undefined) profile.bio = bio;
    if (workingHours !== undefined) profile.workingHours = workingHours;
    if (slotDurationMinutes !== undefined) profile.slotDurationMinutes = slotDurationMinutes;
    await profile.save();

    if (name !== undefined || phone !== undefined) {
      const user = await User.findByPk(profile.userId);
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;
      await user.save();
    }

    res.json({ doctor: profile });
  })
);

router.delete(
  '/doctors/:id',
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findByPk(req.params.id);
    if (!profile) throw new HttpError(404, 'Doctor not found.');
    await User.destroy({ where: { id: profile.userId } }); // cascades to profile, leaves, holds
    res.json({ ok: true });
  })
);

// ---- Doctor leave management ----
// Marking a doctor on leave for a date must (a) block future bookings on
// that date and (b) reactively cancel + notify patients already booked
// that day. See SYSTEM_DESIGN.md for the full rationale.

router.post(
  '/doctors/:id/leave',
  asyncHandler(async (req, res) => {
    const { date, reason } = req.body;
    if (!date) throw new HttpError(400, 'date (YYYY-MM-DD) is required.');

    const profile = await DoctorProfile.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: { exclude: ['passwordHash', 'googleRefreshToken'] } }],
    });
    if (!profile) throw new HttpError(404, 'Doctor not found.');

    const result = await markDoctorLeave(profile, date, reason);
    res.status(201).json(result);
  })
);

router.delete(
  '/doctors/:id/leave/:date',
  asyncHandler(async (req, res) => {
    await DoctorLeave.destroy({ where: { doctorId: req.params.id, date: req.params.date } });
    res.json({ ok: true });
  })
);

router.get(
  '/doctors/:id/leave',
  asyncHandler(async (req, res) => {
    const leaves = await DoctorLeave.findAll({ where: { doctorId: req.params.id }, order: [['date', 'ASC']] });
    res.json({ leaves });
  })
);

// ---- Notification log visibility (for admin ops/debugging) ----

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const where = status ? { status } : {};
    const logs = await NotificationLog.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 });
    res.json({ logs });
  })
);

module.exports = router;

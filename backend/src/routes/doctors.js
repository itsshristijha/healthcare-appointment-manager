const express = require('express');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { DoctorProfile, User, DoctorLeave, Appointment, SlotHold } = require('../models');
const { generateSlotsForDate } = require('../utils/slots');

const router = express.Router();

// Public-ish (any logged-in user) search by specialization / name.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { specialization, q } = req.query;
    const where = {};
    if (specialization) where.specialization = { [Op.iLike]: `%${specialization}%` };

    const userWhere = {};
    if (q) userWhere.name = { [Op.iLike]: `%${q}%` };

    const doctors = await DoctorProfile.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'], where: Object.keys(userWhere).length ? userWhere : undefined }],
    });
    res.json({ doctors });
  })
);

router.get(
  '/specializations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await DoctorProfile.findAll({ attributes: ['specialization'], group: ['specialization'] });
    res.json({ specializations: rows.map((r) => r.specialization) });
  })
);

// Read-only view of a doctor's upcoming leave days. Leave days are
// *managed* only by admin (see routes/admin.js), but doctors and patients
// both need to be able to see them (doctors: "am I marked off next week?";
// patients: informational before booking).
router.get(
  '/:id/leave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leaves = await DoctorLeave.findAll({
      where: { doctorId: req.params.id, date: { [Op.gte]: new Date().toISOString().slice(0, 10) } },
      order: [['date', 'ASC']],
    });
    res.json({ leaves });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const doctor = await DoctorProfile.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });
    if (!doctor) throw new HttpError(404, 'Doctor not found.');
    res.json({ doctor });
  })
);

// Available slots for a given date, with bookings, active holds, and leave
// days all filtered out.
router.get(
  '/:id/slots',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) throw new HttpError(400, 'date query param (YYYY-MM-DD) is required.');

    const doctor = await DoctorProfile.findByPk(req.params.id);
    if (!doctor) throw new HttpError(404, 'Doctor not found.');

    const onLeave = await DoctorLeave.findOne({ where: { doctorId: doctor.id, date } });
    if (onLeave) return res.json({ slots: [], onLeave: true, reason: onLeave.reason });

    const allSlots = generateSlotsForDate(doctor.workingHours, doctor.slotDurationMinutes, date);

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);

    const [booked, holds] = await Promise.all([
      Appointment.findAll({
        where: {
          doctorId: doctor.id,
          status: { [Op.in]: ['pending', 'confirmed'] },
          slotStart: { [Op.between]: [dayStart, dayEnd] },
        },
        attributes: ['slotStart'],
      }),
      SlotHold.findAll({
        where: {
          doctorId: doctor.id,
          slotStart: { [Op.between]: [dayStart, dayEnd] },
          expiresAt: { [Op.gt]: new Date() },
        },
        attributes: ['slotStart'],
      }),
    ]);

    const takenTimes = new Set([
      ...booked.map((b) => b.slotStart.getTime()),
      ...holds.map((h) => h.slotStart.getTime()),
    ]);

    const now = new Date();
    const slots = allSlots
      .filter((s) => s.start > now && !takenTimes.has(s.start.getTime()))
      .map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));

    res.json({ slots, onLeave: false });
  })
);

module.exports = router;

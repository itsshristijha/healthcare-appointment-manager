const express = require('express');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const {
  sequelize,
  Appointment,
  DoctorProfile,
  DoctorLeave,
  SlotHold,
  User,
  MedicationReminder,
} = require('../models');
const env = require('../config/env');
const llmService = require('../services/llmService');
const { sendEmail } = require('../services/emailService');
const calendarService = require('../services/calendarService');

const router = express.Router();
router.use(requireAuth);

function dateStrOf(dateLike) {
  return new Date(dateLike).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Step 1: HOLD a slot. This is the "slot hold mechanism" — it stops two
// patients who are simultaneously looking at the same open slot from both
// filling in the symptom form and both hitting confirm. See
// SYSTEM_DESIGN.md for the full write-up.
// ---------------------------------------------------------------------
router.post(
  '/hold',
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const { doctorId, slotStart, slotEnd } = req.body;
    if (!doctorId || !slotStart || !slotEnd) throw new HttpError(400, 'doctorId, slotStart, slotEnd are required.');

    const doctor = await DoctorProfile.findByPk(doctorId);
    if (!doctor) throw new HttpError(404, 'Doctor not found.');

    const start = new Date(slotStart);
    const end = new Date(slotEnd);
    if (start <= new Date()) throw new HttpError(400, 'Cannot book a slot in the past.');

    const onLeave = await DoctorLeave.findOne({ where: { doctorId, date: dateStrOf(start) } });
    if (onLeave) throw new HttpError(409, 'Doctor is on leave on this date.');

    const alreadyBooked = await Appointment.findOne({
      where: { doctorId, slotStart: start, status: { [Op.in]: ['pending', 'confirmed'] } },
    });
    if (alreadyBooked) throw new HttpError(409, 'This slot has just been booked. Please pick another.');

    // Clean out any expired hold on this exact slot so the unique index
    // doesn't block a legitimate new hold.
    await SlotHold.destroy({ where: { doctorId, slotStart: start, expiresAt: { [Op.lte]: new Date() } } });

    const expiresAt = new Date(Date.now() + env.slotHoldTtlMinutes * 60 * 1000);
    try {
      const hold = await SlotHold.create({ doctorId, patientId: req.user.id, slotStart: start, slotEnd: end, expiresAt });
      res.status(201).json({ hold });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new HttpError(409, 'Someone else is currently booking this slot. Please pick another or try again shortly.');
      }
      throw err;
    }
  })
);

// ---------------------------------------------------------------------
// Step 2: CONFIRM a held slot with the symptom form, generating the
// pre-visit AI summary, creating calendar events, and emailing both sides.
// ---------------------------------------------------------------------
router.post(
  '/confirm',
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const { holdId, symptomText } = req.body;
    if (!holdId || !symptomText) throw new HttpError(400, 'holdId and symptomText are required.');

    const hold = await SlotHold.findByPk(holdId);
    if (!hold || hold.patientId !== req.user.id) throw new HttpError(404, 'Hold not found.');
    if (hold.expiresAt <= new Date()) {
      await hold.destroy();
      throw new HttpError(410, 'Your slot hold expired. Please select the slot again.');
    }

    // Re-check leave in case admin marked leave after the hold was created.
    const onLeave = await DoctorLeave.findOne({ where: { doctorId: hold.doctorId, date: dateStrOf(hold.slotStart) } });
    if (onLeave) {
      await hold.destroy();
      throw new HttpError(409, 'Doctor has since gone on leave for this date. Please pick another slot.');
    }

    const preVisitSummary = await llmService.generatePreVisitSummary(symptomText);

    let appointment;
    try {
      appointment = await sequelize.transaction(async (t) => {
        // The unique partial index (doctorId, slotStart) WHERE status IN
        // (pending, confirmed) is the actual source of truth that prevents
        // double-booking, even if two requests race past the hold check.
        const created = await Appointment.create(
          {
            patientId: req.user.id,
            doctorId: hold.doctorId,
            slotStart: hold.slotStart,
            slotEnd: hold.slotEnd,
            status: 'confirmed',
            symptomText,
            preVisitSummary,
          },
          { transaction: t }
        );
        await hold.destroy({ transaction: t });
        return created;
      });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new HttpError(409, 'This slot was just booked by someone else. Please pick another slot.');
      }
      throw err;
    }

    const [patient, doctorProfile] = await Promise.all([
      User.findByPk(req.user.id),
      DoctorProfile.findByPk(hold.doctorId, {
        include: [{ model: User, as: 'user', attributes: { exclude: ['passwordHash'] } }],
      }),
    ]);

    const [patientEvent, doctorEvent] = await Promise.all([
      calendarService.createEvent({
        refreshToken: patient.googleRefreshToken,
        summary: `Appointment with Dr. ${doctorProfile.user.name}`,
        description: `Specialization: ${doctorProfile.specialization}`,
        start: appointment.slotStart,
        end: appointment.slotEnd,
        attendeeEmails: [doctorProfile.user.email],
      }),
      calendarService.createEvent({
        refreshToken: doctorProfile.user.googleRefreshToken,
        summary: `Appointment with ${patient.name}`,
        description: `Chief complaint: ${preVisitSummary.chiefComplaint || 'N/A'} | Urgency: ${preVisitSummary.urgencyLevel || 'N/A'}`,
        start: appointment.slotStart,
        end: appointment.slotEnd,
        attendeeEmails: [patient.email],
      }),
    ]);
    appointment.calendarEventIdPatient = patientEvent.id;
    appointment.calendarEventIdDoctor = doctorEvent.id;
    await appointment.save();

    const when = appointment.slotStart.toISOString();
    await Promise.all([
      sendEmail({
        type: 'booking_confirmation',
        recipientEmail: patient.email,
        recipientUserId: patient.id,
        appointmentId: appointment.id,
        subject: 'Appointment confirmed',
        body: `Hi ${patient.name},\n\nYour appointment with Dr. ${doctorProfile.user.name} (${doctorProfile.specialization}) is confirmed for ${when}.\n\n- Healthcare Appointment & Follow-up Manager`,
      }),
      sendEmail({
        type: 'booking_confirmation',
        recipientEmail: doctorProfile.user.email,
        recipientUserId: doctorProfile.user.id,
        appointmentId: appointment.id,
        subject: 'New appointment booked',
        body: `Hi Dr. ${doctorProfile.user.name},\n\n${patient.name} booked an appointment with you for ${when}.\nUrgency: ${preVisitSummary.urgencyLevel}\nChief complaint: ${preVisitSummary.chiefComplaint}\n\n- Healthcare Appointment & Follow-up Manager`,
      }),
    ]);

    res.status(201).json({ appointment });
  })
);

// ---- Listings ----

router.get(
  '/mine',
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const appointments = await Appointment.findAll({
      where: { patientId: req.user.id },
      include: [{ model: DoctorProfile, as: 'doctor', include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }] }],
      order: [['slotStart', 'DESC']],
    });
    res.json({ appointments });
  })
);

router.get(
  '/doctor',
  requireRole('doctor'),
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) throw new HttpError(404, 'Doctor profile not found.');
    const { date } = req.query;
    const where = { doctorId: profile.id };
    if (date) {
      where.slotStart = { [Op.between]: [new Date(`${date}T00:00:00`), new Date(`${date}T23:59:59.999`)] };
    }
    const appointments = await Appointment.findAll({
      where,
      include: [{ model: User, as: 'patient', attributes: ['id', 'name', 'email', 'phone'] }],
      order: [['slotStart', 'ASC']],
    });
    res.json({ appointments });
  })
);

router.get(
  '/doctor/patients/:patientId/history',
  requireRole('doctor'),
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) throw new HttpError(404, 'Doctor profile not found.');

    const appointments = await Appointment.findAll({
      where: { doctorId: profile.id, patientId: req.params.patientId },
      include: [{ model: User, as: 'patient', attributes: ['id', 'name', 'email', 'phone'] }],
      order: [['slotStart', 'DESC']],
    });
    if (appointments.length === 0) throw new HttpError(404, 'Patient history not found.');

    res.json({ patient: appointments[0].patient, appointments });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: User, as: 'patient', attributes: ['id', 'name', 'email', 'phone'] },
        { model: DoctorProfile, as: 'doctor', include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }] },
      ],
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found.');

    const isOwnerPatient = req.user.role === 'patient' && appointment.patientId === req.user.id;
    const isOwnerDoctor = req.user.role === 'doctor' && appointment.doctor.userId === req.user.id;
    if (!isOwnerPatient && !isOwnerDoctor && req.user.role !== 'admin') {
      throw new HttpError(403, 'Not authorized to view this appointment.');
    }
    res.json({ appointment });
  })
);

// ---- Cancel ----

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    // Note: googleRefreshToken is intentionally NOT excluded here — the
    // handler below needs it to delete the corresponding calendar events.
    // It is stripped from the JSON response at the end via toJSON overrides
    // on send (see the res.json call below).
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: User, as: 'patient', attributes: { exclude: ['passwordHash'] } },
        {
          model: DoctorProfile,
          as: 'doctor',
          include: [{ model: User, as: 'user', attributes: { exclude: ['passwordHash'] } }],
        },
      ],
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found.');

    const isOwnerPatient = req.user.role === 'patient' && appointment.patientId === req.user.id;
    const isOwnerDoctor = req.user.role === 'doctor' && appointment.doctor.userId === req.user.id;
    if (!isOwnerPatient && !isOwnerDoctor && req.user.role !== 'admin') {
      throw new HttpError(403, 'Not authorized to cancel this appointment.');
    }
    if (appointment.status === 'cancelled') throw new HttpError(400, 'Appointment already cancelled.');

    appointment.status = 'cancelled';
    appointment.cancelReason = req.body.reason || `Cancelled by ${req.user.role}`;
    await appointment.save();

    await Promise.all([
      appointment.calendarEventIdPatient
        ? calendarService.deleteEvent({ refreshToken: appointment.patient.googleRefreshToken, eventId: appointment.calendarEventIdPatient })
        : null,
      appointment.calendarEventIdDoctor
        ? calendarService.deleteEvent({ refreshToken: appointment.doctor.user.googleRefreshToken, eventId: appointment.calendarEventIdDoctor })
        : null,
    ]);

    await Promise.all([
      sendEmail({
        type: 'cancellation',
        recipientEmail: appointment.patient.email,
        recipientUserId: appointment.patient.id,
        appointmentId: appointment.id,
        subject: 'Appointment cancelled',
        body: `Hi ${appointment.patient.name},\n\nYour appointment scheduled for ${appointment.slotStart.toISOString()} has been cancelled. Reason: ${appointment.cancelReason}\n\n- Healthcare Appointment & Follow-up Manager`,
      }),
      sendEmail({
        type: 'cancellation',
        recipientEmail: appointment.doctor.user.email,
        recipientUserId: appointment.doctor.user.id,
        appointmentId: appointment.id,
        subject: 'Appointment cancelled',
        body: `Hi Dr. ${appointment.doctor.user.name},\n\nThe appointment with ${appointment.patient.name} scheduled for ${appointment.slotStart.toISOString()} has been cancelled. Reason: ${appointment.cancelReason}\n\n- Healthcare Appointment & Follow-up Manager`,
      }),
    ]);

    const responseAppt = appointment.toJSON();
    if (responseAppt.patient) delete responseAppt.patient.googleRefreshToken;
    if (responseAppt.doctor?.user) delete responseAppt.doctor.user.googleRefreshToken;
    res.json({ appointment: responseAppt });
  })
);

// ---- Post-visit notes + prescription (doctor) ----

router.post(
  '/:id/post-visit',
  requireRole('doctor'),
  asyncHandler(async (req, res) => {
    const { notes, prescription } = req.body; // prescription: [{medication, dosage, frequencyPerDay, durationDays, instructions}]
    if (!notes) throw new HttpError(400, 'notes is required.');

    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: User, as: 'patient', attributes: { exclude: ['passwordHash', 'googleRefreshToken'] } },
        { model: DoctorProfile, as: 'doctor' },
      ],
    });
    if (!appointment) throw new HttpError(404, 'Appointment not found.');
    if (appointment.doctor.userId !== req.user.id) throw new HttpError(403, 'Not authorized for this appointment.');

    const postVisitSummary = await llmService.generatePostVisitSummary(notes);

    appointment.postVisitNotes = notes;
    appointment.prescription = prescription || [];
    appointment.postVisitSummary = postVisitSummary;
    appointment.status = 'completed';
    await appointment.save();

    // Create medication reminders from the structured prescription.
    const today = new Date().toISOString().slice(0, 10);
    for (const item of prescription || []) {
      const frequencyPerDay = Number(item.frequencyPerDay) || 1;
      const durationDays = Number(item.durationDays) || 5;
      const timesOfDay = defaultTimesForFrequency(frequencyPerDay);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      await MedicationReminder.create({
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        medicationName: item.medication,
        dosage: item.dosage || null,
        frequencyPerDay,
        timesOfDay,
        startDate: today,
        endDate: endDate.toISOString().slice(0, 10),
      });
    }

    await sendEmail({
      type: 'reminder',
      recipientEmail: appointment.patient.email,
      recipientUserId: appointment.patient.id,
      appointmentId: appointment.id,
      subject: 'Your visit summary is ready',
      body:
        `Hi ${appointment.patient.name},\n\n${postVisitSummary.summaryText}\n\n` +
        `Medication schedule: ${postVisitSummary.medicationSchedule}\n\n` +
        `Follow-up: ${postVisitSummary.followUpSteps}\n\n- Healthcare Appointment & Follow-up Manager`,
    });

    res.json({ appointment });
  })
);

function defaultTimesForFrequency(n) {
  const table = {
    1: ['09:00'],
    2: ['09:00', '21:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
  };
  return table[n] || table[1];
}

// ---- Patient's medication reminders ----

router.get(
  '/medication/mine',
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const reminders = await MedicationReminder.findAll({
      where: { patientId: req.user.id },
      order: [['startDate', 'DESC']],
    });
    res.json({ reminders });
  })
);

module.exports = router;

const { Op } = require('sequelize');
const { Appointment, DoctorLeave, User } = require('../models');
const calendarService = require('./calendarService');
const { sendEmail } = require('./emailService');

async function markDoctorLeave(profile, date, reason) {
  const [leave] = await DoctorLeave.findOrCreate({
    where: { doctorId: profile.id, date },
    defaults: { doctorId: profile.id, date, reason },
  });

  const affected = await Appointment.findAll({
    where: {
      doctorId: profile.id,
      status: { [Op.in]: ['pending', 'confirmed'] },
      slotStart: { [Op.between]: [new Date(`${date}T00:00:00`), new Date(`${date}T23:59:59.999`)] },
    },
    include: [{ model: User, as: 'patient', attributes: { exclude: ['passwordHash', 'googleRefreshToken'] } }],
  });

  const notified = [];
  for (const appointment of affected) {
    appointment.status = 'cancelled';
    appointment.cancelReason = `Doctor on leave${reason ? `: ${reason}` : ''}`;
    await appointment.save();

    if (appointment.calendarEventIdPatient) {
      await calendarService.deleteEvent({ refreshToken: appointment.patient?.googleRefreshToken, eventId: appointment.calendarEventIdPatient });
    }
    if (appointment.calendarEventIdDoctor) {
      await calendarService.deleteEvent({ refreshToken: profile.user?.googleRefreshToken, eventId: appointment.calendarEventIdDoctor });
    }

    await sendEmail({
      type: 'leave_notice',
      recipientEmail: appointment.patient.email,
      recipientUserId: appointment.patient.id,
      appointmentId: appointment.id,
      subject: 'Your appointment has been cancelled (doctor on leave)',
      body:
        `Hi ${appointment.patient.name},\n\nUnfortunately Dr. ${profile.user.name} is on leave on ${date}` +
        `${reason ? ` (${reason})` : ''}, so your appointment scheduled at ` +
        `${appointment.slotStart.toISOString()} has been cancelled.\n\n` +
        `Please book a new slot at your convenience. We're sorry for the inconvenience.\n\n` +
        `- Healthcare Appointment & Follow-up Manager`,
    });
    notified.push(appointment.patient.email);
  }

  return { leave, affectedAppointments: affected.length, notifiedPatients: notified };
}

module.exports = { markDoctorLeave };
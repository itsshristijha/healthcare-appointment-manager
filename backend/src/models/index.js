const sequelize = require('../config/database');
const User = require('./User');
const DoctorProfile = require('./DoctorProfile');
const DoctorLeave = require('./DoctorLeave');
const SlotHold = require('./SlotHold');
const Appointment = require('./Appointment');
const MedicationReminder = require('./MedicationReminder');
const NotificationLog = require('./NotificationLog');

// User <-> DoctorProfile (1:1)
User.hasOne(DoctorProfile, { foreignKey: 'userId', as: 'doctorProfile', onDelete: 'CASCADE' });
DoctorProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// DoctorProfile -> DoctorLeave (1:many)
DoctorProfile.hasMany(DoctorLeave, { foreignKey: 'doctorId', as: 'leaves', onDelete: 'CASCADE' });
DoctorLeave.belongsTo(DoctorProfile, { foreignKey: 'doctorId', as: 'doctor' });

// DoctorProfile -> SlotHold
DoctorProfile.hasMany(SlotHold, { foreignKey: 'doctorId', as: 'slotHolds', onDelete: 'CASCADE' });
SlotHold.belongsTo(DoctorProfile, { foreignKey: 'doctorId', as: 'doctor' });
User.hasMany(SlotHold, { foreignKey: 'patientId', as: 'slotHolds', onDelete: 'CASCADE' });
SlotHold.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });

// Appointment relations
User.hasMany(Appointment, { foreignKey: 'patientId', as: 'appointmentsAsPatient' });
Appointment.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });

DoctorProfile.hasMany(Appointment, { foreignKey: 'doctorId', as: 'appointments' });
Appointment.belongsTo(DoctorProfile, { foreignKey: 'doctorId', as: 'doctor' });

// MedicationReminder
Appointment.hasMany(MedicationReminder, { foreignKey: 'appointmentId', as: 'medicationReminders', onDelete: 'CASCADE' });
MedicationReminder.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

// NotificationLog
Appointment.hasMany(NotificationLog, { foreignKey: 'appointmentId', as: 'notifications' });
NotificationLog.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

module.exports = {
  sequelize,
  User,
  DoctorProfile,
  DoctorLeave,
  SlotHold,
  Appointment,
  MedicationReminder,
  NotificationLog,
};

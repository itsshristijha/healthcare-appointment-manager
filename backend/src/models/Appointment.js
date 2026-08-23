const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Appointment extends Model {}

Appointment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    patientId: { type: DataTypes.UUID, allowNull: false },
    doctorId: { type: DataTypes.UUID, allowNull: false },
    slotStart: { type: DataTypes.DATE, allowNull: false },
    slotEnd: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    cancelReason: { type: DataTypes.STRING, allowNull: true },

    // Pre-visit
    symptomText: { type: DataTypes.TEXT, allowNull: true },
    preVisitSummary: { type: DataTypes.JSONB, allowNull: true },
    // shape: { urgencyLevel, chiefComplaint, suggestedQuestions: [..], generatedBy, generatedAt, error? }

    // Post-visit
    postVisitNotes: { type: DataTypes.TEXT, allowNull: true },
    prescription: { type: DataTypes.JSONB, allowNull: true },
    // shape: [{ medication, dosage, frequencyPerDay, durationDays, instructions }]
    postVisitSummary: { type: DataTypes.JSONB, allowNull: true },
    // shape: { summaryText, medicationSchedule, followUpSteps, generatedBy, generatedAt, error? }

    // Calendar
    calendarEventIdPatient: { type: DataTypes.STRING, allowNull: true },
    calendarEventIdDoctor: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    timestamps: true,
    indexes: [
      // Partial unique index: only one non-cancelled appointment may occupy
      // a given doctor+slot at a time. A cancelled slot frees up for reuse.
      {
        unique: true,
        fields: ['doctorId', 'slotStart'],
        where: { status: ['pending', 'confirmed'] },
        name: 'uniq_active_doctor_slot',
      },
    ],
  }
);

module.exports = Appointment;

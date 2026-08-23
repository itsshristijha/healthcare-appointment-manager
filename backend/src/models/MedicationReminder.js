const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class MedicationReminder extends Model {}

MedicationReminder.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    appointmentId: { type: DataTypes.UUID, allowNull: false },
    patientId: { type: DataTypes.UUID, allowNull: false },
    medicationName: { type: DataTypes.STRING, allowNull: false },
    dosage: { type: DataTypes.STRING, allowNull: true },
    frequencyPerDay: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    timesOfDay: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }, // e.g. ["09:00","21:00"]
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    lastSentAt: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'MedicationReminder', tableName: 'medication_reminders', timestamps: true }
);

module.exports = MedicationReminder;

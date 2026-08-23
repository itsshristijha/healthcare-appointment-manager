const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// workingHours shape:
// { "mon": [{"start":"09:00","end":"13:00"},{"start":"14:00","end":"17:00"}], "tue": [...], ... }
class DoctorProfile extends Model {}

DoctorProfile.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    specialization: { type: DataTypes.STRING, allowNull: false },
    bio: { type: DataTypes.TEXT, allowNull: true },
    workingHours: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    slotDurationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  },
  { sequelize, modelName: 'DoctorProfile', tableName: 'doctor_profiles', timestamps: true }
);

module.exports = DoctorProfile;

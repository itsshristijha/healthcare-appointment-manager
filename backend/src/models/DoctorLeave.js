const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class DoctorLeave extends Model {}

DoctorLeave.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    doctorId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'DoctorLeave',
    tableName: 'doctor_leaves',
    timestamps: true,
    indexes: [{ unique: true, fields: ['doctorId', 'date'] }],
  }
);

module.exports = DoctorLeave;

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// A short-lived reservation created the moment a patient starts confirming a
// slot, so two patients can't both be mid-checkout on the same slot. See
// SYSTEM_DESIGN.md for the full mechanism.
class SlotHold extends Model {}

SlotHold.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    doctorId: { type: DataTypes.UUID, allowNull: false },
    patientId: { type: DataTypes.UUID, allowNull: false },
    slotStart: { type: DataTypes.DATE, allowNull: false },
    slotEnd: { type: DataTypes.DATE, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: 'SlotHold',
    tableName: 'slot_holds',
    timestamps: true,
    indexes: [{ unique: true, fields: ['doctorId', 'slotStart'] }],
  }
);

module.exports = SlotHold;

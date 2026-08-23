const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class User extends Model {
  toSafeJSON() {
    const { id, name, email, role, phone, createdAt } = this;
    return { id, name, email, role, phone, createdAt };
  }
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('patient', 'doctor', 'admin'), allowNull: false, defaultValue: 'patient' },
    phone: { type: DataTypes.STRING, allowNull: true },
    // Set once the user completes the Google OAuth consent flow (see
    // routes/calendar.js). Null means calendar events for this user are
    // created in mock mode even if the app-wide Google credentials are set.
    googleRefreshToken: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'User', tableName: 'users', timestamps: true }
);

module.exports = User;

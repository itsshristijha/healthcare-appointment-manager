const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class NotificationLog extends Model {}

NotificationLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: {
      type: DataTypes.ENUM(
        'booking_confirmation',
        'reminder',
        'cancellation',
        'leave_notice',
        'medication_reminder'
      ),
      allowNull: false,
    },
    channel: { type: DataTypes.ENUM('email'), allowNull: false, defaultValue: 'email' },
    recipientEmail: { type: DataTypes.STRING, allowNull: false },
    recipientUserId: { type: DataTypes.UUID, allowNull: true },
    appointmentId: { type: DataTypes.UUID, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'permanently_failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    retryCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastError: { type: DataTypes.TEXT, allowNull: true },
    nextRetryAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'NotificationLog', tableName: 'notification_logs', timestamps: true }
);

module.exports = NotificationLog;

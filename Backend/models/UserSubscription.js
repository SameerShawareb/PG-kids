const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserSubscription = sequelize.define('UserSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active', // active, cancelled, expired
  }
}, {
  tableName: 'user_subscriptions',
  timestamps: true,
  indexes: [
    { name: 'idx_user_subscriptions_user_status_model', fields: ['userId', 'status'] },
    { name: 'idx_user_subscriptions_plan_id_model', fields: ['planId'] },
    { name: 'idx_user_subscriptions_end_date_model', fields: ['end_date'] },
  ],
});

module.exports = UserSubscription;
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  billing_cycle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  duration_days: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  stream_limit: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  quality_limit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  access_level: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trial_period_days: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  auto_renewal: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  archived_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'subscription_plans',
  timestamps: true,
  indexes: [
    { name: 'idx_subscription_plans_active_model', fields: ['is_active'] },
    { name: 'idx_subscription_plans_archived_model', fields: ['is_archived'] },
    { name: 'idx_subscription_plans_access_level_model', fields: ['access_level'] },
  ],
});

module.exports = SubscriptionPlan;

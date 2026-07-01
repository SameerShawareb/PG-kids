const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
    role: {
    type: DataTypes.STRING,
    defaultValue: 'parent', // parent, admin, content_manager
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  preferred_language: {
    type: DataTypes.STRING(8),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  password_changed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  parent_pin_hash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parent_pin_updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'users',
  timestamps: true,
    indexes: [
    { name: 'idx_users_role_model', fields: ['role'] },
    { name: 'idx_users_is_active_model', fields: ['is_active'] },
    { name: 'idx_users_preferred_language_model', fields: ['preferred_language'] },
  ],
});

module.exports = User;

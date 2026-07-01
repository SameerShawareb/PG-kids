const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChildProfile = sequelize.define('ChildProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date_of_birth: {
    type: DataTypes.DATEONLY, // لتصفية المحتوى بناءً على العمر
    allowNull: false,
  },
    avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  profile_locked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  favorited_worlds: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'child_profiles',
  timestamps: true,
    indexes: [
    { name: 'idx_child_profiles_user_id_model', fields: ['userId'] },
    { name: 'idx_child_profiles_profile_locked_model', fields: ['profile_locked'] },
  ],
});

module.exports = ChildProfile;
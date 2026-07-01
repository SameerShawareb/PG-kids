const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Episode = sequelize.define('Episode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  episode_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'episodes',
  timestamps: true,
  indexes: [
    { name: 'idx_episodes_season_number_unique_model', unique: true, fields: ['seasonId', 'episode_number'] },
    { name: 'idx_episodes_content_id_model', fields: ['contentId'] },
    { name: 'idx_episodes_active_model', fields: ['is_active'] },
  ],
});

module.exports = Episode;

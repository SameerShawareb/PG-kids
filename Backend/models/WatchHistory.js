const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WatchHistory = sequelize.define('WatchHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  profileId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  contentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  last_watched_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  watch_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  last_position_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  completion_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
}, {
  tableName: 'watch_history',
  timestamps: true,
  indexes: [
    { name: 'idx_watch_history_profile_id', fields: ['profileId'] },
    { name: 'idx_watch_history_content_id', fields: ['contentId'] },
    { name: 'idx_watch_history_profile_last_watched', fields: ['profileId', 'last_watched_at'] },
    { name: 'uniq_watch_history_profile_content', unique: true, fields: ['profileId', 'contentId'] },
  ],
});

module.exports = WatchHistory;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Season = sequelize.define('Season', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  season_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'seasons',
  timestamps: true,
  indexes: [
    { name: 'idx_seasons_series_number_unique_model', unique: true, fields: ['seriesId', 'season_number'] },
    { name: 'idx_seasons_active_model', fields: ['is_active'] },
  ],
});

module.exports = Season;

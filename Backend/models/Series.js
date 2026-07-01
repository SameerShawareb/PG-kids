const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Series = sequelize.define('Series', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
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
  tableName: 'series',
  timestamps: true,
  indexes: [
    { name: 'idx_series_category_id_model', fields: ['categoryId'] },
    { name: 'idx_series_active_model', fields: ['is_active'] },
  ],
});

module.exports = Series;

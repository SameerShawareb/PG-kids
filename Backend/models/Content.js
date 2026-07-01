const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Content = sequelize.define('Content', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  file_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
    media_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  video_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  thumbnail_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  thumbnail_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  original_filename: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mime_type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  age_group: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  series_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  season_number: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  episode_number: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  access_level: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quality_level: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  release_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  tableName: 'contents',
  timestamps: true,
  indexes: [
    { name: 'idx_contents_published_model', fields: ['is_published'] },
    { name: 'idx_contents_archived_model', fields: ['is_archived'] },
    { name: 'idx_contents_category_id_model', fields: ['categoryId'] },
    { name: 'idx_contents_series_id_model', fields: ['seriesId'] },
    { name: 'idx_contents_season_id_model', fields: ['seasonId'] },
    { name: 'idx_contents_title_model', fields: ['title'] },
    { name: 'idx_contents_type_model', fields: ['type'] },
    { name: 'idx_contents_age_group_model', fields: ['age_group'] },
    { name: 'idx_contents_access_level_model', fields: ['access_level'] },
    { name: 'idx_contents_published_at_model', fields: ['published_at'] },
  ],
});

module.exports = Content;

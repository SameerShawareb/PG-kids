const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entity: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  indexes: [
    { name: 'idx_audit_logs_actor_id_model', fields: ['actorId'] },
    { name: 'idx_audit_logs_created_at_model', fields: ['createdAt'] },
    { name: 'idx_audit_logs_entity_model', fields: ['entity', 'entityId'] },
  ],
});

module.exports = AuditLog;

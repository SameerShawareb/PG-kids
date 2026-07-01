const writeAuditLog = async ({ actorId = null, action, entity, entityId = null, metadata = null, transaction = null }) => {
  try {
    const { AuditLog } = require('../models');
    if (!AuditLog) return;
    await AuditLog.create({ actorId, action, entity, entityId, metadata }, { transaction });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = { writeAuditLog };

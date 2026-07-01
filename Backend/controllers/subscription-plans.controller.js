const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { sequelize, SubscriptionPlan, UserSubscription } = require('../models');
const { success, error } = require('../utils/apiResponse');
const {
  sanitizeText,
  sanitizeOptionalText,
  toBoolean,
  toNonNegativeDecimal,
  toPositiveInteger,
} = require('../utils/security');
const { writeAuditLog } = require('../utils/audit');

const BILLING_CYCLES = ['monthly', 'annual', 'one-time', 'custom'];
const QUALITY_LIMITS = ['basic', 'standard', 'premium', '4k'];
const ARCHIVE_STATUS_VALUES = ['active', 'archived', 'all'];

const normalizeBillingCycle = (value) => sanitizeText(value, 40).toLowerCase();
const normalizeQualityLimit = (value) => value ? sanitizeText(value, 40).toLowerCase() : null;

const serializePlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  price: Number(plan.price),
  billing_cycle: plan.billing_cycle,
  duration_days: plan.duration_days,
  stream_limit: plan.stream_limit,
  quality_limit: plan.quality_limit,
  access_level: plan.access_level,
  trial_period_days: plan.trial_period_days,
  auto_renewal: plan.auto_renewal,
  is_active: plan.is_active,
  is_archived: plan.is_archived,
  archived_at: plan.archived_at,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

const validatePlanPayload = (body, { partial = false } = {}) => {
  const data = {};

  if (!partial || body.name !== undefined) {
    data.name = sanitizeText(body.name, 120);
    if (!data.name) throw new Error('Plan name is required');
  }

  if (!partial || body.price !== undefined) {
    data.price = toNonNegativeDecimal(body.price, 'price', { required: !partial });
  }

  if (!partial || body.billing_cycle !== undefined) {
    data.billing_cycle = normalizeBillingCycle(body.billing_cycle);
    if (!data.billing_cycle) throw new Error('Billing cycle is required');
    if (!BILLING_CYCLES.includes(data.billing_cycle)) {
      throw new Error(`Billing cycle must be one of: ${BILLING_CYCLES.join(', ')}`);
    }
  }

  if (body.description !== undefined) data.description = sanitizeOptionalText(body.description, 2000);
  if (body.duration_days !== undefined) data.duration_days = toPositiveInteger(body.duration_days, 'duration_days', { min: 1, max: 3660 });
  if (body.stream_limit !== undefined) data.stream_limit = toPositiveInteger(body.stream_limit, 'stream_limit', { min: 1, max: 1000 });
  if (body.trial_period_days !== undefined) data.trial_period_days = toPositiveInteger(body.trial_period_days, 'trial_period_days', { min: 0, max: 365 });
  if (body.access_level !== undefined) data.access_level = sanitizeOptionalText(body.access_level, 80);
  if (body.auto_renewal !== undefined) data.auto_renewal = toBoolean(body.auto_renewal, true);

  if (body.quality_limit !== undefined) {
    data.quality_limit = normalizeQualityLimit(body.quality_limit);
    if (data.quality_limit && !QUALITY_LIMITS.includes(data.quality_limit)) {
      throw new Error(`Quality limit must be one of: ${QUALITY_LIMITS.join(', ')}`);
    }
  }

  if (body.is_active !== undefined) data.is_active = toBoolean(body.is_active, true);

  return data;
};

const assertUniquePlanName = async (name, excludeId = null) => {
  const existing = await SubscriptionPlan.findOne({
    where: {
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      [Op.and]: sequelizeWhere(fn('LOWER', col('name')), name.toLowerCase()),
    },
  });

  if (existing) throw new Error('A subscription plan with this name already exists');
};

const resolveArchiveScope = (archiveStatusRaw = 'active') => {
  const archiveStatus = sanitizeText(archiveStatusRaw || 'active', 20).toLowerCase() || 'active';
  if (!ARCHIVE_STATUS_VALUES.includes(archiveStatus)) {
    throw new Error(`archive_status must be one of: ${ARCHIVE_STATUS_VALUES.join(', ')}`);
  }

  if (archiveStatus === 'archived') return { archiveStatus, where: { is_archived: true } };
  if (archiveStatus === 'all') return { archiveStatus, where: {} };
  return { archiveStatus: 'active', where: { is_archived: false } };
};

const listAdminPlans = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const offset = (page - 1) * limit;

    const { archiveStatus, where } = resolveArchiveScope(req.query.archive_status);

    const { count, rows } = await SubscriptionPlan.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'ASC']],
      limit,
      offset,
    });

    return success(res, 200, 'Subscription plans loaded successfully', rows.map(serializePlan), {
      page,
      limit,
      totalResults: count,
      totalPages: Math.ceil(count / limit),
      archive_status: archiveStatus,
    });
  } catch (err) {
    if (err.message?.includes('archive_status')) return error(res, 400, err.message);
    console.error('List plans error:', err.message);
    return error(res, 500, 'Unable to load subscription plans');
  }
};

const listActivePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.findAll({ where: { is_active: true, is_archived: false }, order: [['price', 'ASC']] });
    return success(res, 200, 'Active subscription plans loaded successfully', plans.map(serializePlan));
  } catch (err) {
    console.error('List active plans error:', err.message);
    return error(res, 500, 'Unable to load active subscription plans');
  }
};

const createPlan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const payload = validatePlanPayload(req.body);
    await assertUniquePlanName(payload.name);

    const plan = await SubscriptionPlan.create(payload, { transaction });
    await writeAuditLog({
      actorId: req.user.id,
      action: 'SUBSCRIPTION_PLAN_CREATED',
      entity: 'SubscriptionPlan',
      entityId: plan.id,
      metadata: { name: plan.name },
      transaction,
    });

    await transaction.commit();
    return success(res, 201, 'Subscription plan created successfully', serializePlan(plan));
  } catch (err) {
    await transaction.rollback();
    if (err.name === 'SequelizeUniqueConstraintError' || err.message.includes('already exists')) {
      return error(res, 409, 'A subscription plan with this name already exists');
    }
    if (err.message) return error(res, 400, err.message);
    console.error('Create plan error:', err);
    return error(res, 500, 'Unable to create subscription plan');
  }
};

const updatePlan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.planId, { transaction });
    if (!plan) {
      await transaction.rollback();
      return error(res, 404, 'Subscription plan was not found');
    }

    const payload = validatePlanPayload(req.body, { partial: true });
    if (payload.name) await assertUniquePlanName(payload.name, plan.id);

    await plan.update(payload, { transaction });
    await writeAuditLog({
      actorId: req.user.id,
      action: 'SUBSCRIPTION_PLAN_UPDATED',
      entity: 'SubscriptionPlan',
      entityId: plan.id,
      metadata: { fields: Object.keys(payload) },
      transaction,
    });

    await transaction.commit();
    return success(res, 200, 'Subscription plan updated successfully', serializePlan(plan));
  } catch (err) {
    await transaction.rollback();
    if (err.name === 'SequelizeUniqueConstraintError' || err.message.includes('already exists')) {
      return error(res, 409, 'A subscription plan with this name already exists');
    }
    if (err.message) return error(res, 400, err.message);
    console.error('Update plan error:', err);
    return error(res, 500, 'Unable to update subscription plan');
  }
};

const setPlanStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.planId, { transaction });
    if (!plan) {
      await transaction.rollback();
      return error(res, 404, 'Subscription plan was not found');
    }

    const is_active = toBoolean(req.body.is_active, plan.is_active);
    await plan.update({ is_active }, { transaction });

    const activeSubscriptions = await UserSubscription.count({
      where: { planId: plan.id, status: 'active' },
      transaction,
    });

    await writeAuditLog({
      actorId: req.user.id,
      action: is_active ? 'SUBSCRIPTION_PLAN_ACTIVATED' : 'SUBSCRIPTION_PLAN_DEACTIVATED',
      entity: 'SubscriptionPlan',
      entityId: plan.id,
      metadata: { activeSubscriptionsPreserved: activeSubscriptions },
      transaction,
    });

    await transaction.commit();
    return success(
      res,
      200,
      is_active
        ? 'Subscription plan activated successfully'
        : 'Subscription plan deactivated successfully. Existing active subscribers were preserved.',
      serializePlan(plan),
      { activeSubscriptionsPreserved: activeSubscriptions }
    );
  } catch (err) {
    await transaction.rollback();
    console.error('Set plan status error:', err.message);
    return error(res, 500, 'Unable to update subscription plan status');
  }
};


const archivePlan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.planId, { transaction });
    if (!plan) {
      await transaction.rollback();
      return error(res, 404, 'Subscription plan was not found');
    }

    const activeSubscriptions = await UserSubscription.count({
      where: { planId: plan.id, status: 'active' },
      transaction,
    });

    await plan.update({ is_active: false, is_archived: true, archived_at: new Date() }, { transaction });
    await writeAuditLog({
      actorId: req.user.id,
      action: 'SUBSCRIPTION_PLAN_ARCHIVED',
      entity: 'SubscriptionPlan',
      entityId: plan.id,
      metadata: { activeSubscriptionsPreserved: activeSubscriptions },
      transaction,
    });

    await transaction.commit();
    return success(
      res,
      200,
      'Subscription plan archived successfully. Existing active subscriptions were preserved.',
      serializePlan(plan),
      { activeSubscriptionsPreserved: activeSubscriptions }
    );
  } catch (err) {
    await transaction.rollback();
    console.error('Archive plan error:', err.message);
    return error(res, 500, 'Unable to archive subscription plan');
  }
};

const restorePlan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const plan = await SubscriptionPlan.findByPk(req.params.planId, { transaction });
    if (!plan) {
      await transaction.rollback();
      return error(res, 404, 'Subscription plan was not found');
    }

    if (!plan.is_archived) {
      await transaction.commit();
      return success(res, 200, 'Subscription plan is already active', serializePlan(plan));
    }

    await plan.update({ is_archived: false, archived_at: null }, { transaction });
    await writeAuditLog({
      actorId: req.user.id,
      action: 'SUBSCRIPTION_PLAN_RESTORED',
      entity: 'SubscriptionPlan',
      entityId: plan.id,
      transaction,
    });

    await transaction.commit();
    return success(res, 200, 'Subscription plan restored successfully', serializePlan(plan));
  } catch (err) {
    await transaction.rollback();
    console.error('Restore plan error:', err.message);
    return error(res, 500, 'Unable to restore subscription plan');
  }
};

module.exports = {
  listAdminPlans,
  listActivePlans,
  createPlan,
  updatePlan,
  setPlanStatus,
  archivePlan,
  restorePlan,
};

const { Op } = require('sequelize');
const { sequelize, UserSubscription, SubscriptionPlan } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { sanitizeText, isUuid } = require('../utils/security');
const { writeAuditLog } = require('../utils/audit');
const { findActiveSubscription } = require('../utils/contentAccess');

const serializeSubscription = (subscription) => {
  if (!subscription) return null;
  return {
    id: subscription.id,
    status: subscription.status,
    start_date: subscription.start_date,
    end_date: subscription.end_date,
    plan: subscription.plan ? {
      id: subscription.plan.id,
      name: subscription.plan.name,
      price: subscription.plan.price,
      billing_cycle: subscription.plan.billing_cycle,
      duration_days: subscription.plan.duration_days,
      stream_limit: subscription.plan.stream_limit,
      quality_limit: subscription.plan.quality_limit,
      access_level: subscription.plan.access_level,
      is_active: subscription.plan.is_active,
    } : null,
  };
};

const resolveDurationDays = (plan) => {
  if (plan.duration_days && Number(plan.duration_days) > 0) return Number(plan.duration_days);
  if (plan.billing_cycle === 'annual') return 365;
  if (plan.billing_cycle === 'monthly') return 30;
  if (plan.billing_cycle === 'one-time') return 3650;
  return 30;
};

const getMySubscription = async (req, res) => {
  try {
    const subscription = await findActiveSubscription(req.user.id);
    return success(res, 200, subscription ? 'Active subscription loaded successfully' : 'No active subscription found', serializeSubscription(subscription));
  } catch (err) {
    console.error('Load subscription error:', err.message);
    return error(res, 500, 'Unable to load subscription');
  }
};

const activateSubscription = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const planId = sanitizeText(req.body.planId || req.body.plan_id, 80);
    if (!isUuid(planId)) throw new Error('A valid planId is required');

    const plan = await SubscriptionPlan.findByPk(planId, { transaction });
    if (!plan || !plan.is_active || plan.is_archived) {
      throw new Error('Selected subscription plan is not available');
    }

    const now = new Date();
    const end = new Date(now.getTime() + resolveDurationDays(plan) * 24 * 60 * 60 * 1000);

    await UserSubscription.update(
      { status: 'cancelled' },
      {
        where: {
          userId: req.user.id,
          status: 'active',
          end_date: { [Op.gte]: now },
        },
        transaction,
      }
    );

    const subscription = await UserSubscription.create({
      userId: req.user.id,
      planId: plan.id,
      start_date: now,
      end_date: end,
      status: 'active',
    }, { transaction });

    await writeAuditLog({
      actorId: req.user.id,
      action: 'SUBSCRIPTION_ACTIVATED',
      entity: 'UserSubscription',
      entityId: subscription.id,
      metadata: { planId: plan.id, planName: plan.name },
      transaction,
    });

    await transaction.commit();

    const created = await UserSubscription.findByPk(subscription.id, { include: [{ model: SubscriptionPlan, as: 'plan' }] });
    return success(res, 201, 'Subscription activated successfully', serializeSubscription(created));
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to activate subscription');
  }
};

const cancelMySubscription = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const subscription = await findActiveSubscription(req.user.id, transaction);
    if (!subscription) {
      await transaction.rollback();
      return error(res, 404, 'No active subscription was found');
    }

    await subscription.update({ status: 'cancelled' }, { transaction });
    await writeAuditLog({
      actorId: req.user.id,
      action: 'SUBSCRIPTION_CANCELLED',
      entity: 'UserSubscription',
      entityId: subscription.id,
      transaction,
    });

    await transaction.commit();
    return success(res, 200, 'Subscription cancelled successfully', serializeSubscription(subscription));
  } catch (err) {
    await transaction.rollback();
    console.error('Cancel subscription error:', err.message);
    return error(res, 500, 'Unable to cancel subscription');
  }
};

module.exports = {
  getMySubscription,
  activateSubscription,
  cancelMySubscription,
};

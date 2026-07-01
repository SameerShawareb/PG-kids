const { Op } = require('sequelize');
const { User, UserSubscription, SubscriptionPlan, ChildProfile } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { sanitizeText, normalizeRole, ALLOWED_ROLES, toStrictBoolean, isUuid } = require('../utils/security');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { writeAuditLog } = require('../utils/audit');

const safeUserDto = (user, subscription = null) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  preferred_language: user.preferred_language || null,
  role: user.role,
  is_active: Boolean(user.is_active),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  subscription: subscription ? {
    id: subscription.id,
    status: subscription.status,
    start_date: subscription.start_date,
    end_date: subscription.end_date,
    plan: subscription.plan ? {
      id: subscription.plan.id,
      name: subscription.plan.name,
      access_level: subscription.plan.access_level,
      is_active: subscription.plan.is_active,
      is_archived: subscription.plan.is_archived,
    } : null,
  } : null,
});

const loadCurrentSubscriptionMap = async (userIds) => {
  if (!userIds.length) return new Map();
  const now = new Date();

  const subscriptions = await UserSubscription.findAll({
    where: {
      userId: { [Op.in]: userIds },
      status: 'active',
      start_date: { [Op.lte]: now },
      end_date: { [Op.gte]: now },
    },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
    order: [['end_date', 'DESC']],
  });

  const subscriptionMap = new Map();
  for (const sub of subscriptions) {
    if (!subscriptionMap.has(sub.userId)) subscriptionMap.set(sub.userId, sub);
  }
  return subscriptionMap;
};

const listUsers = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const search = sanitizeText(req.query.search, 120);
    const role = sanitizeText(req.query.role, 30).toLowerCase();
    const status = sanitizeText(req.query.status, 20).toLowerCase();

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      const normalizedRole = normalizeRole(role);
      if (!ALLOWED_ROLES.includes(normalizedRole) || normalizedRole !== role) {
        return error(res, 400, `role must be one of: ${ALLOWED_ROLES.join(', ')}`);
      }
      where.role = normalizedRole;
    }

    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        return error(res, 400, 'status must be one of: active, inactive');
      }
      where.is_active = status === 'active';
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'name', 'email', 'phone', 'preferred_language', 'role', 'is_active', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC'], ['id', 'ASC']],
      limit,
      offset,
    });

    const subscriptionMap = await loadCurrentSubscriptionMap(rows.map((row) => row.id));
    const data = rows.map((row) => safeUserDto(row, subscriptionMap.get(row.id) || null));

    return success(res, 200, 'Users loaded successfully', data, paginationMeta({ page, limit, count }));
  } catch (err) {
    console.error('Admin list users error:', err.message);
    return error(res, 500, 'Unable to load users');
  }
};

const getUserDetails = async (req, res) => {
  try {
    const userId = sanitizeText(req.params.userId, 80);
    if (!isUuid(userId)) return error(res, 400, 'userId must be a valid UUID');

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'phone', 'preferred_language', 'role', 'is_active', 'createdAt', 'updatedAt'],
    });

    if (!user) return error(res, 404, 'User was not found');

    const subscriptionMap = await loadCurrentSubscriptionMap([user.id]);
    const childProfilesCount = await ChildProfile.count({ where: { userId: user.id } });

    return success(res, 200, 'User details loaded successfully', {
      ...safeUserDto(user, subscriptionMap.get(user.id) || null),
      child_profiles: { total: childProfilesCount },
    });
  } catch (err) {
    console.error('Admin get user details error:', err.message);
    return error(res, 500, 'Unable to load user details');
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const userId = sanitizeText(req.params.userId, 80);
    if (!isUuid(userId)) return error(res, 400, 'userId must be a valid UUID');

    const isActive = toStrictBoolean(req.body.is_active, 'is_active');

    const user = await User.findByPk(userId);
    if (!user) return error(res, 404, 'User was not found');

    if (!isActive && user.id === req.user.id) {
      return error(res, 400, 'You cannot deactivate your own account');
    }

    if (!isActive && user.role === 'admin') {
      const activeAdmins = await User.count({ where: { role: 'admin', is_active: true } });
      if (activeAdmins <= 1) {
        return error(res, 400, 'Cannot deactivate the last active admin account');
      }
    }

    if (Boolean(user.is_active) === isActive) {
      return success(res, 200, 'User status is already up to date', {
        id: user.id,
        is_active: Boolean(user.is_active),
      });
    }

    await user.update({ is_active: isActive });

    await writeAuditLog({
      actorId: req.user.id,
      action: isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
      entity: 'User',
      entityId: user.id,
      metadata: { is_active: isActive },
    });

    return success(res, 200, isActive ? 'User activated successfully' : 'User deactivated successfully', {
      id: user.id,
      is_active: Boolean(user.is_active),
    });
  } catch (err) {
    if (err.message?.includes('must be a boolean')) return error(res, 400, err.message);
    console.error('Admin update user status error:', err.message);
    return error(res, 500, 'Unable to update user status');
  }
};

module.exports = {
  listUsers,
  getUserDetails,
  updateUserStatus,
};

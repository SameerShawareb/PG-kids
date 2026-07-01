const path = require('path');
const fs = require('fs/promises');
const { Op } = require('sequelize');
const { UserSubscription, SubscriptionPlan, ChildProfile } = require('../models');
const { verifyParentUnlockToken } = require('./token');
const { PROJECT_ROOT, UPLOAD_ROOT } = require('./mediaStorage');

const ACCESS_RANK = {
  free: 0,
  basic: 1,
  standard: 2,
  premium: 3,
  '4k': 4,
  ultra: 4,
  vip: 5,
};

const normalizeAccessLevel = (value) => String(value || 'free').trim().toLowerCase();

const accessLevelAllows = (planLevel, contentLevel) => {
  const content = normalizeAccessLevel(contentLevel);
  const plan = normalizeAccessLevel(planLevel || 'basic');
  if (!content || content === 'free') return true;
  if (ACCESS_RANK[plan] !== undefined && ACCESS_RANK[content] !== undefined) {
    return ACCESS_RANK[plan] >= ACCESS_RANK[content];
  }
  return plan === content;
};

const calculateAge = (dobString) => {
  const dob = new Date(dobString);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
};

const parseMinimumAge = (ageGroup) => {
  if (!ageGroup || String(ageGroup).trim().toLowerCase() === 'all') return null;

  const normalized = String(ageGroup).trim().toLowerCase();
  const [rangeStart] = normalized.split('-');
  const fromRange = Number(rangeStart);
  if (Number.isFinite(fromRange)) return fromRange;

  const match = normalized.match(/\d+/);
  if (!match) return null;

  const fromMatch = Number(match[0]);
  return Number.isFinite(fromMatch) ? fromMatch : null;
};

const ageGroupAllows = (ageGroup, age) => {
  const minimumAge = parseMinimumAge(ageGroup);
  if (minimumAge === null) return true;
  return age >= minimumAge;
};

const findActiveSubscription = async (userId, transaction = null) => {
  const now = new Date();
  return UserSubscription.findOne({
    where: {
      userId,
      status: 'active',
      start_date: { [Op.lte]: now },
      end_date: { [Op.gte]: now },
    },
    include: [{ model: SubscriptionPlan, as: 'plan' }],
    order: [['end_date', 'DESC']],
    transaction,
  });
};

const assertChildProfileAccess = async ({ user, profileId, content, requireProfile = true, parentUnlockToken = null }) => {
  if (!profileId) {
    if (requireProfile && user.role === 'parent') {
      const err = new Error('profileId is required for child content access');
      err.statusCode = 400;
      throw err;
    }
    return null;
  }

  const profile = await ChildProfile.findByPk(profileId);
  if (!profile) {
    const err = new Error('Child profile was not found');
    err.statusCode = 404;
    throw err;
  }

  if (user.role !== 'admin' && profile.userId !== user.id) {
    const err = new Error('You do not have permission to use this child profile');
    err.statusCode = 403;
    throw err;
  }

  if (profile.profile_locked && user.role === 'parent') {
    const unlockPayload = verifyParentUnlockToken(parentUnlockToken, user.id);
    if (!unlockPayload) {
      const err = new Error('Parent unlock verification is required for locked child profile access');
      err.statusCode = 403;
      throw err;
    }
  }

  const age = calculateAge(profile.date_of_birth);
  if (content && !ageGroupAllows(content.age_group, age)) {
    const err = new Error('This content is not suitable for the selected child profile age group');
    err.statusCode = 403;
    throw err;
  }

  return { profile, age };
};

const assertContentPlaybackAccess = async ({ user, content, profileId, parentUnlockToken = null }) => {
  if (!content) {
    const err = new Error('Content was not found');
    err.statusCode = 404;
    throw err;
  }

  if (!content.is_published && !['admin', 'content_manager'].includes(user.role)) {
    const err = new Error('Content is not available');
    err.statusCode = 404;
    throw err;
  }

  if (['admin', 'content_manager'].includes(user.role)) {
    if (profileId) await assertChildProfileAccess({ user, profileId, content, requireProfile: false, parentUnlockToken });
    return { subscription: null, plan: null };
  }

  if (user.role !== 'parent') {
    const err = new Error('Only subscribed parent accounts can access playback');
    err.statusCode = 403;
    throw err;
  }

  await assertChildProfileAccess({ user, profileId, content, requireProfile: true, parentUnlockToken });

  const contentAccessLevel = normalizeAccessLevel(content.access_level);
  if (contentAccessLevel === 'free') {
    return { subscription: null, plan: null, access: 'free' };
  }

  const subscription = await findActiveSubscription(user.id);
  if (!subscription) {
    const err = new Error('An active subscription is required to access this content');
    err.statusCode = 403;
    throw err;
  }

  if (!accessLevelAllows(subscription.plan?.access_level, content.access_level)) {
    const err = new Error('Your subscription plan does not include this content access level');
    err.statusCode = 403;
    throw err;
  }

  return { subscription, plan: subscription.plan, access: 'subscription' };
};

const resolveStoredMediaPath = async (relativePath) => {
  if (!relativePath) return null;
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  const uploadRoot = path.resolve(UPLOAD_ROOT);
  if (!absolutePath.startsWith(uploadRoot + path.sep) && absolutePath !== uploadRoot) {
    throw new Error('Stored media path is outside the upload directory');
  }
  await fs.access(absolutePath);
  return absolutePath;
};

module.exports = {
  ACCESS_RANK,
  accessLevelAllows,
  ageGroupAllows,
  calculateAge,
  findActiveSubscription,
  assertChildProfileAccess,
  assertContentPlaybackAccess,
  resolveStoredMediaPath,
};

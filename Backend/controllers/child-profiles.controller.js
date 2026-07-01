const { ChildProfile } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { sanitizeText, toStrictBoolean } = require('../utils/security');
const { verifyParentUnlockToken } = require('../utils/token');
const { writeAuditLog } = require('../utils/audit');
const { SUPPORTED_WORLD_IDS } = require('../utils/worldAssignment');

const calculateAge = (dobString) => {
  const dob = new Date(dobString);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const normalizeFavoritedWorlds = (value) => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter((item) => SUPPORTED_WORLD_IDS.includes(item));
  return [...new Set(normalized)];
};

const ensureParentOwnership = async (req, profileId) => {
  if (req.user.role !== 'parent') {
    const err = new Error('Only parent accounts can manage profile safety settings');
    err.statusCode = 403;
    throw err;
  }

  const profile = await ChildProfile.findByPk(profileId);
  if (!profile) {
    const err = new Error('Child profile was not found');
    err.statusCode = 404;
    throw err;
  }

  if (profile.userId !== req.user.id) {
    const err = new Error('You do not have permission to access this profile');
    err.statusCode = 403;
    throw err;
  }

  return profile;
};

const listProfiles = async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const profiles = await ChildProfile.findAll({ where, order: [['createdAt', 'DESC']] });
    return success(res, 200, 'Child profiles loaded successfully', profiles);
  } catch (err) {
    console.error('List profiles error:', err.message);
    return error(res, 500, 'Unable to load child profiles');
  }
};

const createProfile = async (req, res) => {
  try {
    const name = sanitizeText(req.body.name, 120);
    const date_of_birth = sanitizeText(req.body.date_of_birth || req.body.dob, 40);
    const avatar = sanitizeText(req.body.avatar || 'default.png', 255);
    const favorited_worlds = normalizeFavoritedWorlds(req.body.favorited_worlds || req.body.favoritedWorlds || []);

    if (!name || !date_of_birth) {
      return error(res, 400, 'Name and date of birth are required');
    }

    const parsedDob = new Date(date_of_birth);
    if (Number.isNaN(parsedDob.getTime()) || parsedDob > new Date()) {
      return error(res, 400, 'A valid date of birth is required');
    }

    const profile = await ChildProfile.create({
      userId: req.user.id,
      name,
      date_of_birth,
      avatar,
      favorited_worlds,
    });

    return success(res, 201, 'Child profile created successfully', profile);
  } catch (err) {
    console.error('Create profile error:', err.message);
    return error(res, 500, 'Unable to create child profile');
  }
};

const updateProfile = async (req, res) => {
  try {
    const profile = await ChildProfile.findByPk(req.params.profileId);
    if (!profile) return error(res, 404, 'Child profile was not found');
    console.log('[DEBUG UPDATE PROFILE] req.user.id:', req.user.id, 'req.user.role:', req.user.role, 'profile.userId:', profile.userId);
    if (req.user.role !== 'admin' && String(profile.userId) !== String(req.user.id)) {
      return error(res, 403, 'You do not have permission to update this profile');
    }

    const payload = {};
    if (req.body.name !== undefined) payload.name = sanitizeText(req.body.name, 120);
    if (req.body.date_of_birth !== undefined || req.body.dob !== undefined) {
      payload.date_of_birth = sanitizeText(req.body.date_of_birth || req.body.dob, 40);
    }
    if (req.body.avatar !== undefined) payload.avatar = sanitizeText(req.body.avatar, 255);
    if (req.body.favorited_worlds !== undefined || req.body.favoritedWorlds !== undefined) {
      payload.favorited_worlds = normalizeFavoritedWorlds(req.body.favorited_worlds || req.body.favoritedWorlds || []);
    }

    await profile.update(payload);
    return success(res, 200, 'Child profile updated successfully', profile);
  } catch (err) {
    console.error('Update profile error:', err.message);
    return error(res, 500, 'Unable to update child profile');
  }
};

const deleteProfile = async (req, res) => {
  try {
    const profile = await ChildProfile.findByPk(req.params.profileId);
    if (!profile) return error(res, 404, 'Child profile was not found');
    if (req.user.role !== 'admin' && String(profile.userId) !== String(req.user.id)) {
      return error(res, 403, 'You do not have permission to delete this profile');
    }

    await profile.destroy();
    return success(res, 200, 'Child profile deleted successfully');
  } catch (err) {
    console.error('Delete profile error:', err.message);
    return error(res, 500, 'Unable to delete child profile');
  }
};

const getProfileSafety = async (req, res) => {
  try {
    const profile = await ensureParentOwnership(req, req.params.profileId);
    return success(res, 200, 'Child profile safety settings loaded successfully', {
      profile_id: profile.id,
      profile_locked: Boolean(profile.profile_locked),
    });
  } catch (err) {
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to load child profile safety settings');
  }
};

const updateProfileSafety = async (req, res) => {
  try {
    const profile = await ensureParentOwnership(req, req.params.profileId);

    const allowedFields = ['profile_locked'];
    const requestFields = Object.keys(req.body || {});
    const unknownFields = requestFields.filter((field) => !allowedFields.includes(field));
    if (unknownFields.length) {
      return error(res, 400, `Unsupported safety fields: ${unknownFields.join(', ')}`);
    }

    if (!requestFields.length) {
      return error(res, 400, 'At least one safety field is required');
    }

    const unlockToken = sanitizeText(req.headers['x-parent-unlock-token'], 600);
    const unlockPayload = verifyParentUnlockToken(unlockToken, req.user.id);
    if (!unlockPayload) {
      return error(res, 403, 'Parent unlock verification is required to update safety settings');
    }

    const profile_locked = toStrictBoolean(req.body.profile_locked, 'profile_locked');

    await profile.update({ profile_locked });

    await writeAuditLog({
      actorId: req.user.id,
      action: 'CHILD_PROFILE_SAFETY_UPDATED',
      entity: 'ChildProfile',
      entityId: profile.id,
      metadata: { fields: ['profile_locked'] },
    });

    return success(res, 200, 'Child profile safety settings updated successfully', {
      profile_id: profile.id,
      profile_locked: Boolean(profile.profile_locked),
    });
  } catch (err) {
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to update child profile safety settings');
  }
};

module.exports = {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfileSafety,
  updateProfileSafety,
  calculateAge,
};

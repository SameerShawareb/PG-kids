const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const { createAuthToken, createParentUnlockToken } = require('../utils/token');
const { success, error } = require('../utils/apiResponse');
const {
  normalizeRole,
  sanitizeText,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  normalizeLanguage,
  isSupportedLanguage,
  isStrongPassword,
  isValidPinFormat,
  isTrivialPin,
} = require('../utils/security');
const { writeAuditLog } = require('../utils/audit');

const USER_SAFE_ATTRIBUTES = [
  'id',
  'name',
  'email',
  'phone',
  'preferred_language',
  'role',
  'is_active',
  'parent_pin_hash',
  'createdAt',
  'updatedAt',
];

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  preferred_language: user.preferred_language || null,
  role: user.role,
  is_active: Boolean(user.is_active),
  has_parent_pin: Boolean(user.parent_pin_hash),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const loadCurrentUserForProfile = async (userId) => User.findByPk(userId, { attributes: USER_SAFE_ATTRIBUTES });

const verifyPasswordCredential = async (user, currentPassword) => {
  if (!currentPassword) return false;
  return bcrypt.compare(String(currentPassword), user.password_hash);
};

const verifyPinCredential = async (user, currentPin) => {
  if (!user.parent_pin_hash || !currentPin) return false;
  return bcrypt.compare(String(currentPin), user.parent_pin_hash);
};

const register = async (req, res) => {
  try {
    const name = sanitizeText(req.body.name, 120);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const requestedRole = normalizeRole(req.body.role);

    if (!name || !email || !password) {
      return error(res, 400, 'Name, email, and password are required');
    }

    if (!isValidEmail(email)) {
      return error(res, 400, 'A valid email address is required');
    }

    if (!isStrongPassword(password)) {
      return error(res, 400, 'Password must be at least 8 characters');
    }

    let role = 'parent';
    if (requestedRole !== 'parent') {
      const setupToken = req.headers['x-setup-token'];
      if (!process.env.ADMIN_SETUP_TOKEN || setupToken !== process.env.ADMIN_SETUP_TOKEN) {
        return error(res, 403, 'Admin/content manager registration requires a valid setup token');
      }
      role = requestedRole;
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return error(res, 409, 'This email address is already registered');
    }

    const password_hash = await bcrypt.hash(password, 12);
    const newUser = await User.create({ name, email, password_hash, role });
    await writeAuditLog({ actorId: newUser.id, action: 'USER_REGISTERED', entity: 'User', entityId: newUser.id, metadata: { role } });

    const safeUser = await loadCurrentUserForProfile(newUser.id);
    return success(res, 201, 'Account created successfully', { user: toPublicUser(safeUser) });
  } catch (err) {
    console.error('Register error:', err.message);
    return error(res, 500, 'Unable to create account');
  }
};

const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return error(res, 400, 'Email and password are required');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return error(res, 401, 'Invalid email or password');
    }

    if (user.is_active === false) {
      return error(res, 403, 'This account is inactive. Please contact support.');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return error(res, 401, 'Invalid email or password');
    }

    const token = createAuthToken(user);
    await writeAuditLog({ actorId: user.id, action: 'USER_LOGGED_IN', entity: 'User', entityId: user.id });

    const safeUser = await loadCurrentUserForProfile(user.id);
    return success(res, 200, 'Login successful', { token, user: toPublicUser(safeUser) });
  } catch (err) {
    console.error('Login error:', err.message);
    return error(res, 500, 'Unable to login');
  }
};

const me = async (req, res) => {
  const user = await loadCurrentUserForProfile(req.user.id);
  return success(res, 200, 'Authenticated user loaded', { user: toPublicUser(user) });
};

const updateMe = async (req, res) => {
  try {
    const allowedFields = ['name', 'email', 'phone', 'preferred_language', 'current_password'];
    const requestFields = Object.keys(req.body || {});
    const unknownFields = requestFields.filter((field) => !allowedFields.includes(field));
    if (unknownFields.length) return error(res, 400, `Unsupported fields: ${unknownFields.join(', ')}`);

    if (!requestFields.length || (requestFields.length === 1 && requestFields[0] === 'current_password')) {
      return error(res, 400, 'At least one editable field is required');
    }

    if (req.body.current_password !== undefined && req.body.email === undefined) {
      return error(res, 400, 'current_password is only allowed when changing email');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, 404, 'User was not found');

    const changes = {};

    if (req.body.name !== undefined) {
      const name = sanitizeText(req.body.name, 120);
      if (!name) return error(res, 400, 'Name cannot be empty');
      if (name !== user.name) changes.name = name;
    }

    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      if (!email || !isValidEmail(email)) return error(res, 400, 'A valid email address is required');

      if (email !== user.email) {
        const currentPassword = String(req.body.current_password || '');
        if (!currentPassword) return error(res, 400, 'current_password is required to update email');

        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) return error(res, 401, 'Current password is incorrect');

        const duplicate = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } });
        if (duplicate) return error(res, 409, 'This email address is already registered');
        changes.email = email;
      }
    }

    if (req.body.phone !== undefined) {
      const phone = normalizePhone(req.body.phone);
      if (!isValidPhone(phone)) return error(res, 400, 'Phone format is invalid');
      if (phone !== user.phone) changes.phone = phone;
    }

    if (req.body.preferred_language !== undefined) {
      const preferredLanguage = normalizeLanguage(req.body.preferred_language);
      if (!isSupportedLanguage(preferredLanguage)) return error(res, 400, 'preferred_language must be one of: en, ar');
      if (preferredLanguage !== user.preferred_language) changes.preferred_language = preferredLanguage;
    }

    const changedFields = Object.keys(changes);
    if (!changedFields.length) {
      const safeUser = await loadCurrentUserForProfile(user.id);
      return success(res, 200, 'No profile changes were applied', { user: toPublicUser(safeUser) });
    }

    await user.update(changes);
    await writeAuditLog({
      actorId: user.id,
      action: 'USER_PROFILE_UPDATED',
      entity: 'User',
      entityId: user.id,
      metadata: { fields: changedFields },
    });

    const safeUser = await loadCurrentUserForProfile(user.id);
    return success(res, 200, 'Account profile updated successfully', { user: toPublicUser(safeUser) });
  } catch (err) {
    console.error('Update profile error:', err.message);
    return error(res, 500, 'Unable to update account profile');
  }
};

const changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.current_password || '');
    const newPassword = String(req.body.new_password || '');
    const confirmPassword = String(req.body.confirm_password || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return error(res, 400, 'current_password, new_password, and confirm_password are required');
    }

    if (!isStrongPassword(newPassword)) {
      return error(res, 400, 'New password must be at least 8 characters');
    }

    if (newPassword !== confirmPassword) {
      return error(res, 400, 'New password and confirmation do not match');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, 404, 'User was not found');

    const validCurrent = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validCurrent) return error(res, 401, 'Current password is incorrect');

    const isReused = await bcrypt.compare(newPassword, user.password_hash);
    if (isReused) return error(res, 400, 'New password must be different from current password');

    const password_hash = await bcrypt.hash(newPassword, 12);
    await user.update({ password_hash, password_changed_at: new Date() });

    await writeAuditLog({ actorId: user.id, action: 'USER_PASSWORD_CHANGED', entity: 'User', entityId: user.id });
    return success(res, 200, 'Password changed successfully', { requires_relogin: true });
  } catch (err) {
    console.error('Change password error:', err.message);
    return error(res, 500, 'Unable to change password');
  }
};

const setParentPin = async (req, res) => {
  try {
    const currentPassword = String(req.body.current_password || '');
    const currentPin = String(req.body.current_pin || '');
    const newPin = String(req.body.new_pin || '');
    const confirmPin = String(req.body.confirm_pin || '');

    if (!newPin || !confirmPin) return error(res, 400, 'new_pin and confirm_pin are required');
    if (newPin !== confirmPin) return error(res, 400, 'new_pin and confirm_pin must match');
    if (!isValidPinFormat(newPin) || isTrivialPin(newPin)) {
      return error(res, 400, 'PIN must be numeric, 4-6 digits, and non-trivial');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, 404, 'User was not found');

    const hadPin = Boolean(user.parent_pin_hash);

    if (!hadPin) {
      const validPassword = await verifyPasswordCredential(user, currentPassword);
      if (!validPassword) return error(res, 401, 'Current password is required to set parent PIN');
    } else {
      const validPin = await verifyPinCredential(user, currentPin);
      const validPassword = await verifyPasswordCredential(user, currentPassword);
      if (!validPin && !validPassword) return error(res, 401, 'Current PIN or account password is required');

      const reusingPin = await bcrypt.compare(newPin, user.parent_pin_hash);
      if (reusingPin) return error(res, 400, 'New PIN must be different from current PIN');
    }

    const parent_pin_hash = await bcrypt.hash(newPin, 12);
    await user.update({ parent_pin_hash, parent_pin_updated_at: new Date() });

    await writeAuditLog({
      actorId: user.id,
      action: hadPin ? 'PARENT_PIN_CHANGED' : 'PARENT_PIN_SET',
      entity: 'User',
      entityId: user.id,
    });

    return success(res, 200, 'Parent PIN updated successfully', { has_parent_pin: true });
  } catch (err) {
    console.error('Set parent PIN error:', err.message);
    return error(res, 500, 'Unable to update parent PIN');
  }
};

const verifyParentPin = async (req, res) => {
  try {
    const pin = String(req.body.pin || '');
    if (!isValidPinFormat(pin)) return error(res, 400, 'PIN must be numeric and 4-6 digits');

    const user = await User.findByPk(req.user.id);
    if (!user || !user.parent_pin_hash) return error(res, 403, 'Unable to verify parent PIN');

    const validPin = await bcrypt.compare(pin, user.parent_pin_hash);
    if (!validPin) return error(res, 403, 'Unable to verify parent PIN');

    const unlockToken = createParentUnlockToken(user.id);
    await writeAuditLog({ actorId: user.id, action: 'PARENT_PIN_VERIFIED', entity: 'User', entityId: user.id });

    return success(res, 200, 'Parent PIN verified', { verified: true, unlock_token: unlockToken, expires_in_seconds: 300 });
  } catch (err) {
    console.error('Verify parent PIN error:', err.message);
    return error(res, 500, 'Unable to verify parent PIN');
  }
};

const removeParentPin = async (req, res) => {
  try {
    const currentPassword = String(req.body.current_password || '');
    const currentPin = String(req.body.current_pin || '');

    const user = await User.findByPk(req.user.id);
    if (!user) return error(res, 404, 'User was not found');

    if (!user.parent_pin_hash) {
      return res.status(409).json({
        success: false,
        message: 'No parent PIN is configured',
        data: { has_parent_pin: false },
        errors: [],
      });
    }

    if (!currentPin && !currentPassword) {
      return error(res, 400, 'current_pin or current_password is required');
    }

    const validPin = await verifyPinCredential(user, currentPin);
    const validPassword = await verifyPasswordCredential(user, currentPassword);
    if (!validPin && !validPassword) {
      return error(res, 401, 'Current PIN or account password is incorrect');
    }

    await user.update({ parent_pin_hash: null, parent_pin_updated_at: new Date() });
    await writeAuditLog({ actorId: user.id, action: 'PARENT_PIN_REMOVED', entity: 'User', entityId: user.id });

    return success(res, 200, 'Parent PIN removed successfully', { has_parent_pin: false });
  } catch (err) {
    console.error('Remove parent PIN error:', err.message);
    return error(res, 500, 'Unable to remove parent PIN');
  }
};

module.exports = {
  register,
  login,
  me,
  updateMe,
  changePassword,
  setParentPin,
  verifyParentPin,
  removeParentPin,
};

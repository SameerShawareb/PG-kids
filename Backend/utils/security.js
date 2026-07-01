const crypto = require('crypto');

const ALLOWED_ROLES = ['parent', 'admin', 'content_manager'];
const ADMIN_ROLES = ['admin'];
const CONTENT_MANAGER_ROLES = ['admin', 'content_manager'];
const SUPPORTED_LANGUAGES = ['en', 'ar'];

const normalizeRole = (role) => {
  const normalized = String(role || 'parent').trim().toLowerCase();
  return ALLOWED_ROLES.includes(normalized) ? normalized : 'parent';
};

const sanitizeText = (value, maxLength = 255) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
};

const sanitizeOptionalText = (value, maxLength = 2000) => {
  const sanitized = sanitizeText(value, maxLength);
  return sanitized.length ? sanitized : null;
};

const sanitizeSlug = (value) => {
  const base = sanitizeText(value, 120)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return base || `item-${crypto.randomUUID().slice(0, 8)}`;
};

const normalizeEmail = (value) => sanitizeText(value, 180).toLowerCase();

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || ''));

const normalizePhone = (value) => sanitizeOptionalText(value, 20);

const isValidPhone = (value) => {
  if (value === null || value === undefined || value === '') return true;
  const normalized = String(value).trim();
  return /^\+?[0-9\-\s()]{7,20}$/.test(normalized);
};

const normalizeLanguage = (value) => sanitizeOptionalText(value, 8)?.toLowerCase() || null;

const isSupportedLanguage = (value) => {
  if (value === null || value === undefined || value === '') return true;
  return SUPPORTED_LANGUAGES.includes(String(value).toLowerCase());
};

const isStrongPassword = (value) => String(value || '').length >= 8;

const isValidPinFormat = (value) => /^\d{4,6}$/.test(String(value || ''));

const isTrivialPin = (value) => {
  const pin = String(value || '');
  if (!pin) return true;
  if (/^(\d)\1+$/.test(pin)) return true;

  let isAscending = true;
  let isDescending = true;
  for (let i = 1; i < pin.length; i += 1) {
    const prev = Number(pin[i - 1]);
    const curr = Number(pin[i]);
    if (curr !== prev + 1) isAscending = false;
    if (curr !== prev - 1) isDescending = false;
  }
  return isAscending || isDescending;
};

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const toStrictBoolean = (value, fieldName) => {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
};

const toPositiveInteger = (value, fieldName, { required = false, min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${fieldName} is required`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldName} must be an integer between ${min} and ${max}`);
  }
  return parsed;
};

const toNonNegativeDecimal = (value, fieldName, { required = false, max = 999999.99 } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${fieldName} is required`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    throw new Error(`${fieldName} must be a valid non-negative number`);
  }
  return parsed.toFixed(2);
};

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
};

module.exports = {
  ALLOWED_ROLES,
  ADMIN_ROLES,
  CONTENT_MANAGER_ROLES,
  SUPPORTED_LANGUAGES,
  normalizeRole,
  sanitizeText,
  sanitizeOptionalText,
  sanitizeSlug,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  normalizeLanguage,
  isSupportedLanguage,
  isStrongPassword,
  isValidPinFormat,
  isTrivialPin,
  toBoolean,
  toStrictBoolean,
  toPositiveInteger,
  toNonNegativeDecimal,
  isUuid,
};

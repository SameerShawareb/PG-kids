const { User } = require('../models');
const { verify } = require('../utils/token');
const { error } = require('../utils/apiResponse');

const readBearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const loadUserFromToken = async (token) => {
  const payload = verify(token);
  if (!payload?.sub || payload.purpose !== 'auth') return null;
  const user = await User.findByPk(payload.sub, {
    attributes: [
      'id',
      'name',
      'email',
      'phone',
      'preferred_language',
      'role',
      'is_active',
      'password_changed_at',
      'parent_pin_hash',
      'createdAt',
      'updatedAt',
    ],
  });

  if (!user || user.is_active === false) return null;

  if (user.password_changed_at && payload.iat && Number(payload.iat) < new Date(user.password_changed_at).getTime()) {
    return null;
  }

  return { user, payload };
};

const authenticate = async (req, res, next) => {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return error(res, 401, 'Authentication token is required');
    }

    const authState = await loadUserFromToken(token);
    if (!authState) {
      return error(res, 401, 'Invalid or expired authentication token');
    }

    req.user = authState.user;
    req.auth = authState.payload;
    return next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    return error(res, 401, 'Authentication failed');
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = readBearerToken(req);
    if (!token) return next();
    const authState = await loadUserFromToken(token);
    if (authState) {
      req.user = authState.user;
      req.auth = authState.payload;
    }
    return next();
  } catch (err) {
    return next();
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return error(res, 401, 'Authentication is required');
  }

  if (!roles.includes(req.user.role)) {
    return error(res, 403, 'You do not have permission to perform this action');
  }

  return next();
};

module.exports = { authenticate, optionalAuthenticate, authorizeRoles, readBearerToken };

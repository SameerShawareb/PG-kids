const { error } = require('../utils/apiResponse');

const buckets = new Map();

const getClientKey = (req, scope) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || req.ip || 'unknown';
  return `${scope}:${ip}`;
};

const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 50, scope = 'global', message = 'Too many requests. Please try again later.' } = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req, scope);
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      res.setHeader('Retry-After', Math.ceil((existing.resetAt - now) / 1000));
      return error(res, 429, message);
    }

    return next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref?.();

module.exports = { rateLimit };

const crypto = require('crypto');

const base64url = (input) => Buffer.from(input).toString('base64url');

const getSecret = () => {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_TOKEN_SECRET is required in production');
  }
  return secret || 'pg-kids-local-development-secret-change-me';
};

const sign = (payload) => {
  const unsigned = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

const verify = (token) => {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [unsigned, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
    const signatureBuffer = Buffer.from(signature || '');
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length) return null;
    const valid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(unsigned, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const createAuthToken = (user) => {
  const ttlHours = Number(process.env.AUTH_TOKEN_TTL_HOURS || 12);
  const now = Date.now();
  return sign({
    sub: user.id,
    email: user.email,
    role: user.role,
    purpose: 'auth',
    iat: now,
    exp: now + ttlHours * 60 * 60 * 1000,
  });
};

const createParentUnlockToken = (userId) => {
  const ttlMinutes = Number(process.env.PARENT_UNLOCK_TOKEN_TTL_MINUTES || 5);
  const now = Date.now();
  return sign({
    sub: userId,
    purpose: 'parent_unlock',
    iat: now,
    exp: now + ttlMinutes * 60 * 1000,
  });
};

const verifyParentUnlockToken = (token, userId) => {
  const payload = verify(token);
  if (!payload) return null;
  if (payload.purpose !== 'parent_unlock') return null;
  if (String(payload.sub) !== String(userId)) return null;
  return payload;
};

module.exports = { createAuthToken, createParentUnlockToken, verifyParentUnlockToken, verify };

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth.middleware');
const { rateLimit } = require('../middleware/rate-limit.middleware');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, scope: 'auth', message: 'Too many authentication attempts. Please try again later.' });
const passwordChangeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, scope: 'change-password', message: 'Too many password change attempts. Please try again later.' });
const parentPinVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, scope: 'parent-pin-verify', message: 'Too many PIN verification attempts. Please try again later.' });

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, authController.updateMe);
router.patch('/change-password', authenticate, passwordChangeLimiter, authController.changePassword);
router.put('/parent-pin', authenticate, authController.setParentPin);
router.post('/parent-pin/verify', authenticate, parentPinVerifyLimiter, authController.verifyParentPin);
router.delete('/parent-pin', authenticate, authController.removeParentPin);

module.exports = router;

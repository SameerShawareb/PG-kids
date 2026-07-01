const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscriptions.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorizeRoles('parent', 'admin'));

router.get('/me', controller.getMySubscription);
router.post('/activate', controller.activateSubscription);
router.post('/cancel', controller.cancelMySubscription);

module.exports = router;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin-users.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorizeRoles('admin'));

router.get('/', controller.listUsers);
router.get('/:userId', controller.getUserDetails);
router.patch('/:userId/status', controller.updateUserStatus);

module.exports = router;

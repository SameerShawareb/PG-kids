const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscription-plans.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.get('/active', controller.listActivePlans);

router.get('/admin', authenticate, authorizeRoles('admin'), controller.listAdminPlans);
router.post('/admin', authenticate, authorizeRoles('admin'), controller.createPlan);
router.patch('/admin/:planId', authenticate, authorizeRoles('admin'), controller.updatePlan);
router.patch('/admin/:planId/status', authenticate, authorizeRoles('admin'), controller.setPlanStatus);
router.patch('/admin/:planId/restore', authenticate, authorizeRoles('admin'), controller.restorePlan);
router.delete('/admin/:planId', authenticate, authorizeRoles('admin'), controller.archivePlan);

module.exports = router;

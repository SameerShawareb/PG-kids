const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');
const {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfileSafety,
  updateProfileSafety,
} = require('../controllers/child-profiles.controller');

router.use(authenticate);
router.use(authorizeRoles('parent', 'admin'));

router.get('/', listProfiles);
router.post('/', createProfile);
router.put('/:profileId', updateProfile);
router.delete('/:profileId', deleteProfile);
router.get('/:profileId/safety', getProfileSafety);
router.patch('/:profileId/safety', updateProfileSafety);

module.exports = router;

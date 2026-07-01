const express = require('express');
const router = express.Router();
const controller = require('../controllers/content-management.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');
const { multipartUpload } = require('../middleware/multipart-upload.middleware');
const { rateLimit } = require('../middleware/rate-limit.middleware');

const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, scope: 'content-upload', message: 'Too many upload requests. Please try again later.' });

router.use(authenticate);
router.use(authorizeRoles('admin', 'content_manager'));

router.get('/', controller.listContent);
router.post('/', controller.createContentDirect);
router.post('/upload', uploadLimiter, multipartUpload(), controller.uploadContent);
router.patch('/:contentId', controller.updateContentMetadata);
router.put('/:contentId', controller.updateContentMetadata);
router.patch('/:contentId/archive', controller.archiveContent);
router.patch('/:contentId/restore', controller.restoreContent);
router.delete('/world/:worldId', controller.hardDeleteWorldContent);
router.delete('/:contentId', controller.hardDeleteContent);

module.exports = router;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/organization.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/categories', authorizeRoles('admin', 'content_manager'), controller.listCategories);
router.post('/categories', authorizeRoles('admin'), controller.createCategory);
router.patch('/categories/:categoryId', authorizeRoles('admin'), controller.updateCategory);
router.patch('/categories/:categoryId/status', authorizeRoles('admin'), controller.setCategoryStatus);

router.get('/series', authorizeRoles('admin', 'content_manager'), controller.listSeries);
router.post('/series', authorizeRoles('admin'), controller.createSeries);
router.patch('/series/:seriesId', authorizeRoles('admin'), controller.updateSeries);
router.patch('/series/:seriesId/status', authorizeRoles('admin'), controller.setSeriesStatus);

router.get('/seasons', authorizeRoles('admin', 'content_manager'), controller.listSeasons);
router.post('/seasons', authorizeRoles('admin'), controller.createSeason);
router.patch('/seasons/:seasonId', authorizeRoles('admin'), controller.updateSeason);
router.patch('/seasons/:seasonId/status', authorizeRoles('admin'), controller.setSeasonStatus);

router.get('/episodes', authorizeRoles('admin', 'content_manager'), controller.listEpisodes);
router.post('/episodes', authorizeRoles('admin'), controller.createEpisode);
router.patch('/episodes/:episodeId', authorizeRoles('admin'), controller.updateEpisode);
router.patch('/episodes/:episodeId/status', authorizeRoles('admin'), controller.setEpisodeStatus);

router.patch('/content/:contentId/assignment', authorizeRoles('admin'), controller.assignContent);

module.exports = router;

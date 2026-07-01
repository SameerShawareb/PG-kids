const express = require('express');
const router = express.Router();
const { optionalAuthenticate, authenticate } = require('../middleware/auth.middleware');
const {
  browseAndSearch,
  getPlayback,
  getThumbnail,
  logWatchEvent,
  getRecentWatchHistory,
  getWorldProgress,
} = require('../controllers/content-search.controller');

router.get('/browse', optionalAuthenticate, browseAndSearch);
router.get('/history/recent', authenticate, getRecentWatchHistory);
router.get('/history/world-progress', authenticate, getWorldProgress);
router.post('/:contentId/watch', authenticate, logWatchEvent);
router.get('/:contentId/thumbnail', getThumbnail);
router.get('/:contentId/playback', authenticate, getPlayback);

module.exports = router;

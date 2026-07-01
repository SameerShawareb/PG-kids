const fs = require('fs');
const path = require('path');
const { Op, fn, col } = require('sequelize');
const { Content, Category, Series, Season, Episode, WatchHistory } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { sanitizeText, isUuid } = require('../utils/security');
const { ageGroupAllows, assertChildProfileAccess, assertContentPlaybackAccess, resolveStoredMediaPath } = require('../utils/contentAccess');
const {
  normalizeWorldId,
  assertSupportedWorldId,
  extractWorldIdFromDescription,
  extractWorldSectionFromDescription,
  extractLocalizedTitlesFromDescription,
} = require('../utils/worldAssignment');

const includeOrganization = [
  { model: Category, as: 'categoryRef', attributes: ['id', 'name', 'slug', 'is_active'] },
  { model: Series, as: 'seriesRef', attributes: ['id', 'title', 'slug', 'is_active'] },
  { model: Season, as: 'seasonRef', attributes: ['id', 'title', 'season_number', 'is_active'] },
  { model: Episode, as: 'episode', attributes: ['id', 'title', 'episode_number', 'is_active'] },
];

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isExternalHttpUrl = (value = '') => /^https?:\/\//i.test(String(value).trim());

const serializeCatalogItem = (content) => {
  const localizedTitles = extractLocalizedTitlesFromDescription(content.description);

  return {
    id: content.id,
    title: content.title,
    title_ar: localizedTitles.title_ar,
    title_en: localizedTitles.title_en,
    description: content.description,
    world_id: extractWorldIdFromDescription(content.description),
    world_section: extractWorldSectionFromDescription(content.description),
    thumbnail_url: content.thumbnail_path ? `/api/content/${content.id}/thumbnail` : (content.thumbnail_url || null),
    type: content.type,
    duration_seconds: content.duration_seconds,
    age_group: content.age_group,
    category: content.category,
    access_level: content.access_level,
    quality_level: content.quality_level,
    playback_url: content.media_path && !isExternalHttpUrl(content.media_path) ? `/api/content/${content.id}/playback` : null,
    url: content.video_url || (isExternalHttpUrl(content.file_url) ? content.file_url : null),
    organization: {
      category: content.categoryRef || null,
      series: content.seriesRef || null,
      season: content.seasonRef || null,
      episode: content.episode || null,
    },
    published_at: content.published_at,
  };
};

const browseAndSearch = async (req, res) => {
  try {
    const keyword = sanitizeText(req.query.keyword, 120);
    const category = sanitizeText(req.query.category, 120);
    const categoryId = sanitizeText(req.query.categoryId, 80);
    const type = sanitizeText(req.query.type, 20).toLowerCase();
    const worldId = normalizeWorldId(req.query.world_id || req.query.worldId);
    const profileId = sanitizeText(req.query.profileId, 80);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const offset = (page - 1) * limit;

    const where = { is_published: true, is_archived: false };

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${keyword}%` } },
        { description: { [Op.iLike]: `%${keyword}%` } },
      ];
    }

    if (type) where.type = type;
    if (worldId) {
      assertSupportedWorldId(worldId);
      where.description = { [Op.iLike]: `%--world:${worldId}%` };
    }
    if (category) where.category = category;
    if (categoryId) {
      if (!isUuid(categoryId)) return error(res, 400, 'categoryId must be a valid UUID');
      where.categoryId = categoryId;
    }

    let childAge = null;
    if (profileId) {
      if (!req.user) return error(res, 401, 'Authentication is required when filtering by child profile');
      const parentUnlockToken = sanitizeText(req.headers['x-parent-unlock-token'], 600);
      const profileAccess = await assertChildProfileAccess({ user: req.user, profileId, content: null, requireProfile: false, parentUnlockToken });
      childAge = profileAccess.age;
    }

    const { count, rows } = await Content.findAndCountAll({
      where,
      include: includeOrganization,
      order: [['published_at', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const filtered = childAge === null
      ? rows
      : rows.filter((item) => ageGroupAllows(item.age_group, childAge));

    const serializedItems = filtered.map(serializeCatalogItem);

    const contentIds = serializedItems.map((item) => item.id).filter(Boolean);
    const watchTotalsByContentId = {};

    if (contentIds.length) {
      const watchTotalsRows = await WatchHistory.findAll({
        where: { contentId: { [Op.in]: contentIds } },
        attributes: ['contentId', [fn('SUM', col('watch_count')), 'total_watch_count']],
        group: ['contentId'],
        raw: true,
      });

      for (const row of watchTotalsRows) {
        watchTotalsByContentId[row.contentId] = Number(row.total_watch_count) || 0;
      }
    }

    const enrichedItems = serializedItems.map((item) => ({
      ...item,
      total_watch_count: watchTotalsByContentId[item.id] || 0,
    }));

    return success(
      res,
      200,
      filtered.length ? 'Content loaded successfully' : 'No content matched your search',
      enrichedItems,
      { page, limit, totalResults: count, returnedResults: filtered.length, safeCatalogOnly: true }
    );
  } catch (err) {
    console.error('Browse content error:', err.message);
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to browse content');
  }
};

const streamFileWithRange = async ({ req, res, absolutePath, mimeType, downloadName }) => {
  const stat = await fs.promises.stat(absolutePath);
  const range = req.headers.range;
  const headers = {
    'Content-Type': mimeType || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `inline; filename="${path.basename(downloadName || absolutePath).replace(/"/g, '')}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };

  if (!range) {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    return fs.createReadStream(absolutePath).pipe(res);
  }

  const [startRaw, endRaw] = String(range).replace(/bytes=/, '').split('-');
  const start = Number(startRaw);
  const end = endRaw ? Number(endRaw) : stat.size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= stat.size) {
    res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
    return res.end();
  }

  res.writeHead(206, {
    ...headers,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
  });
  return fs.createReadStream(absolutePath, { start, end }).pipe(res);
};

const logWatchEvent = async (req, res) => {
  try {
    const contentId = sanitizeText(req.params.contentId, 80);
    const profileId = sanitizeText(req.body.profileId || req.query.profileId, 80);

    if (!isUuid(contentId)) return error(res, 400, 'contentId must be a valid UUID');
    if (!isUuid(profileId)) return error(res, 400, 'profileId must be a valid UUID');

    const content = await Content.findByPk(contentId);
    if (!content || !content.is_published || content.is_archived) {
      return error(res, 404, 'Content was not found');
    }

    await assertChildProfileAccess({
      user: req.user,
      profileId,
      content,
      requireProfile: true,
      parentUnlockToken: sanitizeText(req.headers['x-parent-unlock-token'], 600),
    });

    const lastPositionSeconds = parseNumber(req.body.last_position_seconds);
    const completionPercentRaw = parseNumber(req.body.completion_percent);
    const normalizedCompletionPercent = completionPercentRaw === null
      ? null
      : Math.min(100, Math.max(0, completionPercentRaw));

    const existingRecord = await WatchHistory.findOne({ where: { profileId, contentId } });
    if (!existingRecord) {
      const created = await WatchHistory.create({
        profileId,
        contentId,
        last_watched_at: new Date(),
        watch_count: 1,
        last_position_seconds: lastPositionSeconds,
        completion_percent: normalizedCompletionPercent,
      });

      return success(res, 201, 'Watch event recorded successfully', {
        id: created.id,
        profileId: created.profileId,
        contentId: created.contentId,
        watch_count: created.watch_count,
        last_watched_at: created.last_watched_at,
      });
    }

    await existingRecord.update({
      last_watched_at: new Date(),
      watch_count: (existingRecord.watch_count || 0) + 1,
      last_position_seconds: lastPositionSeconds ?? existingRecord.last_position_seconds,
      completion_percent: normalizedCompletionPercent !== null
        ? Math.max(Number(existingRecord.completion_percent || 0), normalizedCompletionPercent)
        : existingRecord.completion_percent,
    });

    return success(res, 200, 'Watch event recorded successfully', {
      id: existingRecord.id,
      profileId: existingRecord.profileId,
      contentId: existingRecord.contentId,
      watch_count: existingRecord.watch_count,
      last_watched_at: existingRecord.last_watched_at,
    });
  } catch (err) {
    console.error('Log watch event error:', err.message);
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to record watch event');
  }
};

const getRecentWatchHistory = async (req, res) => {
  try {
    const profileId = sanitizeText(req.query.profileId, 80);
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);

    if (!isUuid(profileId)) return error(res, 400, 'profileId must be a valid UUID');

    await assertChildProfileAccess({
      user: req.user,
      profileId,
      content: null,
      requireProfile: true,
      parentUnlockToken: sanitizeText(req.headers['x-parent-unlock-token'], 600),
    });

    const historyRows = await WatchHistory.findAll({
      where: { profileId },
      include: [{
        model: Content,
        as: 'content',
        required: true,
        where: { is_published: true, is_archived: false },
      }],
      order: [['last_watched_at', 'DESC']],
      limit,
    });

    const items = historyRows.map((row) => ({
      ...serializeCatalogItem(row.content),
      watched_at: row.last_watched_at,
      watch_count: row.watch_count,
      last_position_seconds: row.last_position_seconds,
      completion_percent: row.completion_percent !== null ? Number(row.completion_percent) : null,
    }));

    return success(res, 200, items.length ? 'Recent watch history loaded successfully' : 'No watch history found', items, {
      profileId,
      limit,
      returnedResults: items.length,
    });
  } catch (err) {
    console.error('Get recent watch history error:', err.message);
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to load watch history');
  }
};

const getWorldProgress = async (req, res) => {
  try {
    const profileId = sanitizeText(req.query.profileId, 80);
    const worldId = normalizeWorldId(req.query.worldId || req.query.world_id);

    if (!isUuid(profileId)) return error(res, 400, 'profileId must be a valid UUID');
    if (worldId) assertSupportedWorldId(worldId);

    await assertChildProfileAccess({
      user: req.user,
      profileId,
      content: null,
      requireProfile: true,
      parentUnlockToken: sanitizeText(req.headers['x-parent-unlock-token'], 600),
    });

    const whereContent = { is_published: true, is_archived: false };
    if (worldId) whereContent.description = { [Op.iLike]: `%--world:${worldId}%` };

    const [allWorldContent, watchedRows] = await Promise.all([
      Content.findAll({
        where: whereContent,
        attributes: ['id', 'description'],
      }),
      WatchHistory.findAll({
        where: { profileId },
        include: [{
          model: Content,
          as: 'content',
          required: true,
          where: whereContent,
          attributes: ['id', 'description'],
        }],
      }),
    ]);

    const watchedMap = new Map();
    for (const row of watchedRows) {
      watchedMap.set(row.contentId, row);
    }

    const perWorld = {};
    for (const item of allWorldContent) {
      const itemWorldId = extractWorldIdFromDescription(item.description) || 'unassigned';
      if (!perWorld[itemWorldId]) {
        perWorld[itemWorldId] = { world_id: itemWorldId, total: 0, watched: 0 };
      }
      perWorld[itemWorldId].total += 1;
      if (watchedMap.has(item.id)) perWorld[itemWorldId].watched += 1;
    }

    const worlds = Object.values(perWorld)
      .map((entry) => ({
        ...entry,
        completion_percent: entry.total ? Math.round((entry.watched / entry.total) * 100) : 0,
      }))
      .sort((a, b) => String(a.world_id).localeCompare(String(b.world_id)));

    const totals = worlds.reduce((acc, entry) => {
      acc.total += entry.total;
      acc.watched += entry.watched;
      return acc;
    }, { total: 0, watched: 0 });

    return success(res, 200, 'World progress loaded successfully', {
      profileId,
      worldId: worldId || null,
      total_content: totals.total,
      watched_content: totals.watched,
      completion_percent: totals.total ? Math.round((totals.watched / totals.total) * 100) : 0,
      worlds,
    });
  } catch (err) {
    console.error('Get world progress error:', err.message);
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to load world progress');
  }
};

const getPlayback = async (req, res) => {
  try {
    const contentId = sanitizeText(req.params.contentId, 80);
    if (!isUuid(contentId)) return error(res, 400, 'contentId must be a valid UUID');

    const content = await Content.findByPk(contentId);
    await assertContentPlaybackAccess({
      user: req.user,
      content,
      profileId: sanitizeText(req.query.profileId, 80),
      parentUnlockToken: sanitizeText(req.headers['x-parent-unlock-token'], 600),
    });

    const directUrl = content.video_url || content.file_url;
    if (isExternalHttpUrl(directUrl) && (!content.media_path || isExternalHttpUrl(content.media_path))) {
      return res.redirect(directUrl);
    }

    const absolutePath = await resolveStoredMediaPath(content.media_path || content.file_url).catch(() => null);
    if (!absolutePath) return error(res, 404, 'Media file was not found');

    return streamFileWithRange({
      req,
      res,
      absolutePath,
      mimeType: content.mime_type,
      downloadName: content.original_filename,
    });
  } catch (err) {
    console.error('Playback error:', err.message);
    return error(res, err.statusCode || 500, err.statusCode ? err.message : 'Unable to access content playback');
  }
};

const getThumbnail = async (req, res) => {
  try {
    const contentId = sanitizeText(req.params.contentId, 80);
    if (!isUuid(contentId)) return error(res, 400, 'contentId must be a valid UUID');

    const content = await Content.findByPk(contentId);
    if (!content || !content.is_published || content.is_archived || !content.thumbnail_path) {
      return error(res, 404, 'Thumbnail was not found');
    }

    const absolutePath = await resolveStoredMediaPath(content.thumbnail_path);
    return res.sendFile(absolutePath, {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Thumbnail error:', err.message);
    return error(res, 404, 'Thumbnail was not found');
  }
};

module.exports = {
  browseAndSearch,
  getPlayback,
  getThumbnail,
  logWatchEvent,
  getRecentWatchHistory,
  getWorldProgress,
};

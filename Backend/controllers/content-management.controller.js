const fs = require('fs/promises');
const { Op } = require('sequelize');
const { sequelize, Content, Category, Series, Season, Episode } = require('../models');
const { success, error } = require('../utils/apiResponse');
const {
  sanitizeText,
  sanitizeOptionalText,
  toBoolean,
  toPositiveInteger,
  isUuid,
} = require('../utils/security');
const {
  validateUploadFile,
  validateThumbnailFile,
  storeBuffer,
  safeOriginalName,
} = require('../utils/mediaStorage');
const { writeAuditLog } = require('../utils/audit');
const { resolveStoredMediaPath } = require('../utils/contentAccess');
const {
  normalizeWorldId,
  normalizeWorldSection,
  assertSupportedWorldId,
  extractWorldIdFromDescription,
  extractWorldSectionFromDescription,
  extractLocalizedTitlesFromDescription,
  applyWorldAssignment,
  applyWorldSection,
  applyLocalizedTitles,
} = require('../utils/worldAssignment');

const CONTENT_TYPES = ['video', 'audio', 'world'];
const AGE_GROUPS = ['2-5', '3-5', '6-8', '9-12', 'all'];
const ARCHIVE_STATUS_VALUES = ['active', 'archived', 'all'];

const isExternalHttpUrl = (value = '') => /^https?:\/\//i.test(String(value).trim());

const includeOrganization = [
  { model: Category, as: 'categoryRef', attributes: ['id', 'name', 'slug', 'is_active'] },
  { model: Series, as: 'seriesRef', attributes: ['id', 'title', 'slug', 'is_active'] },
  { model: Season, as: 'seasonRef', attributes: ['id', 'title', 'season_number', 'is_active'] },
  { model: Episode, as: 'episode', attributes: ['id', 'title', 'episode_number', 'is_active'] },
];

const serializeContent = (content) => {
  const localizedTitles = extractLocalizedTitlesFromDescription(content.description);

  return {
    id: content.id,
    title: content.title,
    title_ar: localizedTitles.title_ar,
    title_en: localizedTitles.title_en,
    description: content.description,
    world_id: extractWorldIdFromDescription(content.description),
    world_section: extractWorldSectionFromDescription(content.description),
    playback_url: content.media_path ? `/api/content/${content.id}/playback` : null,
    url: content.video_url || null,
    thumbnail_url: content.thumbnail_path ? `/api/content/${content.id}/thumbnail` : (content.thumbnail_url || null),
    type: content.type,
    duration_seconds: content.duration_seconds,
    age_group: content.age_group,
    category: content.category,
    series_name: content.series_name,
    season_number: content.season_number,
    episode_number: content.episode_number,
    access_level: content.access_level,
    quality_level: content.quality_level,
    is_published: content.is_published,
    is_archived: content.is_archived,
    published_at: content.published_at,
    organization: {
      category: content.categoryRef || null,
      series: content.seriesRef || null,
      season: content.seasonRef || null,
      episode: content.episode || null,
    },
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  };
};

const validateOrganization = async ({ categoryId, seriesId, seasonId, transaction }) => {
  let category = null;
  let series = null;
  let season = null;

  if (categoryId) {
    if (!isUuid(categoryId)) throw new Error('categoryId must be a valid UUID');
    category = await Category.findByPk(categoryId, { transaction });
    if (!category || !category.is_active) throw new Error('Selected category does not exist or is inactive');
  }

  if (seriesId) {
    if (!isUuid(seriesId)) throw new Error('seriesId must be a valid UUID');
    series = await Series.findByPk(seriesId, { transaction });
    if (!series || !series.is_active) throw new Error('Selected series does not exist or is inactive');
    if (categoryId && series.categoryId !== categoryId) {
      throw new Error('Selected series does not belong to the selected category');
    }
    if (!category) category = await Category.findByPk(series.categoryId, { transaction });
  }

  if (seasonId) {
    if (!isUuid(seasonId)) throw new Error('seasonId must be a valid UUID');
    season = await Season.findByPk(seasonId, { transaction });
    if (!season || !season.is_active) throw new Error('Selected season does not exist or is inactive');
    if (!seriesId) throw new Error('seriesId is required when seasonId is provided');
    if (season.seriesId !== seriesId) {
      throw new Error('Selected season does not belong to the selected series');
    }
  }

  return { category, series, season };
};

const buildContentPayload = (body) => {
  const title = sanitizeText(body.title, 180);
  const type = sanitizeText(body.type, 20).toLowerCase();
  const age_group = sanitizeText(body.age_group || body.ageGroup || 'all', 20);

  if (!title) throw new Error('Title is required');
  if (!CONTENT_TYPES.includes(type)) throw new Error(`Content type must be one of: ${CONTENT_TYPES.join(', ')}`);
  if (!AGE_GROUPS.includes(age_group)) throw new Error(`Age group must be one of: ${AGE_GROUPS.join(', ')}`);

  return {
    title,
    title_ar: sanitizeOptionalText(body.title_ar || body.titleAr, 180),
    title_en: sanitizeOptionalText(body.title_en || body.titleEn, 180),
    type,
    age_group,
    description: sanitizeOptionalText(body.description, 4000),
    duration_seconds: toPositiveInteger(body.duration_seconds || body.duration, 'duration_seconds', { min: 1, max: 24 * 60 * 60 }),
    access_level: sanitizeOptionalText(body.access_level, 80),
    quality_level: sanitizeOptionalText(body.quality_level, 80),
    is_published: toBoolean(body.is_published, true),
    release_date: body.release_date ? new Date(body.release_date) : null,
  };
};

const uploadContent = async (req, res) => {
  const transaction = await sequelize.transaction();
  const storedFiles = [];
  try {
    const payload = buildContentPayload(req.body);
    const worldId = normalizeWorldId(req.body.world_id || req.body.worldId);
    const worldSection = normalizeWorldSection(req.body.world_section || req.body.worldSection || req.body.content_section || req.body.contentSection || 'shorts');
    payload.description = applyLocalizedTitles(
      applyWorldSection(applyWorldAssignment(payload.description, worldId), worldSection),
      { title_ar: payload.title_ar, title_en: payload.title_en }
    );

    const mediaValidation = validateUploadFile(req.file, payload.type);
    const thumbnailValidation = validateThumbnailFile(req.thumbnailFile);

    const categoryId = sanitizeText(req.body.categoryId, 80) || null;
    const seriesId = sanitizeText(req.body.seriesId, 80) || null;
    const seasonId = sanitizeText(req.body.seasonId, 80) || null;
    const episodeNumber = toPositiveInteger(req.body.episode_number || req.body.episodeNumber, 'episode_number', { min: 1, max: 10000 });

    const { category, series, season } = await validateOrganization({ categoryId, seriesId, seasonId, transaction });
    if (!category && !sanitizeText(req.body.category, 120)) {
      throw new Error('A category or categoryId is required');
    }

    const media = await storeBuffer({ file: req.file, subdirectory: `media/${payload.type}`, extension: mediaValidation.extension });
    storedFiles.push(media.absolutePath);
    let thumbnail = null;
    if (req.thumbnailFile) {
      thumbnail = await storeBuffer({ file: req.thumbnailFile, subdirectory: 'thumbnails', extension: thumbnailValidation.extension });
      storedFiles.push(thumbnail.absolutePath);
    }

    const { title_ar, title_en, ...persistablePayload } = payload;

    const content = await Content.create({
      ...persistablePayload,
      file_url: media.relativePath,
      media_path: media.relativePath,
      thumbnail_url: thumbnail?.publicUrl || null,
      thumbnail_path: thumbnail?.relativePath || null,
      original_filename: safeOriginalName(req.file.originalname),
      mime_type: mediaValidation.mime,
      file_size: req.file.size,
      video_url: null,
      category: category?.name || sanitizeText(req.body.category, 120),
      categoryId: category?.id || null,
      seriesId: series?.id || null,
      seasonId: season?.id || null,
      series_name: series?.title || sanitizeOptionalText(req.body.series_name, 180),
      season_number: season?.season_number || null,
      episode_number: episodeNumber,
      published_at: payload.is_published ? new Date() : null,
    }, { transaction });

    if (season && episodeNumber) {
      await Episode.create({
        title: content.title,
        episode_number: episodeNumber,
        description: content.description,
        seasonId: season.id,
        contentId: content.id,
      }, { transaction });
    }

    await writeAuditLog({
      actorId: req.user.id,
      action: 'CONTENT_UPLOADED',
      entity: 'Content',
      entityId: content.id,
      metadata: { type: content.type, fileSize: content.file_size, categoryId: content.categoryId },
      transaction,
    });

    await transaction.commit();

    const created = await Content.findByPk(content.id, { include: includeOrganization });
    return success(res, 201, 'Content uploaded successfully', serializeContent(created));
  } catch (err) {
    await transaction.rollback();
    await Promise.allSettled(storedFiles.map((filePath) => fs.unlink(filePath)));
    if (err.message) return error(res, 400, err.message);
    console.error('Upload content error:', err);
    return error(res, 500, 'Unable to upload content');
  }
};

const resolveArchiveScope = (archiveStatusRaw = 'active') => {
  const archiveStatus = sanitizeText(archiveStatusRaw || 'active', 20).toLowerCase() || 'active';
  if (!ARCHIVE_STATUS_VALUES.includes(archiveStatus)) {
    throw new Error(`archive_status must be one of: ${ARCHIVE_STATUS_VALUES.join(', ')}`);
  }

  if (archiveStatus === 'archived') return { archiveStatus, is_archived: true };
  if (archiveStatus === 'all') return { archiveStatus, is_archived: null };
  return { archiveStatus: 'active', is_archived: false };
};

const listContent = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const offset = (page - 1) * limit;

    const { archiveStatus, is_archived } = resolveArchiveScope(req.query.archive_status);

    const where = {};
    if (is_archived !== null) where.is_archived = is_archived;

    const keyword = sanitizeText(req.query.keyword || req.query.search, 120);
    const type = sanitizeText(req.query.type, 20).toLowerCase();
    const categoryId = sanitizeText(req.query.categoryId, 80);
    const seriesId = sanitizeText(req.query.seriesId, 80);
    const accessLevel = sanitizeText(req.query.access_level, 80);

    if (keyword) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${keyword}%` } },
        { description: { [Op.iLike]: `%${keyword}%` } },
      ];
    }

    if (type) where.type = type;

    if (categoryId) {
      if (!isUuid(categoryId)) return error(res, 400, 'categoryId must be a valid UUID');
      where.categoryId = categoryId;
    }

    if (seriesId) {
      if (!isUuid(seriesId)) return error(res, 400, 'seriesId must be a valid UUID');
      where.seriesId = seriesId;
    }

    if (accessLevel) where.access_level = accessLevel;

    if (req.query.is_published !== undefined) {
      where.is_published = toBoolean(req.query.is_published, false);
    }

    const { count, rows } = await Content.findAndCountAll({
      where,
      include: includeOrganization,
      order: [['createdAt', 'DESC'], ['id', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return success(res, 200, 'Content loaded successfully', rows.map(serializeContent), {
      page,
      limit,
      totalResults: count,
      totalPages: Math.ceil(count / limit),
      archive_status: archiveStatus,
    });
  } catch (err) {
    if (err.message?.includes('archive_status')) return error(res, 400, err.message);
    console.error('List content error:', err.message);
    return error(res, 500, 'Unable to load content');
  }
};

const updateContentMetadata = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const content = await Content.findByPk(req.params.contentId, { transaction });
    if (!content) {
      await transaction.rollback();
      return error(res, 404, 'Content was not found');
    }

    const payload = {};
    if (req.body.title !== undefined) {
      payload.title = sanitizeText(req.body.title, 180);
      if (!payload.title) throw new Error('Title cannot be empty');
    }
    if (req.body.description !== undefined) payload.description = sanitizeOptionalText(req.body.description, 4000);
    const titleArProvided = req.body.title_ar !== undefined || req.body.titleAr !== undefined;
    const titleEnProvided = req.body.title_en !== undefined || req.body.titleEn !== undefined;
    const worldIdProvided = req.body.world_id !== undefined || req.body.worldId !== undefined;
    const worldSectionProvided = req.body.world_section !== undefined || req.body.worldSection !== undefined || req.body.content_section !== undefined || req.body.contentSection !== undefined;
    if (req.body.age_group !== undefined) payload.age_group = sanitizeText(req.body.age_group, 20);
    if (req.body.duration_seconds !== undefined) payload.duration_seconds = toPositiveInteger(req.body.duration_seconds, 'duration_seconds', { min: 1, max: 24 * 60 * 60 });
    if (req.body.access_level !== undefined) payload.access_level = sanitizeOptionalText(req.body.access_level, 80);
    if (req.body.quality_level !== undefined) payload.quality_level = sanitizeOptionalText(req.body.quality_level, 80);
    if (req.body.is_published !== undefined) {
      payload.is_published = toBoolean(req.body.is_published, content.is_published);
      payload.published_at = payload.is_published ? (content.published_at || new Date()) : null;
    }

    if (req.body.description !== undefined || worldIdProvided || worldSectionProvided || titleArProvided || titleEnProvided) {
      const existingLocalizedTitles = extractLocalizedTitlesFromDescription(content.description);
      const explicitWorldId = normalizeWorldId(req.body.world_id || req.body.worldId);
      const explicitWorldSection = normalizeWorldSection(req.body.world_section || req.body.worldSection || req.body.content_section || req.body.contentSection);
      const worldIdToApply = worldIdProvided ? explicitWorldId : extractWorldIdFromDescription(content.description);
      const worldSectionToApply = worldSectionProvided ? explicitWorldSection : extractWorldSectionFromDescription(content.description);
      const titleArToApply = titleArProvided
        ? sanitizeOptionalText(req.body.title_ar || req.body.titleAr, 180)
        : existingLocalizedTitles.title_ar;
      const titleEnToApply = titleEnProvided
        ? sanitizeOptionalText(req.body.title_en || req.body.titleEn, 180)
        : existingLocalizedTitles.title_en;
      const baseDescription = req.body.description !== undefined ? payload.description : content.description;
      payload.description = applyLocalizedTitles(
        applyWorldSection(applyWorldAssignment(baseDescription, worldIdToApply), worldSectionToApply),
        { title_ar: titleArToApply, title_en: titleEnToApply }
      );
    }

    await content.update(payload, { transaction });
    await writeAuditLog({
      actorId: req.user.id,
      action: 'CONTENT_METADATA_UPDATED',
      entity: 'Content',
      entityId: content.id,
      metadata: { fields: Object.keys(payload) },
      transaction,
    });

    await transaction.commit();
    const updated = await Content.findByPk(content.id, { include: includeOrganization });
    return success(res, 200, 'Content metadata updated successfully', serializeContent(updated));
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to update content metadata');
  }
};


const archiveContent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const content = await Content.findByPk(req.params.contentId, { transaction });
    if (!content) {
      await transaction.rollback();
      return error(res, 404, 'Content was not found');
    }

    await Episode.update({ is_active: false }, { where: { contentId: content.id }, transaction });
    await content.update({ is_archived: true, is_published: false, archived_at: new Date(), published_at: null }, { transaction });

    await writeAuditLog({
      actorId: req.user.id,
      action: 'CONTENT_ARCHIVED',
      entity: 'Content',
      entityId: content.id,
      transaction,
    });

    await transaction.commit();
    return success(res, 200, 'Content archived successfully', serializeContent(content));
  } catch (err) {
    await transaction.rollback();
    console.error('Archive content error:', err.message);
    return error(res, 500, 'Unable to archive content');
  }
};

const restoreContent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const content = await Content.findByPk(req.params.contentId, { transaction });
    if (!content) {
      await transaction.rollback();
      return error(res, 404, 'Content was not found');
    }

    if (!content.is_archived) {
      await transaction.commit();
      const current = await Content.findByPk(content.id, { include: includeOrganization });
      return success(res, 200, 'Content is already active', serializeContent(current));
    }

    await content.update({ is_archived: false, archived_at: null }, { transaction });
    await Episode.update({ is_active: true }, { where: { contentId: content.id }, transaction });

    await writeAuditLog({
      actorId: req.user.id,
      action: 'CONTENT_RESTORED',
      entity: 'Content',
      entityId: content.id,
      transaction,
    });

    await transaction.commit();
    const restored = await Content.findByPk(content.id, { include: includeOrganization });
    return success(res, 200, 'Content restored successfully', serializeContent(restored));
  } catch (err) {
    await transaction.rollback();
    console.error('Restore content error:', err.message);
    return error(res, 500, 'Unable to restore content');
  }
};

const hardDeleteContent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const contentId = sanitizeText(req.params.contentId, 80);
    if (!isUuid(contentId)) {
      await transaction.rollback();
      return error(res, 400, 'contentId must be a valid UUID');
    }

    const content = await Content.findByPk(contentId, { transaction });
    if (!content) {
      await transaction.rollback();
      return error(res, 404, 'Content was not found');
    }

    await Episode.destroy({ where: { contentId: content.id }, transaction });

    await writeAuditLog({
      actorId: req.user.id,
      action: 'CONTENT_HARD_DELETED',
      entity: 'Content',
      entityId: content.id,
      metadata: { type: content.type, hadMedia: Boolean(content.media_path) },
      transaction,
    });

    await content.destroy({ transaction });
    await transaction.commit();

    const cleanupPaths = [content.media_path, content.thumbnail_path].filter(Boolean);
    await Promise.allSettled(
      cleanupPaths.map(async (storedPath) => {
        try {
          const absolutePath = await resolveStoredMediaPath(storedPath);
          await fs.unlink(absolutePath);
        } catch (cleanupErr) {
          console.warn(`Unable to remove stored file for content ${content.id}:`, cleanupErr.message);
        }
      })
    );

    return success(res, 200, 'Content deleted permanently', { id: content.id });
  } catch (err) {
    await transaction.rollback();
    console.error('Hard delete content error:', err.message);
    return error(res, 500, 'Unable to delete content');
  }
};

const hardDeleteWorldContent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const worldId = normalizeWorldId(req.params.worldId);
    assertSupportedWorldId(worldId);

    const worldRows = await Content.findAll({
      where: {
        description: { [Op.iLike]: `%--world:${worldId}%` },
      },
      transaction,
    });

    if (!worldRows.length) {
      await transaction.rollback();
      return success(res, 200, 'No content found for this world', { world_id: worldId, deleted_count: 0 });
    }

    const cleanupPaths = [];

    for (const row of worldRows) {
      await Episode.destroy({ where: { contentId: row.id }, transaction });

      await writeAuditLog({
        actorId: req.user.id,
        action: 'WORLD_CONTENT_HARD_DELETED',
        entity: 'Content',
        entityId: row.id,
        metadata: { world_id: worldId, type: row.type },
        transaction,
      });

      cleanupPaths.push(...[row.media_path, row.thumbnail_path].filter(Boolean));
      await row.destroy({ transaction });
    }

    await transaction.commit();

    await Promise.allSettled(
      cleanupPaths.map(async (storedPath) => {
        try {
          const absolutePath = await resolveStoredMediaPath(storedPath);
          await fs.unlink(absolutePath);
        } catch (cleanupErr) {
          console.warn(`Unable to remove stored file for world ${worldId}:`, cleanupErr.message);
        }
      })
    );

    return success(res, 200, 'World content deleted permanently', {
      world_id: worldId,
      deleted_count: worldRows.length,
    });
  } catch (err) {
    await transaction.rollback();
    if (err.message?.includes('world_id')) return error(res, 400, err.message);
    console.error('Hard delete world content error:', err.message);
    return error(res, 500, 'Unable to delete world content');
  }
};

const createContentDirect = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const title = sanitizeText(req.body.title, 180);
    const type = sanitizeText(req.body.type, 20).toLowerCase();
    const age_group = sanitizeText(req.body.age_group || req.body.ageGroup || 'all', 20);
    const worldId = normalizeWorldId(req.body.world_id || req.body.worldId);
    const worldSection = normalizeWorldSection(req.body.world_section || req.body.worldSection || req.body.content_section || req.body.contentSection || 'shorts');
    const title_ar = sanitizeOptionalText(req.body.title_ar || req.body.titleAr, 180);
    const title_en = sanitizeOptionalText(req.body.title_en || req.body.titleEn, 180);
    const description = applyLocalizedTitles(
      applyWorldSection(applyWorldAssignment(sanitizeOptionalText(req.body.description, 4000), worldId), worldSection),
      { title_ar, title_en }
    );
    const thumbnail_url = sanitizeOptionalText(req.body.thumbnail_url, 2000);
    const providedVideoUrl = sanitizeOptionalText(req.body.video_url || req.body.url, 2000);
    const providedFileUrl = sanitizeOptionalText(req.body.file_url, 2000);
    const effectiveFileUrl = providedFileUrl || providedVideoUrl || '#';
    const isExternalMedia = isExternalHttpUrl(providedVideoUrl || effectiveFileUrl);

    if (!title) return error(res, 400, 'Title is required');
    if (!type) return error(res, 400, 'Type is required');
    if (!CONTENT_TYPES.includes(type)) return error(res, 400, `Content type must be one of: ${CONTENT_TYPES.join(', ')}`);

    const content = await Content.create({
      title,
      type,
      age_group,
      description,
      thumbnail_url,
      file_url: effectiveFileUrl,
      media_path: isExternalMedia ? null : effectiveFileUrl,
      video_url: isExternalMedia ? (providedVideoUrl || effectiveFileUrl) : null,
      is_published: true,
      published_at: new Date(),
    }, { transaction });

    await writeAuditLog({
      actorId: req.user.id,
      action: 'CONTENT_CREATED_DIRECT',
      entity: 'Content',
      entityId: content.id,
      metadata: { type: content.type },
      transaction,
    });

    await transaction.commit();
    return success(res, 201, 'Content created successfully', serializeContent(content));
  } catch (err) {
    await transaction.rollback();
    console.error('Create content direct error:', err);
    return error(res, 500, 'Unable to create content');
  }
};

module.exports = {
  uploadContent,
  listContent,
  updateContentMetadata,
  archiveContent,
  restoreContent,
  hardDeleteContent,
  hardDeleteWorldContent,
  createContentDirect,
  includeOrganization,
  serializeContent,
  validateOrganization,
};

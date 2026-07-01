const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { sequelize, Category, Series, Season, Episode, Content } = require('../models');
const { success, error } = require('../utils/apiResponse');
const {
  sanitizeText,
  sanitizeOptionalText,
  sanitizeSlug,
  toBoolean,
  toPositiveInteger,
  isUuid,
} = require('../utils/security');
const { writeAuditLog } = require('../utils/audit');
const { validateOrganization } = require('./content-management.controller');

const listCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    return success(res, 200, 'Categories loaded successfully', categories);
  } catch (err) {
    console.error('List categories error:', err.message);
    return error(res, 500, 'Unable to load categories');
  }
};

const createCategory = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const name = sanitizeText(req.body.name, 120);
    if (!name) throw new Error('Category name is required');

    const existing = await Category.findOne({
      where: sequelizeWhere(fn('LOWER', col('name')), name.toLowerCase()),
      transaction,
    });
    if (existing) {
      await transaction.rollback();
      return error(res, 409, 'A category with this name already exists');
    }

    const category = await Category.create({
      name,
      slug: sanitizeSlug(req.body.slug || name),
      description: sanitizeOptionalText(req.body.description, 2000),
      is_active: toBoolean(req.body.is_active, true),
    }, { transaction });

    await writeAuditLog({ actorId: req.user.id, action: 'CATEGORY_CREATED', entity: 'Category', entityId: category.id, transaction });
    await transaction.commit();
    return success(res, 201, 'Category created successfully', category);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to create category');
  }
};

const updateCategory = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const category = await Category.findByPk(req.params.categoryId, { transaction });
    if (!category) {
      await transaction.rollback();
      return error(res, 404, 'Category was not found');
    }

    const payload = {};
    if (req.body.name !== undefined) {
      payload.name = sanitizeText(req.body.name, 120);
      if (!payload.name) throw new Error('Category name cannot be empty');
      const existing = await Category.findOne({
        where: {
          id: { [Op.ne]: category.id },
          [Op.and]: sequelizeWhere(fn('LOWER', col('name')), payload.name.toLowerCase()),
        },
        transaction,
      });
      if (existing) throw new Error('A category with this name already exists');
    }
    if (req.body.slug !== undefined) payload.slug = sanitizeSlug(req.body.slug);
    if (req.body.description !== undefined) payload.description = sanitizeOptionalText(req.body.description, 2000);

    await category.update(payload, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: 'CATEGORY_UPDATED', entity: 'Category', entityId: category.id, metadata: { fields: Object.keys(payload) }, transaction });
    await transaction.commit();
    return success(res, 200, 'Category updated successfully', category);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to update category');
  }
};

const setCategoryStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const category = await Category.findByPk(req.params.categoryId, { transaction });
    if (!category) {
      await transaction.rollback();
      return error(res, 404, 'Category was not found');
    }

    const is_active = toBoolean(req.body.is_active, category.is_active);
    if (!is_active) {
      const activeContent = await Content.count({ where: { categoryId: category.id, is_published: true }, transaction });
      const activeSeries = await Series.count({ where: { categoryId: category.id, is_active: true }, transaction });
      if (activeContent > 0 || activeSeries > 0) {
        await transaction.rollback();
        return error(res, 409, 'Cannot deactivate category while active/published content or active series still depend on it', { activeContent, activeSeries });
      }
    }

    await category.update({ is_active }, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: is_active ? 'CATEGORY_ACTIVATED' : 'CATEGORY_DEACTIVATED', entity: 'Category', entityId: category.id, transaction });
    await transaction.commit();
    return success(res, 200, is_active ? 'Category activated successfully' : 'Category deactivated successfully', category);
  } catch (err) {
    await transaction.rollback();
    return error(res, 500, 'Unable to update category status');
  }
};

const listSeries = async (req, res) => {
  try {
    const series = await Series.findAll({ include: [{ model: Category, as: 'category' }], order: [['createdAt', 'DESC']] });
    return success(res, 200, 'Series loaded successfully', series);
  } catch (err) {
    console.error('List series error:', err.message);
    return error(res, 500, 'Unable to load series');
  }
};

const createSeries = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const title = sanitizeText(req.body.title, 180);
    const categoryId = sanitizeText(req.body.categoryId, 80);
    if (!title) throw new Error('Series title is required');
    if (!isUuid(categoryId)) throw new Error('A valid categoryId is required');

    const category = await Category.findByPk(categoryId, { transaction });
    if (!category || !category.is_active) throw new Error('Selected category does not exist or is inactive');

    const series = await Series.create({
      title,
      slug: sanitizeSlug(req.body.slug || title),
      description: sanitizeOptionalText(req.body.description, 2000),
      is_active: toBoolean(req.body.is_active, true),
      categoryId,
    }, { transaction });

    await writeAuditLog({ actorId: req.user.id, action: 'SERIES_CREATED', entity: 'Series', entityId: series.id, metadata: { categoryId }, transaction });
    await transaction.commit();
    return success(res, 201, 'Series created successfully', series);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to create series');
  }
};

const updateSeries = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const series = await Series.findByPk(req.params.seriesId, { transaction });
    if (!series) {
      await transaction.rollback();
      return error(res, 404, 'Series was not found');
    }

    const payload = {};
    if (req.body.title !== undefined) {
      payload.title = sanitizeText(req.body.title, 180);
      if (!payload.title) throw new Error('Series title cannot be empty');
    }
    if (req.body.slug !== undefined) payload.slug = sanitizeSlug(req.body.slug);
    if (req.body.description !== undefined) payload.description = sanitizeOptionalText(req.body.description, 2000);
    if (req.body.categoryId !== undefined) {
      const categoryId = sanitizeText(req.body.categoryId, 80);
      if (!isUuid(categoryId)) throw new Error('A valid categoryId is required');
      const category = await Category.findByPk(categoryId, { transaction });
      if (!category || !category.is_active) throw new Error('Selected category does not exist or is inactive');
      payload.categoryId = categoryId;
    }

    await series.update(payload, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: 'SERIES_UPDATED', entity: 'Series', entityId: series.id, metadata: { fields: Object.keys(payload) }, transaction });
    await transaction.commit();
    return success(res, 200, 'Series updated successfully', series);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to update series');
  }
};

const setSeriesStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const series = await Series.findByPk(req.params.seriesId, { transaction });
    if (!series) {
      await transaction.rollback();
      return error(res, 404, 'Series was not found');
    }

    const is_active = toBoolean(req.body.is_active, series.is_active);
    if (!is_active) {
      const activeContent = await Content.count({ where: { seriesId: series.id, is_published: true }, transaction });
      const activeSeasons = await Season.count({ where: { seriesId: series.id, is_active: true }, transaction });
      if (activeContent > 0 || activeSeasons > 0) {
        await transaction.rollback();
        return error(res, 409, 'Cannot deactivate series while active seasons or published content still depend on it', { activeContent, activeSeasons });
      }
    }

    await series.update({ is_active }, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: is_active ? 'SERIES_ACTIVATED' : 'SERIES_DEACTIVATED', entity: 'Series', entityId: series.id, transaction });
    await transaction.commit();
    return success(res, 200, is_active ? 'Series activated successfully' : 'Series deactivated successfully', series);
  } catch (err) {
    await transaction.rollback();
    return error(res, 500, 'Unable to update series status');
  }
};

const listSeasons = async (req, res) => {
  try {
    const seasons = await Season.findAll({ include: [{ model: Series, as: 'series' }], order: [['createdAt', 'DESC']] });
    return success(res, 200, 'Seasons loaded successfully', seasons);
  } catch (err) {
    console.error('List seasons error:', err.message);
    return error(res, 500, 'Unable to load seasons');
  }
};

const createSeason = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const title = sanitizeText(req.body.title, 180) || `Season ${req.body.season_number}`;
    const seriesId = sanitizeText(req.body.seriesId, 80);
    const season_number = toPositiveInteger(req.body.season_number, 'season_number', { required: true, min: 1, max: 1000 });

    if (!isUuid(seriesId)) throw new Error('A valid seriesId is required');
    const series = await Series.findByPk(seriesId, { transaction });
    if (!series || !series.is_active) throw new Error('Selected series does not exist or is inactive');

    const season = await Season.create({ title, season_number, seriesId, is_active: toBoolean(req.body.is_active, true) }, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: 'SEASON_CREATED', entity: 'Season', entityId: season.id, metadata: { seriesId }, transaction });
    await transaction.commit();
    return success(res, 201, 'Season created successfully', season);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to create season');
  }
};

const updateSeason = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const season = await Season.findByPk(req.params.seasonId, { transaction });
    if (!season) {
      await transaction.rollback();
      return error(res, 404, 'Season was not found');
    }

    const payload = {};
    if (req.body.title !== undefined) payload.title = sanitizeText(req.body.title, 180);
    if (req.body.season_number !== undefined) payload.season_number = toPositiveInteger(req.body.season_number, 'season_number', { min: 1, max: 1000 });
    if (req.body.seriesId !== undefined) {
      const seriesId = sanitizeText(req.body.seriesId, 80);
      if (!isUuid(seriesId)) throw new Error('A valid seriesId is required');
      const series = await Series.findByPk(seriesId, { transaction });
      if (!series || !series.is_active) throw new Error('Selected series does not exist or is inactive');
      payload.seriesId = seriesId;
    }

    await season.update(payload, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: 'SEASON_UPDATED', entity: 'Season', entityId: season.id, metadata: { fields: Object.keys(payload) }, transaction });
    await transaction.commit();
    return success(res, 200, 'Season updated successfully', season);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to update season');
  }
};

const setSeasonStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const season = await Season.findByPk(req.params.seasonId, { transaction });
    if (!season) {
      await transaction.rollback();
      return error(res, 404, 'Season was not found');
    }

    const is_active = toBoolean(req.body.is_active, season.is_active);
    if (!is_active) {
      const activeContent = await Content.count({ where: { seasonId: season.id, is_published: true }, transaction });
      const activeEpisodes = await Episode.count({ where: { seasonId: season.id, is_active: true }, transaction });
      if (activeContent > 0 || activeEpisodes > 0) {
        await transaction.rollback();
        return error(res, 409, 'Cannot deactivate season while active episodes or published content still depend on it', { activeContent, activeEpisodes });
      }
    }

    await season.update({ is_active }, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: is_active ? 'SEASON_ACTIVATED' : 'SEASON_DEACTIVATED', entity: 'Season', entityId: season.id, transaction });
    await transaction.commit();
    return success(res, 200, is_active ? 'Season activated successfully' : 'Season deactivated successfully', season);
  } catch (err) {
    await transaction.rollback();
    return error(res, 500, 'Unable to update season status');
  }
};

const listEpisodes = async (req, res) => {
  try {
    const episodes = await Episode.findAll({
      include: [
        { model: Season, as: 'season' },
        { model: Content, as: 'content' },
      ],
      order: [['createdAt', 'DESC']],
    });
    return success(res, 200, 'Episodes loaded successfully', episodes);
  } catch (err) {
    console.error('List episodes error:', err.message);
    return error(res, 500, 'Unable to load episodes');
  }
};

const createEpisode = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const title = sanitizeText(req.body.title, 180);
    const seasonId = sanitizeText(req.body.seasonId, 80);
    const contentId = sanitizeText(req.body.contentId, 80);
    const episode_number = toPositiveInteger(req.body.episode_number, 'episode_number', { required: true, min: 1, max: 10000 });

    if (!title) throw new Error('Episode title is required');
    if (!isUuid(seasonId)) throw new Error('A valid seasonId is required');
    const season = await Season.findByPk(seasonId, { include: [{ model: Series, as: 'series', include: [{ model: Category, as: 'category' }] }], transaction });
    if (!season || !season.is_active) throw new Error('Selected season does not exist or is inactive');

    let content = null;
    if (contentId) {
      if (!isUuid(contentId)) throw new Error('contentId must be a valid UUID');
      content = await Content.findByPk(contentId, { transaction });
      if (!content) throw new Error('Selected content was not found');
      await content.update({
        categoryId: season.series?.categoryId || content.categoryId,
        category: season.series?.category?.name || content.category,
        seasonId: season.id,
        seriesId: season.seriesId,
        series_name: season.series?.title || content.series_name,
        season_number: season.season_number,
        episode_number,
      }, { transaction });
    }

    const episode = await Episode.create({
      title,
      episode_number,
      description: sanitizeOptionalText(req.body.description, 2000),
      seasonId,
      contentId: content?.id || null,
      is_active: toBoolean(req.body.is_active, true),
    }, { transaction });

    await writeAuditLog({ actorId: req.user.id, action: 'EPISODE_CREATED', entity: 'Episode', entityId: episode.id, metadata: { seasonId, contentId: content?.id || null }, transaction });
    await transaction.commit();
    return success(res, 201, 'Episode created successfully', episode);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to create episode');
  }
};


const updateEpisode = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const episode = await Episode.findByPk(req.params.episodeId, { transaction });
    if (!episode) {
      await transaction.rollback();
      return error(res, 404, 'Episode was not found');
    }

    const payload = {};
    if (req.body.title !== undefined) {
      payload.title = sanitizeText(req.body.title, 180);
      if (!payload.title) throw new Error('Episode title cannot be empty');
    }
    if (req.body.description !== undefined) payload.description = sanitizeOptionalText(req.body.description, 2000);
    if (req.body.episode_number !== undefined) payload.episode_number = toPositiveInteger(req.body.episode_number, 'episode_number', { min: 1, max: 10000 });
    if (req.body.seasonId !== undefined) {
      const seasonId = sanitizeText(req.body.seasonId, 80);
      if (!isUuid(seasonId)) throw new Error('A valid seasonId is required');
      const season = await Season.findByPk(seasonId, { transaction });
      if (!season || !season.is_active) throw new Error('Selected season does not exist or is inactive');
      payload.seasonId = seasonId;
    }
    if (req.body.is_active !== undefined) payload.is_active = toBoolean(req.body.is_active, episode.is_active);

    await episode.update(payload, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: 'EPISODE_UPDATED', entity: 'Episode', entityId: episode.id, metadata: { fields: Object.keys(payload) }, transaction });
    await transaction.commit();
    return success(res, 200, 'Episode updated successfully', episode);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to update episode');
  }
};

const setEpisodeStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const episode = await Episode.findByPk(req.params.episodeId, { transaction });
    if (!episode) {
      await transaction.rollback();
      return error(res, 404, 'Episode was not found');
    }

    const is_active = toBoolean(req.body.is_active, episode.is_active);
    await episode.update({ is_active }, { transaction });
    await writeAuditLog({ actorId: req.user.id, action: is_active ? 'EPISODE_ACTIVATED' : 'EPISODE_DEACTIVATED', entity: 'Episode', entityId: episode.id, transaction });
    await transaction.commit();
    return success(res, 200, is_active ? 'Episode activated successfully' : 'Episode deactivated successfully', episode);
  } catch (err) {
    await transaction.rollback();
    return error(res, 500, 'Unable to update episode status');
  }
};

const assignContent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const content = await Content.findByPk(req.params.contentId, { transaction });
    if (!content) {
      await transaction.rollback();
      return error(res, 404, 'Content was not found');
    }

    const categoryId = sanitizeText(req.body.categoryId, 80) || null;
    const seriesId = sanitizeText(req.body.seriesId, 80) || null;
    const seasonId = sanitizeText(req.body.seasonId, 80) || null;
    const episodeNumber = toPositiveInteger(req.body.episode_number || req.body.episodeNumber, 'episode_number', { min: 1, max: 10000 });

    const { category, series, season } = await validateOrganization({ categoryId, seriesId, seasonId, transaction });

    await content.update({
      categoryId: category?.id || null,
      category: category?.name || null,
      seriesId: series?.id || null,
      series_name: series?.title || null,
      seasonId: season?.id || null,
      season_number: season?.season_number || null,
      episode_number: season && episodeNumber ? episodeNumber : null,
    }, { transaction });

    if (season && episodeNumber) {
      const [episode] = await Episode.findOrCreate({
        where: { contentId: content.id },
        defaults: {
          title: content.title,
          episode_number: episodeNumber,
          description: content.description,
          seasonId: season.id,
          contentId: content.id,
        },
        transaction,
      });
      await episode.update({ episode_number: episodeNumber, seasonId: season.id, title: content.title, is_active: true }, { transaction });
    } else {
      await Episode.destroy({ where: { contentId: content.id }, transaction });
    }

    await writeAuditLog({ actorId: req.user.id, action: 'CONTENT_ORGANIZATION_UPDATED', entity: 'Content', entityId: content.id, metadata: { categoryId, seriesId, seasonId, episodeNumber }, transaction });
    await transaction.commit();
    return success(res, 200, 'Content organization updated successfully', content);
  } catch (err) {
    await transaction.rollback();
    return error(res, 400, err.message || 'Unable to update content organization');
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  setCategoryStatus,
  listSeries,
  createSeries,
  updateSeries,
  setSeriesStatus,
  listSeasons,
  createSeason,
  updateSeason,
  setSeasonStatus,
  listEpisodes,
  createEpisode,
  updateEpisode,
  setEpisodeStatus,
  assignContent,
};

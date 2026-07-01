const sequelize = require('../config/database');

const User = require('./User');
const ChildProfile = require('./ChildProfile');
const SubscriptionPlan = require('./SubscriptionPlan');
const UserSubscription = require('./UserSubscription');
const Content = require('./Content');
const Category = require('./Category');
const Series = require('./Series');
const Season = require('./Season');
const Episode = require('./Episode');
const AuditLog = require('./AuditLog');
const WatchHistory = require('./WatchHistory');

User.hasMany(ChildProfile, { foreignKey: 'userId', as: 'children', onDelete: 'CASCADE' });
ChildProfile.belongsTo(User, { foreignKey: 'userId', as: 'parent' });

User.hasMany(UserSubscription, { foreignKey: 'userId', as: 'subscriptions' });
UserSubscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

SubscriptionPlan.hasMany(UserSubscription, { foreignKey: 'planId', as: 'subscriptions' });
UserSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'planId', as: 'plan' });

Category.hasMany(Series, { foreignKey: 'categoryId', as: 'series' });
Series.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Series.hasMany(Season, { foreignKey: 'seriesId', as: 'seasons' });
Season.belongsTo(Series, { foreignKey: 'seriesId', as: 'series' });

Season.hasMany(Episode, { foreignKey: 'seasonId', as: 'episodes' });
Episode.belongsTo(Season, { foreignKey: 'seasonId', as: 'season' });

Category.hasMany(Content, { foreignKey: 'categoryId', as: 'contents' });
Content.belongsTo(Category, { foreignKey: 'categoryId', as: 'categoryRef' });

Series.hasMany(Content, { foreignKey: 'seriesId', as: 'contents' });
Content.belongsTo(Series, { foreignKey: 'seriesId', as: 'seriesRef' });

Season.hasMany(Content, { foreignKey: 'seasonId', as: 'contents' });
Content.belongsTo(Season, { foreignKey: 'seasonId', as: 'seasonRef' });

Content.hasOne(Episode, { foreignKey: 'contentId', as: 'episode' });
Episode.belongsTo(Content, { foreignKey: 'contentId', as: 'content' });

ChildProfile.hasMany(WatchHistory, { foreignKey: 'profileId', as: 'watchHistory', onDelete: 'CASCADE' });
WatchHistory.belongsTo(ChildProfile, { foreignKey: 'profileId', as: 'profile' });

Content.hasMany(WatchHistory, { foreignKey: 'contentId', as: 'watchHistory', onDelete: 'CASCADE' });
WatchHistory.belongsTo(Content, { foreignKey: 'contentId', as: 'content' });

User.hasMany(AuditLog, { foreignKey: 'actorId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

module.exports = {
  sequelize,
  User,
  ChildProfile,
  SubscriptionPlan,
  UserSubscription,
  Content,
  Category,
  Series,
  Season,
  Episode,
  AuditLog,
  WatchHistory,
};

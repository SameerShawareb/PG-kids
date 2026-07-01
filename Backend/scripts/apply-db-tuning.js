require('dotenv').config();

const { sequelize } = require('../models');

const statements = [
  'CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)',
  'CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id ON child_profiles ("userId")',
  'CREATE INDEX IF NOT EXISTS idx_subscription_plans_active_archived ON subscription_plans (is_active, is_archived)',
  'CREATE INDEX IF NOT EXISTS idx_subscription_plans_access_level ON subscription_plans (access_level)',
  'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions ("userId", status)',
  'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions ("planId")',
  'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON user_subscriptions (end_date)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON categories (slug)',
  'CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (is_active)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_series_slug_unique ON series (slug)',
  'CREATE INDEX IF NOT EXISTS idx_series_category_id ON series ("categoryId")',
  'CREATE INDEX IF NOT EXISTS idx_series_active ON series (is_active)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_series_number_unique ON seasons ("seriesId", season_number)',
  'CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON seasons ("seriesId")',
  'CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons (is_active)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_season_number_unique ON episodes ("seasonId", episode_number)',
  'CREATE INDEX IF NOT EXISTS idx_episodes_content_id ON episodes ("contentId")',
  'CREATE INDEX IF NOT EXISTS idx_episodes_active ON episodes (is_active)',
  'CREATE INDEX IF NOT EXISTS idx_contents_published_archived ON contents (is_published, is_archived)',
  'CREATE INDEX IF NOT EXISTS idx_contents_category_id ON contents ("categoryId")',
  'CREATE INDEX IF NOT EXISTS idx_contents_series_id ON contents ("seriesId")',
  'CREATE INDEX IF NOT EXISTS idx_contents_season_id ON contents ("seasonId")',
  'CREATE INDEX IF NOT EXISTS idx_contents_type ON contents (type)',
  'CREATE INDEX IF NOT EXISTS idx_contents_age_group ON contents (age_group)',
  'CREATE INDEX IF NOT EXISTS idx_contents_access_level ON contents (access_level)',
  'CREATE INDEX IF NOT EXISTS idx_contents_published_at ON contents (published_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs ("actorId")',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs ("createdAt")',
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, "entityId")',
];

const main = async () => {
  await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });
  for (const statement of statements) {
    await sequelize.query(statement);
  }
  console.log(`✅ Database tuning applied successfully (${statements.length} indexes/constraints checked).`);
};

main()
  .catch((err) => {
    console.error('❌ Failed to apply database tuning:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

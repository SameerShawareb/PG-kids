require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const {
  sequelize,
  User,
  ChildProfile,
  SubscriptionPlan,
  UserSubscription,
  Category,
  Series,
  Season,
  Episode,
  Content,
  AuditLog,
} = require('../models');
const { UPLOAD_ROOT, PROJECT_ROOT } = require('../utils/mediaStorage');

const now = () => new Date();

const relativeFromProject = (absolutePath) => path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');

const createSilentWavBuffer = ({ seconds = 1, sampleRate = 8000 } = {}) => {
  const samples = Math.max(1, Math.floor(seconds * sampleRate));
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
};

const ensureDemoFiles = async () => {
  const mediaDir = path.join(UPLOAD_ROOT, 'media', 'audio');
  const thumbnailDir = path.join(UPLOAD_ROOT, 'thumbnails');
  await fs.mkdir(mediaDir, { recursive: true });
  await fs.mkdir(thumbnailDir, { recursive: true });

  const audioPath = path.join(mediaDir, 'demo-story-silence.wav');
  const thumbnailPath = path.join(thumbnailDir, 'demo-thumbnail.png');

  await fs.writeFile(audioPath, createSilentWavBuffer({ seconds: 1 }), { flag: 'w' });
  await fs.writeFile(
    thumbnailPath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    ),
    { flag: 'w' }
  );

  return {
    audioPath,
    thumbnailPath,
    audioRelative: relativeFromProject(audioPath),
    thumbnailRelative: relativeFromProject(thumbnailPath),
  };
};

const upsertUser = async ({ name, email, password, role, parent_pin }) => {
  const password_hash = await bcrypt.hash(password, 12);
  const parent_pin_hash = parent_pin ? await bcrypt.hash(parent_pin, 12) : null;
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: { name, email, password_hash, role, parent_pin_hash },
  });

  if (!created) {
    await user.update({ name, password_hash, role, parent_pin_hash });
  }

  return user;
};

const main = async () => {
  await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });

  const admin = await upsertUser({
    name: 'PG Kids Admin',
    email: 'admin@pgkids.com',
    password: 'pgkids000',
    role: 'admin',
  });

  const contentManager = await upsertUser({
    name: 'PG Kids Content Manager',
    email: 'content@pgkids.com',
    password: 'content000',
    role: 'content_manager',
  });

  const parent = await upsertUser({
    name: 'Demo Parent',
    email: 'parent@pgkids.com',
    password: 'parent000',
    role: 'parent',
    parent_pin: '1234',
  });

  const [basicPlan] = await SubscriptionPlan.findOrCreate({
    where: { name: 'Basic Kids' },
    defaults: {
      name: 'Basic Kids',
      description: 'Demo basic monthly plan for prototype testing.',
      price: 3.99,
      billing_cycle: 'monthly',
      duration_days: 30,
      stream_limit: 1,
      quality_limit: 'standard',
      access_level: 'basic',
      is_active: true,
    },
  });

  const [premiumPlan] = await SubscriptionPlan.findOrCreate({
    where: { name: 'Premium Kids' },
    defaults: {
      name: 'Premium Kids',
      description: 'Demo premium monthly plan for prototype testing.',
      price: 5.99,
      billing_cycle: 'monthly',
      duration_days: 30,
      stream_limit: 4,
      quality_limit: 'premium',
      access_level: 'premium',
      is_active: true,
    },
  });

  const [category] = await Category.findOrCreate({
    where: { slug: 'arabic-stories' },
    defaults: {
      name: 'Arabic Stories',
      slug: 'arabic-stories',
      description: 'Demo Arabic-first stories category.',
      is_active: true,
    },
  });

  const [series] = await Series.findOrCreate({
    where: { slug: 'demo-adventures' },
    defaults: {
      title: 'Demo Adventures',
      slug: 'demo-adventures',
      description: 'Prototype demo series for PG Kids.',
      categoryId: category.id,
      is_active: true,
    },
  });

  const [season] = await Season.findOrCreate({
    where: { seriesId: series.id, season_number: 1 },
    defaults: {
      title: 'Season 1',
      season_number: 1,
      seriesId: series.id,
      is_active: true,
    },
  });

  const [child] = await ChildProfile.findOrCreate({
    where: { userId: parent.id, name: 'Omar Demo' },
    defaults: {
      userId: parent.id,
      name: 'Omar Demo',
      date_of_birth: '2018-05-10',
      avatar: 'default.png',
    },
  });

  const subscriptionStart = now();
  const subscriptionEnd = new Date(subscriptionStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  await UserSubscription.update({ status: 'cancelled' }, { where: { userId: parent.id, status: 'active' } });
  const subscription = await UserSubscription.create({
    userId: parent.id,
    planId: premiumPlan.id,
    start_date: subscriptionStart,
    end_date: subscriptionEnd,
    status: 'active',
  });

  const files = await ensureDemoFiles();
  const [content, createdContent] = await Content.findOrCreate({
    where: { title: 'Demo Arabic Audio Story' },
    defaults: {
      title: 'Demo Arabic Audio Story',
      description: 'Seeded demo audio story used to test parent browsing, subscription access, and protected playback.',
      file_url: files.audioRelative,
      media_path: files.audioRelative,
      thumbnail_url: `/api/content/thumbnail-pending`,
      thumbnail_path: files.thumbnailRelative,
      original_filename: 'demo-story-silence.wav',
      mime_type: 'audio/wav',
      file_size: (await fs.stat(files.audioPath)).size,
      type: 'audio',
      duration_seconds: 1,
      age_group: '6-8',
      category: category.name,
      categoryId: category.id,
      seriesId: series.id,
      seasonId: season.id,
      series_name: series.title,
      season_number: season.season_number,
      episode_number: 1,
      access_level: 'basic',
      quality_level: 'standard',
      is_published: true,
      published_at: now(),
    },
  });

  if (!createdContent) {
    await content.update({
      description: 'Seeded demo audio story used to test parent browsing, subscription access, and protected playback.',
      file_url: files.audioRelative,
      media_path: files.audioRelative,
      thumbnail_path: files.thumbnailRelative,
      original_filename: 'demo-story-silence.wav',
      mime_type: 'audio/wav',
      file_size: (await fs.stat(files.audioPath)).size,
      type: 'audio',
      duration_seconds: 1,
      age_group: '6-8',
      category: category.name,
      categoryId: category.id,
      seriesId: series.id,
      seasonId: season.id,
      series_name: series.title,
      season_number: season.season_number,
      episode_number: 1,
      access_level: 'basic',
      quality_level: 'standard',
      is_published: true,
      published_at: content.published_at || now(),
      is_archived: false,
    });
  }

  await Episode.findOrCreate({
    where: { seasonId: season.id, episode_number: 1 },
    defaults: {
      title: content.title,
      episode_number: 1,
      description: content.description,
      seasonId: season.id,
      contentId: content.id,
      is_active: true,
    },
  });

  await AuditLog.create({
    actorId: admin.id,
    action: 'DEMO_DATA_SEEDED',
    entity: 'System',
    entityId: null,
    metadata: {
      adminEmail: admin.email,
      contentManagerEmail: contentManager.email,
      parentEmail: parent.email,
      childProfileId: child.id,
      subscriptionId: subscription.id,
      contentId: content.id,
      plans: [basicPlan.name, premiumPlan.name],
    },
  });

  console.log('\n✅ PG Kids demo data seeded successfully.');
  console.log('Admin login:          admin@pgkids.com / pgkids000');
  console.log('Content manager:      content@pgkids.com / content000');
  console.log('Parent login:         parent@pgkids.com / parent000');
  console.log(`Demo child profile:   ${child.name}`);
  console.log(`Demo content:         ${content.title}`);
  console.log('\nOpen: http://localhost:3000/admin/admin.html');
  console.log('Open: http://localhost:3000/parent/parent.html\n');
};

main()
  .catch((err) => {
    console.error('❌ Failed to seed demo data:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

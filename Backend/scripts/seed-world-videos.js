require('dotenv').config();

const { sequelize, Content } = require('../models');
const { applyWorldAssignment, applyWorldSection } = require('../utils/worldAssignment');

const WORLDS = [
  { id: '1', name: 'بدر' },
  { id: '2', name: 'لولوة' },
  { id: '3', name: 'طنطل' },
  { id: '4', name: 'سلطان' },
  { id: '5', name: 'بدور' },
  { id: '6', name: 'نايا' },
  { id: '7', name: 'لبيب' },
];

const SAMPLE_VIDEOS = [
  {
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-1/1280/720',
    duration: 10,
  },
  {
    url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-2/1280/720',
    duration: 30,
  },
  {
    url: 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-3/1280/720',
    duration: 13,
  },
  {
    url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-4/1280/720',
    duration: 5,
  },
  {
    url: 'https://download.samplelib.com/mp4/sample-10s.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-5/1280/720',
    duration: 10,
  },
  {
    url: 'https://samplelib.com/lib/preview/mp4/sample-15s.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-6/1280/720',
    duration: 15,
  },
  {
    url: 'https://samplelib.com/lib/preview/mp4/sample-20s.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-7/1280/720',
    duration: 20,
  },
  {
    url: 'https://download.samplelib.com/mp4/sample-20s.mp4',
    thumbnail: 'https://picsum.photos/seed/world-video-8/1280/720',
    duration: 20,
  },
];

const AGE_GROUPS = ['2-5', '3-5', '6-8', '9-12', 'all'];
const ACCESS_LEVELS = ['free', 'basic'];
const SECTIONS = ['shorts', 'series'];

const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const shuffle = (arr) => {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const buildDescription = ({ worldId, worldName, section, index }) => {
  const base = `فيديو مغامرة عشوائي ${index + 1} في عالم ${worldName}`;
  return applyWorldSection(applyWorldAssignment(base, worldId), section);
};

const main = async () => {
  const videosPerWorld = Math.max(1, Number(process.env.SEED_VIDEOS_PER_WORLD || 3));
  const createdIds = [];

  await sequelize.authenticate();

  for (const world of WORLDS) {
    const selectedVideos = shuffle(SAMPLE_VIDEOS).slice(0, Math.min(videosPerWorld, SAMPLE_VIDEOS.length));

    for (let i = 0; i < selectedVideos.length; i += 1) {
      const sample = selectedVideos[i];
      const section = randomPick(SECTIONS);
      const title = `🎬 ${world.name} | فيديو عشوائي ${i + 1}`;
      const description = buildDescription({
        worldId: world.id,
        worldName: world.name,
        section,
        index: i,
      });

      const [content, created] = await Content.findOrCreate({
        where: { title },
        defaults: {
          title,
          description,
          file_url: sample.url,
          media_path: null,
          video_url: sample.url,
          thumbnail_url: sample.thumbnail,
          thumbnail_path: null,
          original_filename: `${world.id}-random-${i + 1}.mp4`,
          mime_type: 'video/mp4',
          file_size: null,
          type: 'video',
          duration_seconds: sample.duration,
          age_group: randomPick(AGE_GROUPS),
          category: 'Random World Videos',
          access_level: randomPick(ACCESS_LEVELS),
          quality_level: 'standard',
          is_published: true,
          is_archived: false,
          published_at: new Date(),
        },
      });

      if (!created) {
        await content.update({
          description,
          file_url: sample.url,
          media_path: null,
          video_url: sample.url,
          thumbnail_url: sample.thumbnail,
          mime_type: 'video/mp4',
          duration_seconds: sample.duration,
          age_group: randomPick(AGE_GROUPS),
          access_level: randomPick(ACCESS_LEVELS),
          quality_level: 'standard',
          is_published: true,
          is_archived: false,
          published_at: content.published_at || new Date(),
        });
      }

      createdIds.push(content.id);
      console.log(`${created ? 'Created' : 'Updated'}: ${title} (world ${world.id}, section ${section})`);
    }
  }

  console.log(`\n✅ Done. Seeded/updated ${createdIds.length} world videos.`);
};

main()
  .catch((err) => {
    console.error('❌ Failed to seed world videos:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

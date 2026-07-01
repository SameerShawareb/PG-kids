require('dotenv').config();

const { sequelize, Content } = require('../models');

const VIDEO_SOURCES = [
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

const shuffle = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const isRandomWorldVideo = (content) => String(content.title || '').startsWith('🎬 ');

const main = async () => {
  await sequelize.authenticate();

  const allRows = await Content.findAll({
    order: [['createdAt', 'DESC']],
  });

  const rows = allRows.filter(isRandomWorldVideo);
  if (!rows.length) {
    console.log('No random world videos found to update.');
    return;
  }

  const sourcePool = shuffle(VIDEO_SOURCES);

  let updatedCount = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const source = sourcePool[i % sourcePool.length];

    await row.update({
      file_url: source.url,
      video_url: source.url,
      media_path: null,
      thumbnail_url: source.thumbnail,
      thumbnail_path: null,
      mime_type: 'video/mp4',
      duration_seconds: source.duration,
      is_published: true,
      is_archived: false,
      published_at: row.published_at || new Date(),
    });

    updatedCount += 1;
    console.log(`Updated: ${row.title} -> ${source.url}`);
  }

  console.log(`\n✅ Updated ${updatedCount} random world videos with new external URLs.`);
};

main()
  .catch((err) => {
    console.error('❌ Failed to replace random world video URLs:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

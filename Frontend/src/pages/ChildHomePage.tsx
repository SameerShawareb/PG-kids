import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChild } from '../context/ChildContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Star, X, Crown, Flame, Sparkles, ChevronRight, WandSparkles, Rocket, TimerReset, History, Compass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import VideoPlayerModal from '../components/VideoPlayerModal';
import InteractiveTimeline, { type InteractiveTimelineCharacter } from '../components/InteractiveTimeline';
import { resolveContentTitle } from '../utils/contentTitles';

const ALL_WORLDS = [
  { id: '1', name: 'Bader', avatar: '/characters/Bader.png', color: '#3B82F6' },
  { id: '2', name: 'Lulwa', avatar: '/characters/Lulwa.png', color: '#EC4899' },
  { id: '3', name: 'Tantal', avatar: '/characters/Tantal.png', color: '#10B981' },
  { id: '4', name: 'Sultan', avatar: '/characters/The Shark Sultan.png', color: '#F59E0B' },
  { id: '5', name: 'Budour', avatar: '/characters/Budour.png', color: '#8B5CF6' },
  { id: '6', name: 'Naya', avatar: '/characters/Naya.png', color: '#06B6D4' },
  { id: '7', name: 'Labib', avatar: '/characters/Labib.png', color: '#F43F5E' },
];

const WORLD_BACKGROUND_BY_ID: Record<string, string> = {
  '1': '/BackGrounds/BaderBg.png',
  '2': '/BackGrounds/ShamsBg.png',
  '3': '/BackGrounds/ShahedBg.png',
  '4': '/BackGrounds/SultanBg.png',
  '5': '/BackGrounds/BudourBg.png',
  '6': '/BackGrounds/NayaBg.png',
  '7': '/BackGrounds/LabibBg.png',
};

interface HomeContent {
  id?: string;
  _id?: string;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  type: string;
  world_id?: string;
  worldId?: string;
  playback_url?: string | null;
  url?: string | null;
  description?: string;
  thumbnail_url?: string;
  thumbnail?: string;
  published_at?: string;
  watched_at?: string;
  createdAt?: string;
}

interface RecentHomeContent extends HomeContent {
  playedAt: number;
  recentKey: string;
}

interface DailyMission {
  id: string;
  title: string;
  description: string;
  video: HomeContent | null;
  worldId: string | null;
  titleKey?: string;
  templateKey?: string;
  worldCharName?: string;
  nextWorldCharName?: string;
}

const isWorldAssigned = (content: HomeContent) => {
  if (content.world_id || content.worldId) return true;
  return Boolean(content.description?.includes('--world:'));
};

const toTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeContentType = (type?: string) => {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized.startsWith('short')) return 'short';
  if (normalized.startsWith('series')) return 'series';
  if (normalized.startsWith('video')) return 'video';
  return normalized;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const toRgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(51, 65, 85, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const getContrastTextColor = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF';
};

const RECENT_VIDEO_LIMIT = 12;

const extractPlayableUrl = (video?: HomeContent | null) => {
  if (!video) return null;

  const playbackUrl = typeof video.playback_url === 'string' ? video.playback_url.trim() : '';
  const directUrl = typeof video.url === 'string' ? video.url.trim() : '';
  return playbackUrl || directUrl || null;
};

const buildVideoKey = (video: HomeContent) => (
  video.id || video._id || `${video.title || video.title_en || video.title_ar || 'untitled'}-${extractPlayableUrl(video) || 'no-url'}`
);

const extractWorldIdFromContent = (content?: HomeContent | null) => {
  if (!content) return null;
  if (content.world_id) return String(content.world_id);
  if (content.worldId) return String(content.worldId);

  const match = content.description?.match(/--world:(\d+)/);
  return match?.[1] || null;
};

const pickRandomItem = <T,>(items: T[]): T | null => {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
};

const ChildHomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activeChild, setActiveChild } = useChild();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [tempFavorites, setTempFavorites] = useState<string[]>([]);
  const [homeVideos, setHomeVideos] = useState<HomeContent[]>([]);
  const [catalogVideos, setCatalogVideos] = useState<HomeContent[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<HomeContent | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [recentVideos, setRecentVideos] = useState<RecentHomeContent[]>([]);
  const [rotatingWorldIndex, setRotatingWorldIndex] = useState(0);
  const [heroSubtitleIndex, setHeroSubtitleIndex] = useState(0);
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);

  const childWorlds = activeChild?.favoritedWorlds
    ? ALL_WORLDS.filter((w) => activeChild.favoritedWorlds.includes(w.id))
    : [];
  const displayWorlds = childWorlds.length > 0 ? childWorlds : ALL_WORLDS;
  const activeExploreWorld = displayWorlds[rotatingWorldIndex] || displayWorlds[0];

  const latestHomeVideos = useMemo(() => {
    return [...homeVideos].sort((a, b) => {
      const aTime = toTimestamp(a.published_at || a.createdAt);
      const bTime = toTimestamp(b.published_at || b.createdAt);
      return bTime - aTime;
    });
  }, [homeVideos]);

  const playableVideos = useMemo(
    () => latestHomeVideos.filter((video) => Boolean(extractPlayableUrl(video))),
    [latestHomeVideos],
  );

  const randomPlayableVideos = useMemo(() => {
    if (playableVideos.length) return playableVideos;

    return [...catalogVideos]
      .sort((a, b) => toTimestamp(b.published_at || b.createdAt) - toTimestamp(a.published_at || a.createdAt))
      .filter((video) => Boolean(extractPlayableUrl(video)));
  }, [playableVideos, catalogVideos]);

  const playableVideosByWorld = useMemo(() => {
    const buckets: Record<string, HomeContent[]> = {};

    catalogVideos.forEach((video) => {
      const worldId = extractWorldIdFromContent(video);
      if (!worldId || !extractPlayableUrl(video)) return;

      if (!buckets[worldId]) buckets[worldId] = [];
      buckets[worldId].push(video);
    });

    return buckets;
  }, [catalogVideos]);

  const filteredVideos = latestHomeVideos;

  const featuredPool = useMemo(() => filteredVideos.slice(0, 5), [filteredVideos]);
  const activeHero = featuredPool[heroIndex] || filteredVideos[0] || latestHomeVideos[0];
  const activeWorldBackground = activeExploreWorld ? WORLD_BACKGROUND_BY_ID[activeExploreWorld.id] : null;
  const heroBackgroundSrc = activeWorldBackground || activeHero?.thumbnail_url || activeHero?.thumbnail || '/BackGrounds/SultanBg.png';
  const exploreButtonColor = activeExploreWorld?.color || '#334155';
  const exploreButtonTextColor = getContrastTextColor(exploreButtonColor);

  const exploreButtonStyle = useMemo(
    () => ({
      backgroundColor: exploreButtonColor,
      color: exploreButtonTextColor,
      borderColor: toRgba(exploreButtonColor, 0.85),
      boxShadow: `0 10px 26px ${toRgba(exploreButtonColor, 0.35)}`,
    }),
    [exploreButtonColor, exploreButtonTextColor],
  );

  const heroSubtitles = useMemo(() => ([
    t('home.shahidStyleSubtitle', 'مغامرات ممتعة، شخصيات محبوبة، وحلقات جديدة يومياً.'),
    t('home.heroSubtitle2', 'قصص شيقة، تعلّم ممتع، وضحكات كل يوم.'),
    t('home.heroSubtitle3', 'عوالم سحرية، أبطال رائعون، ومفاجآت لا تنتهي.'),
  ]), [t, i18n.language]);

  const railSections = useMemo(() => {
    const items = filteredVideos;
    return [
      {
        key: 'continue',
        icon: Crown,
        title: t('home.continueWatching', 'تابع المشاهدة'),
        rows: items.slice(0, 10),
      },
      {
        key: 'trending',
        icon: Flame,
        title: t('home.trendingNow', 'الأكثر مشاهدة الآن'),
        rows: items.slice(1, 13),
      },
      {
        key: 'recommended',
        icon: Sparkles,
        title: t('home.recommendedForYou', 'مُقترح لك'),
        rows: items.slice(3, 15),
      },
    ].filter((section) => section.rows.length > 0);
  }, [filteredVideos, t]);

  const timelineCharacters = useMemo<InteractiveTimelineCharacter[]>(() => {
    const arT = i18n.getFixedT('ar');
    const enT = i18n.getFixedT('en');

    return ALL_WORLDS.slice(0, 7).map((world) => {
      const characterKey = world.name.toLowerCase();
      const defaultArBio = arT('home.defaultBio', 'عالم سحري بانتظار استكشافك!');
      const defaultEnBio = enT('home.defaultBio', 'A magical world waiting to be discovered!');

      return {
        id: world.id,
        name: {
          ar: arT(`characters.${characterKey}`, world.name),
          en: enT(`characters.${characterKey}`, world.name),
        },
        description: {
          ar: arT(`world.facts.${characterKey}`, defaultArBio),
          en: enT(`world.facts.${characterKey}`, defaultEnBio),
        },
        imageUrl: world.avatar,
        themeColor: world.color,
      };
    });
  }, [i18n.language]);

  useEffect(() => {
    const token = localStorage.getItem('pgkids_auth_token');
    if (token && !activeChild) {
      navigate('/profiles');
    }
  }, [activeChild, navigate]);

  useEffect(() => {
    const loadHomeVideos = async () => {
      try {
        setIsLoadingVideos(true);
        setVideosError(null);

        const params: any = { limit: 100 };
        if (activeChild?._id) {
          params.profileId = activeChild._id;
        }

        const { data } = await api.get('/api/content/browse', { params });

        const rows: HomeContent[] = data?.data || [];
        const mediaRows = rows.filter((item) => {
          const type = normalizeContentType(item.type);
          return ['video', 'short', 'series'].includes(type);
        });

        const unassignedVideos = mediaRows.filter((item) => !isWorldAssigned(item));

        setCatalogVideos(mediaRows);
        setHomeVideos(unassignedVideos);
      } catch (err) {
        console.error('Failed to load home videos', err);
        setVideosError(t('home.unassignedLoadError', 'تعذر تحميل فيديوهات الشاشة الرئيسية'));
        setCatalogVideos([]);
        setHomeVideos([]);
      } finally {
        setIsLoadingVideos(false);
      }
    };

    loadHomeVideos();
  }, [activeChild?._id, t]);

  useEffect(() => {
    if (!activeChild?._id) {
      setRecentVideos([]);
      return;
    }

    const loadRecentVideos = async () => {
      try {
        const { data } = await api.get('/api/content/history/recent', {
          params: { profileId: activeChild._id, limit: RECENT_VIDEO_LIMIT },
        });

        const rows: HomeContent[] = data?.data || [];
        const mappedRows: RecentHomeContent[] = rows.map((item) => ({
          ...item,
          recentKey: buildVideoKey(item),
          playedAt: toTimestamp(item.watched_at || item.published_at || item.createdAt),
        }));

        setRecentVideos(mappedRows);
      } catch (error) {
        console.error('Failed to load recent videos', error);
        setRecentVideos([]);
      }
    };

    loadRecentVideos();
  }, [activeChild?._id]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (featuredPool.length <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % featuredPool.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [featuredPool.length]);

  useEffect(() => {
    if (heroIndex >= featuredPool.length) {
      setHeroIndex(0);
    }
  }, [featuredPool.length, heroIndex]);

  useEffect(() => {
    if (displayWorlds.length <= 1) return undefined;

    const timer = setInterval(() => {
      setRotatingWorldIndex((prev) => (prev + 1) % displayWorlds.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [displayWorlds.length]);

  useEffect(() => {
    if (heroSubtitles.length <= 1) return undefined;

    const timer = setInterval(() => {
      setHeroSubtitleIndex((prev) => (prev + 1) % heroSubtitles.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [heroSubtitles.length]);

  useEffect(() => {
    if (rotatingWorldIndex >= displayWorlds.length) {
      setRotatingWorldIndex(0);
    }
  }, [displayWorlds.length, rotatingWorldIndex]);

  useEffect(() => {
    if (heroSubtitleIndex >= heroSubtitles.length) {
      setHeroSubtitleIndex(0);
    }
  }, [heroSubtitles.length, heroSubtitleIndex]);

  useEffect(() => {
    const missionVideoStillAvailable = dailyMission?.video
      ? randomPlayableVideos.some((item) => buildVideoKey(item) === buildVideoKey(dailyMission.video as HomeContent))
      : false;

    if (!dailyMission || !missionVideoStillAvailable) {
      setDailyMission(createRandomMission());
    }
  }, [dailyMission, randomPlayableVideos, playableVideosByWorld, displayWorlds, i18n.language]);

  const greetingLabel = (() => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('home.goodMorning', 'صباح المغامرات');
    if (hour < 18) return t('home.goodAfternoon', 'مساء المرح');
    return t('home.goodEvening', 'ليلة سعيدة');
  })();

  const timeLabel = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const getVideoTitle = (video?: HomeContent | null) => (video ? resolveContentTitle(video, i18n.language) : '');

  const saveRecentVideo = async (video: HomeContent) => {
    const recentKey = buildVideoKey(video);
    const nextEntry: RecentHomeContent = {
      ...video,
      recentKey,
      playedAt: Date.now(),
      watched_at: new Date().toISOString(),
    };

    setRecentVideos((prev) => [nextEntry, ...prev.filter((item) => item.recentKey !== recentKey)].slice(0, RECENT_VIDEO_LIMIT));

    const contentId = video.id || video._id;
    if (!activeChild?._id || !contentId) return;

    try {
      await api.post(`/api/content/${contentId}/watch`, {
        profileId: activeChild._id,
      });
    } catch (error) {
      console.error('Failed to sync watch event', error);
    }
  };

  const handleOpenVideo = (video: HomeContent) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setSelectedVideo(video);
    void saveRecentVideo(video);
  };

  const createRandomMission = (preferredWorldId?: string): DailyMission | null => {
    const missionWorlds = displayWorlds.length > 0 ? displayWorlds : ALL_WORLDS;
    if (!missionWorlds.length) return null;

    const selectedWorld = missionWorlds.find((world) => world.id === preferredWorldId) || pickRandomItem(missionWorlds);
    if (!selectedWorld) return null;

    const worldVideos = playableVideosByWorld[selectedWorld.id] || [];
    const missionVideo = pickRandomItem(worldVideos) || pickRandomItem(randomPlayableVideos);
    if (!missionVideo) return null;

    const nextWorldOptions = missionWorlds.filter((world) => world.id !== selectedWorld.id);
    const nextWorld = pickRandomItem(nextWorldOptions) || selectedWorld;

    const titleKeys = [
      'dailyQuestTitle1',
      'dailyQuestTitle2',
      'dailyQuestTitle3',
      'dailyQuestTitle4',
      'dailyQuestTitle5',
    ];

    const templateKeys = [
      'dailyQuestTemplate1',
      'dailyQuestTemplate2',
      'dailyQuestTemplate3',
      'dailyQuestTemplate4',
      'dailyQuestTemplate5',
    ];

    const titleIndex = Math.floor(Math.random() * titleKeys.length);
    const templateIndex = Math.floor(Math.random() * templateKeys.length);

    const titleKey = `home.${titleKeys[titleIndex]}`;
    const templateKey = `home.${templateKeys[templateIndex]}`;

    return {
      id: `${Date.now()}-${Math.random()}`,
      title: '',
      description: '',
      video: missionVideo,
      worldId: nextWorld.id,
      titleKey,
      templateKey,
      worldCharName: selectedWorld.name,
      nextWorldCharName: nextWorld.name,
    };
  };

  const handleStartMissionEpisode = () => {
    if (!dailyMission?.video || !extractPlayableUrl(dailyMission.video)) {
      window.alert(t('home.noPlayableVideoNow', 'حالياً لا يوجد فيديو قابل للتشغيل.'));
      setDailyMission(createRandomMission());
      return;
    }

    handleOpenVideo(dailyMission.video);
  };

  const handleGoToNextMissionWorld = () => {
    if (!dailyMission?.worldId) {
      window.alert(t('home.noWorldForMission', 'حالياً لا يوجد عالم متاح للمهمة.'));
      return;
    }

    const nextMission = createRandomMission(dailyMission.worldId);
    setDailyMission(nextMission);
    navigate(`/world/${dailyMission.worldId}`);
  };

  const handleRefreshMission = () => {
    setDailyMission(createRandomMission());
  };

  const favoritesCount = activeChild?.favoritedWorlds?.length || 0;
  const favoritesGoal = Math.max(3, Math.min(ALL_WORLDS.length, favoritesCount + 1));
  const recentPreview = recentVideos.slice(0, 6);

  const magicActions: Array<{
    key: string;
    title: string;
    description: string;
    icon: LucideIcon;
    onClick: () => void;
    accent: string;
    disabled?: boolean;
  }> = [
    {
      key: 'surprise',
      title: t('home.magicSurprise', 'مفاجأة الآن'),
      description: t('home.magicSurpriseDescription', 'شغّل فيديو عشوائي فورًا.'),
      icon: WandSparkles,
      onClick: () => {
        if (!randomPlayableVideos.length) {
          window.alert(t('home.noPlayableVideoNow', 'حالياً لا يوجد فيديو قابل للتشغيل.'));
          return;
        }

        const randomVideo = randomPlayableVideos[Math.floor(Math.random() * randomPlayableVideos.length)];
        handleOpenVideo(randomVideo);
      },
      accent: 'from-fuchsia-500/40 to-sky-500/30',
      disabled: !randomPlayableVideos.length,
    },
    {
      key: 'randomWorld',
      title: t('home.magicWorldJump', 'قفزة لعالم جديد'),
      description: t('home.magicWorldJumpDescription', 'روح تلقائيًا لعالم من المفضلة.'),
      icon: Rocket,
      onClick: () => {
        if (!displayWorlds.length) return;
        const randomWorld = displayWorlds[Math.floor(Math.random() * displayWorlds.length)];
        navigate(`/world/${randomWorld.id}`);
      },
      accent: 'from-emerald-500/35 to-cyan-400/25',
    },
    {
      key: 'favorites',
      title: t('home.magicFavorites', 'حدّث مفضلاتك'),
      description: t('home.magicFavoritesDescription', 'رتّب شخصياتك المفضلة بسرعة.'),
      icon: TimerReset,
      onClick: handleOpenFavorites,
      accent: 'from-orange-500/40 to-rose-500/25',
    },
  ];

  const handleExploreTimelineCharacter = (character: InteractiveTimelineCharacter) => {
    navigate(`/world/${character.id}`);
  };

  function handleOpenFavorites() {
    if (!user) {
      navigate('/auth');
      return;
    }
    setTempFavorites(activeChild?.favoritedWorlds || []);
    setIsFavoritesModalOpen(true);
  }

  const toggleFavorite = (worldId: string) => {
    if (tempFavorites.includes(worldId)) {
      setTempFavorites(tempFavorites.filter((id) => id !== worldId));
      return;
    }
    setTempFavorites([...tempFavorites, worldId]);
  };

  const saveFavorites = async () => {
    if (!activeChild) return;
    try {
      const updatedChild = { ...activeChild, favoritedWorlds: tempFavorites };
      await api.put(`/api/profiles/${activeChild._id}`, { favorited_worlds: tempFavorites });
      setActiveChild(updatedChild);
    } catch (error) {
      console.error('Failed to save favorites', error);
      setActiveChild({ ...activeChild, favoritedWorlds: tempFavorites } as any);
    } finally {
      setIsFavoritesModalOpen(false);
    }
  };

  const renderRailCard = (video: HomeContent) => (
    <motion.button
      key={video.id || video._id || video.title}
      whileHover={{ scale: 1.04, y: -3 }}
      onClick={() => handleOpenVideo(video)}
      className="relative min-w-[230px] sm:min-w-[260px] aspect-video overflow-hidden rounded-2xl border border-white/20 bg-slate-900/70 text-left shadow-lg"
    >
      <img
        src={video.thumbnail_url || video.thumbnail || '/BackGrounds/SultanBg.png'}
        alt={getVideoTitle(video)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
      <div className="absolute top-3 right-3 rounded-full bg-black/60 border border-white/20 w-9 h-9 flex items-center justify-center">
        <Play className="w-4 h-4 text-white fill-white" />
      </div>
      <p className="absolute bottom-3 left-3 right-3 text-sm sm:text-base text-white font-bold line-clamp-2">
        {getVideoTitle(video)}
      </p>
    </motion.button>
  );

  return (
    <div className="stream-page min-h-screen bg-transparent pt-24 pb-20 overflow-x-hidden relative">
      <div className="pointer-events-none absolute -top-16 -left-10 w-56 h-56 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-[28%] -right-16 w-72 h-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-[30%] w-64 h-64 rounded-full bg-orange-500/15 blur-3xl" />
      <section className="px-4 sm:px-6 mb-8 max-w-7xl mx-auto flex justify-end">
        <button
          onClick={handleOpenFavorites}
          className="stream-button flex items-center gap-2 bg-slate-900/85 hover:bg-slate-800 text-slate-100 px-4 py-2 text-sm font-bold transition-colors border border-slate-700 backdrop-blur-md"
        >
          <Star className="w-5 h-5 text-sky-300" />
          {t('home.editFavorites', 'اختر شخصياتك المفضلة')}
        </button>
      </section>

      <section className="px-4 sm:px-6 mb-12 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-[48vh] min-h-[320px] rounded-2xl overflow-hidden border border-white/20 shadow-[0_25px_70px_rgba(2,6,23,0.65)]"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={heroBackgroundSrc}
              src={heroBackgroundSrc}
              alt={activeExploreWorld ? t(`characters.${activeExploreWorld.name.toLowerCase()}`) : (getVideoTitle(activeHero) || t('home.featuredAlt'))}
              initial={{ opacity: 0.35, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.2, scale: 1.01 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/90 via-[#020617]/45 to-[#0f172a]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 md:p-10 lg:p-14">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="stream-pill px-3 py-1 text-xs font-bold border-emerald-400/45 bg-emerald-900/35">{greetingLabel} · {timeLabel}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 max-w-2xl leading-tight line-clamp-2">
              {getVideoTitle(activeHero) || t('home.latest', 'أحدث الإضافات')}
            </h1>

            <p className="text-white/80 max-w-2xl mb-5 text-sm sm:text-base">
              {heroSubtitles[heroSubtitleIndex]}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => activeExploreWorld && navigate(`/world/${activeExploreWorld.id}`)}
                style={exploreButtonStyle}
                className="stream-button flex items-center gap-2 px-5 py-2.5 text-sm border transition-all duration-500 hover:brightness-110"
              >
                {t('home.explore')}: {activeExploreWorld ? t(`characters.${activeExploreWorld.name.toLowerCase()}`) : t('home.explore')}
                <ChevronRight className="w-5 h-5 rtl:rotate-180" />
              </button>
            </div>

            {featuredPool.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                {featuredPool.map((item, index) => (
                  <button
                    key={item.id || item._id || `${item.title}-${index}`}
                    onClick={() => setHeroIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${heroIndex === index ? 'w-8 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/80'}`}
                    aria-label={getVideoTitle(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <section className="px-4 sm:px-6 mb-10 max-w-7xl mx-auto">
        <div className="stream-card stream-surface rounded-3xl px-4 sm:px-6 py-4 border border-white/10">
          <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2">
            {displayWorlds.map((world) => (
              <button
                key={world.id}
                onClick={() => navigate(`/world/${world.id}`)}
                className="group shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-800/65 border border-slate-600 hover:border-white/40 hover:bg-slate-700/70 transition-all"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: world.color }}>
                  <img src={world.avatar} alt={world.name} className="w-full h-full object-cover object-top" />
                </div>
                <span className="text-xs font-bold text-slate-100">{t(`characters.${world.name.toLowerCase()}`)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 mb-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {magicActions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.key}
                whileHover={action.disabled ? undefined : { y: -4 }}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`text-left rounded-xl border border-white/15 bg-gradient-to-br ${action.accent} p-4 backdrop-blur-sm shadow-lg transition-opacity ${action.disabled ? 'opacity-55 cursor-not-allowed' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg bg-black/35 border border-white/20 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-black text-white mb-0.5">{action.title}</h3>
                <p className="text-slate-100/80 text-xs">{action.description}</p>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="px-4 sm:px-6 mb-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-5 h-5 text-cyan-300" />
              <h3 className="text-white text-lg font-black">
                {dailyMission?.titleKey 
                  ? t(dailyMission.titleKey) 
                  : (dailyMission?.title || t('home.dailyQuest', 'مهمة اليوم'))
                }
              </h3>
            </div>
            <p className="text-slate-300 text-sm mb-2">
              {dailyMission?.templateKey && dailyMission.worldCharName && dailyMission.nextWorldCharName
                ? t(dailyMission.templateKey, { 
                    world: t(`characters.${dailyMission.worldCharName.toLowerCase()}`, dailyMission.worldCharName), 
                    nextWorld: t(`characters.${dailyMission.nextWorldCharName.toLowerCase()}`, dailyMission.nextWorldCharName) 
                  })
                : (dailyMission?.description || t('home.dailyQuestDescription', 'ابدأ بالمهمة: شاهد حلقة جديدة ثم استكشف عالم مختلف حتى تكسب شارة المستكشف!'))
              }
            </p>
            {dailyMission?.video && (
              <p className="text-sky-200/90 text-xs mb-4 line-clamp-1">
                {t('home.missionEpisodeLabel', 'حلقة المهمة')}: {getVideoTitle(dailyMission.video)}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStartMissionEpisode}
                disabled={!dailyMission?.video}
                className="stream-button bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600/60 disabled:cursor-not-allowed text-white px-4 py-2"
              >
                {t('home.startQuestVideo', 'ابدأ الحلقة')}
              </button>
              <button
                onClick={handleGoToNextMissionWorld}
                disabled={!dailyMission?.worldId}
                className="stream-button bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600/60 disabled:cursor-not-allowed text-white px-4 py-2"
              >
                {t('home.startQuestWorld', 'روح للعالم التالي')}
              </button>
              <button
                onClick={handleRefreshMission}
                className="stream-button bg-violet-600 hover:bg-violet-500 text-white px-4 py-2"
              >
                {t('home.newQuest', 'مهمة جديدة')}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/75 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-lg font-black">{t('home.worldPassport', 'جواز العوالم')}</h3>
              <Star className="w-5 h-5 text-orange-300" />
            </div>
            <p className="text-slate-300 text-sm mb-3">
              {t('home.worldPassportDescription', 'كل ما تضيف شخصية لمفضلاتك، جوازك يصير أقوى!')}
            </p>
            <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-orange-500 to-sky-500" style={{ width: `${Math.min(100, (favoritesCount / favoritesGoal) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-300">{t('home.worldPassportProgress', 'التقدم')} {favoritesCount}/{favoritesGoal}</p>
          </div>
        </div>

        {recentPreview.length > 0 && (
          <div className="stream-card stream-surface rounded-xl p-3 border border-white/10 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-5 h-5 text-fuchsia-300" />
              <h3 className="text-slate-100 font-black">{t('home.recentlyPlayed', 'آخر ما شاهدته')}</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
              {recentPreview.map((video) => (
                <button
                  key={video.recentKey}
                  onClick={() => handleOpenVideo(video)}
                  className="shrink-0 w-44 rounded-lg overflow-hidden border border-white/15 bg-slate-900/70 text-left"
                >
                  <div className="relative aspect-video">
                    <img src={video.thumbnail_url || video.thumbnail || '/BackGrounds/SultanBg.png'} alt={getVideoTitle(video)} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                    <Play className="absolute top-2 right-2 w-4 h-4 text-white fill-white" />
                  </div>
                  <p className="text-sm text-slate-100 font-bold p-2 line-clamp-2">{getVideoTitle(video)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

      </section>

      <section className="px-4 sm:px-6 max-w-7xl mx-auto space-y-10">
        {isLoadingVideos && (
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 text-slate-200">
            {t('home.loadingVideos', 'جاري تحميل الفيديوهات...')}
          </div>
        )}

        {!isLoadingVideos && videosError && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-6 text-red-300">
            {videosError}
          </div>
        )}

        {!isLoadingVideos && !videosError && railSections.length === 0 && (
          <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 text-slate-200">
            {t('home.noUnassignedVideos', 'لا يوجد فيديوهات غير مرتبطة بأي عالم حالياً')}
          </div>
        )}

        {!isLoadingVideos && !videosError && railSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.key} className="space-y-4">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-orange-300" />
                <h2 className="text-lg md:text-xl font-extrabold text-slate-100">{section.title}</h2>
              </div>

              <div className="overflow-x-auto custom-scrollbar pb-3">
                <div className="flex gap-4 w-max">
                  {section.rows.map(renderRailCard)}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {!isLoadingVideos && !videosError && filteredVideos.length > 0 && (
        <section className="px-4 sm:px-6 mt-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-5">
            <Flame className="w-5 h-5 text-orange-300" />
            <h2 className="text-lg md:text-xl font-extrabold text-slate-100">{t('home.topTenToday', 'Top 10 اليوم')}</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {filteredVideos.slice(0, 10).map((video, index) => (
              <motion.button
                key={`rank-${video.id || video._id || video.title}`}
                whileHover={{ y: -4 }}
                onClick={() => handleOpenVideo(video)}
                className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/15"
              >
                <img
                  src={video.thumbnail_url || video.thumbnail || '/BackGrounds/SultanBg.png'}
                  alt={getVideoTitle(video)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
                <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center">
                  {index + 1}
                </span>
                <p className="absolute bottom-2 left-2 right-2 text-xs sm:text-sm text-white font-bold line-clamp-2">{getVideoTitle(video)}</p>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 sm:px-6 mt-14 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-100 mb-5">
          {t('home.worldsForYou', 'عوالم مختارة لك')}
        </h2>

        <InteractiveTimeline
          characters={timelineCharacters}
          onExploreCharacter={handleExploreTimelineCharacter}
          className="mt-6"
        />
      </section>

      <VideoPlayerModal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        videoUrl={extractPlayableUrl(selectedVideo) || undefined}
        title={getVideoTitle(selectedVideo)}
        profileId={activeChild?._id}
      />

      <AnimatePresence>
        {isFavoritesModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="stream-card stream-surface border border-slate-700 p-8 rounded-3xl w-full max-w-3xl relative max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <button
                onClick={() => setIsFavoritesModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-3xl font-extrabold text-white mb-8 text-center flex items-center justify-center gap-3">
                <Star className="w-8 h-8 text-sky-300 fill-sky-300" />
                {t('home.selectFavorites', 'Select Your Favorites!')}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 mb-8">
                {ALL_WORLDS.map((world) => {
                  const isSelected = tempFavorites.includes(world.id);
                  return (
                    <button
                      key={world.id}
                      onClick={() => toggleFavorite(world.id)}
                      className={`relative flex flex-col items-center gap-3 p-4 rounded-3xl transition-all border-2 ${isSelected ? 'border-sky-400 bg-sky-900/35 scale-105 shadow-[0_0_20px_rgba(14,165,233,0.28)]' : 'border-transparent hover:border-slate-500 bg-slate-800/55 hover:bg-slate-800'}`}
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-500 bg-gradient-to-b from-slate-700 to-slate-900">
                        <img src={world.avatar} alt={t(`characters.${world.name.toLowerCase()}`)} className="w-full h-full object-cover object-top" />
                      </div>
                      <span className="font-bold text-slate-100 text-lg">{t(`characters.${world.name.toLowerCase()}`)}</span>
                      {isSelected && (
                        <div className="absolute -top-3 -right-3 rtl:-left-3 rtl:-right-auto bg-sky-400 text-slate-900 p-1.5 rounded-full shadow-lg">
                          <Star className="w-5 h-5 fill-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={saveFavorites}
                  className="stream-button bg-gradient-to-r from-orange-500 to-sky-600 hover:from-orange-400 hover:to-sky-500 text-white font-bold text-xl px-12 py-4 shadow-[0_0_30px_rgba(14,165,233,0.28)] transition-transform hover:scale-105 active:scale-95"
                >
                  {t('home.saveFavorites', 'Save Selections')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChildHomePage;


import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { motion } from 'framer-motion';
import { Play, Lock, Sparkles, Compass, Dice5, ChevronLeft, ChevronRight } from 'lucide-react';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { useChild } from '../context/ChildContext';
import { useAuth } from '../context/AuthContext';
import { resolveContentTitle } from '../utils/contentTitles';

interface Content {
  id?: string;
  _id?: string;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  type: string;
  world_id?: string;
  worldId?: string;
  world_section?: 'shorts' | 'series';
  worldSection?: 'shorts' | 'series';
  playback_url?: string;
  url?: string;
  thumbnail_url?: string;
  thumbnail?: string;
  description?: string;
  watch_count?: number | string | null;
  total_watch_count?: number | string | null;
}

const ALL_WORLDS: Record<string, { name: string; avatar: string; color: string; factKey: string }> = {
  '1': { name: 'Bader', avatar: '/characters/Bader.png', color: '#3B82F6', factKey: 'world.facts.bader' },
  '2': { name: 'Lulwa', avatar: '/characters/Lulwa.png', color: '#EC4899', factKey: 'world.facts.lulwa' },
  '3': { name: 'Tantal', avatar: '/characters/Tantal.png', color: '#10B981', factKey: 'world.facts.tantal' },
  '4': { name: 'Sultan', avatar: '/characters/The Shark Sultan.png', color: '#F59E0B', factKey: 'world.facts.sultan' },
  '5': { name: 'Budour', avatar: '/characters/Budour.png', color: '#8B5CF6', factKey: 'world.facts.budour' },
  '6': { name: 'Naya', avatar: '/characters/Naya.png', color: '#06B6D4', factKey: 'world.facts.naya' },
  '7': { name: 'Labib', avatar: '/characters/Labib.png', color: '#F43F5E', factKey: 'world.facts.labib' },
};

const WorldViewPage: React.FC = () => {
  const { worldId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeChild } = useChild();
  
  const [contents, setContents] = useState<Content[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Content | null>(null);
  const [bgFailed, setBgFailed] = useState(false);
  const [backendCompletionRatio, setBackendCompletionRatio] = useState<number | null>(null);

  const worldInfo = worldId && ALL_WORLDS[worldId]
    ? ALL_WORLDS[worldId]
    : { name: 'Unknown World', avatar: '/characters/Bader.png', color: '#64748B', factKey: 'world.facts.default' };

  useEffect(() => {
    setBgFailed(false);
  }, [worldId]);

  useEffect(() => {
    if (!worldId) {
      setContents([]);
      return;
    }

    const fetchContent = async () => {
      try {
        const browseParams: Record<string, string> = { world_id: worldId };
        if (activeChild?._id) browseParams.profileId = activeChild._id;

        const { data } = await api.get('/api/content/browse', { params: browseParams });
        const worldContent = (data.data || []).filter((c: Content) => (
          c.world_id === worldId
          || c.worldId === worldId
          || (c.description && c.description.includes(`--world:${worldId}`))
        ));
        setContents(worldContent);
      } catch (err) {
        console.error(err);
        // Mock data
        setContents([
          { id: 'c1', title: t('world.sampleEpisode'), type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', world_id: worldId, world_section: 'series' },
          { id: 'c2', title: t('world.sampleShortAdventure'), type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', world_id: worldId, world_section: 'shorts' },
        ]);
      }
    };
    fetchContent();
  }, [worldId, t, activeChild?._id]);

  const handleOpenVideo = (video: Content) => {
    if (user?.role === 'parent' && !activeChild) {
      alert(t('world.selectProfileFirst'));
      navigate('/profiles');
      return;
    }

    setSelectedVideo(video);

    const contentId = video.id || video._id;
    if (!activeChild?._id || !contentId) return;

    api.post(`/api/content/${contentId}/watch`, { profileId: activeChild._id }).catch((err) => {
      console.error('Failed to sync watch event', err);
    });
  };

  const worldVideos = contents.filter((c) => ['video', 'short', 'series'].includes(c.type));

  const series = worldVideos.filter((c) => {
    const section = c.world_section || c.worldSection;
    return section === 'series' || c.type === 'series' || Boolean(c.description?.includes('--section:series'));
  });

  const shorts = worldVideos.filter((c) => {
    const section = c.world_section || c.worldSection;
    if (section === 'shorts' || Boolean(c.description?.includes('--section:shorts'))) return true;
    if (series.some((seriesItem) => (seriesItem.id || seriesItem._id) === (c.id || c._id))) return false;
    return c.type === 'short' || c.type === 'video';
  });

  const playableVideos = worldVideos.filter((video) => Boolean(video.playback_url || video.url));
  const worldIds = Object.keys(ALL_WORLDS).sort((a, b) => Number(a) - Number(b));
  const currentWorldIndex = worldId ? worldIds.indexOf(worldId) : -1;
  const previousWorldId = currentWorldIndex > 0 ? worldIds[currentWorldIndex - 1] : worldIds[worldIds.length - 1];
  const nextWorldId = currentWorldIndex >= 0 ? worldIds[(currentWorldIndex + 1) % worldIds.length] : worldIds[0];

  const spotlightVideos = useMemo(() => {
    const getVideoWatchCount = (video: Content) => {
      const rawCount = video.total_watch_count ?? video.watch_count ?? 0;
      const parsedCount = Number(rawCount);
      return Number.isFinite(parsedCount) ? parsedCount : 0;
    };

    return [...playableVideos]
      .sort((a, b) => getVideoWatchCount(b) - getVideoWatchCount(a))
      .slice(0, 3);
  }, [playableVideos]);

  const completionRatio = useMemo(() => {
    if (typeof backendCompletionRatio === 'number') return backendCompletionRatio;
    if (!worldVideos.length) return 0;
    const completedUnits = Math.min(worldVideos.length, series.length + shorts.length);
    return Math.round((completedUnits / worldVideos.length) * 100);
  }, [backendCompletionRatio, series.length, shorts.length, worldVideos.length]);

  const getVideoTitle = (video?: Content | null) => (video ? resolveContentTitle(video, i18n.language) : '');

  const jumpToRandomVideo = () => {
    if (!playableVideos.length) return;
    const randomVideo = playableVideos[Math.floor(Math.random() * playableVideos.length)];
    handleOpenVideo(randomVideo);
  };

  useEffect(() => {
    if (!activeChild?._id || !worldId) {
      setBackendCompletionRatio(null);
      return;
    }

    const loadWorldProgress = async () => {
      try {
        const { data } = await api.get('/api/content/history/world-progress', {
          params: { profileId: activeChild._id, worldId },
        });
        const percent = Number(data?.data?.completion_percent);
        setBackendCompletionRatio(Number.isFinite(percent) ? percent : null);
      } catch (err) {
        console.error('Failed to load world progress', err);
        setBackendCompletionRatio(null);
      }
    };

    loadWorldProgress();
  }, [activeChild?._id, worldId]);

  return (
    <div className="stream-page min-h-screen bg-transparent relative overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgFailed ? worldInfo.avatar : `/BackGrounds/${worldInfo.name}Bg.png`} 
          alt={worldInfo.name} 
          className={`w-full h-full object-cover ${bgFailed || !ALL_WORLDS[worldId || ''] ? 'blur-3xl opacity-30 scale-110' : 'opacity-40'}`}
          onError={() => setBgFailed(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-slate-950/70 to-transparent" />
      </div>

      <div className="relative z-10 pt-32 px-6 pb-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="stream-pill px-8 py-3 mb-5 w-max">
            <h1 className="text-4xl md:text-5xl font-extrabold stream-title drop-shadow-2xl">
              {worldId && ALL_WORLDS[worldId] ? t(`characters.${worldInfo.name.toLowerCase()}`) : t('world.unknownWorld')}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-white/15 bg-slate-900/70 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Compass className="w-5 h-5" style={{ color: worldInfo.color }} />
                <h2 className="text-white text-xl font-black">{t('world.explorerPanel', 'لوحة المستكشف')}</h2>
              </div>
              <p className="text-slate-200 text-sm mb-4">{t(worldInfo.factKey)}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-black/35 border border-white/20 text-xs text-slate-100">{t('world.statsVideos', 'فيديوهات')}: {worldVideos.length}</span>
                <span className="px-3 py-1 rounded-full bg-black/35 border border-white/20 text-xs text-slate-100">{t('world.shortFilms', 'أفلام قصيرة')}: {shorts.length}</span>
                <span className="px-3 py-1 rounded-full bg-black/35 border border-white/20 text-xs text-slate-100">{t('world.series', 'مسلسلات')}: {series.length}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={jumpToRandomVideo}
                  disabled={!playableVideos.length}
                  className="stream-button bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-slate-600/60 disabled:cursor-not-allowed text-white px-4 py-2 inline-flex items-center gap-2"
                >
                  <Dice5 className="w-4 h-4" />
                  {t('world.randomEpisode', 'حلقة عشوائية')}
                </button>
                <button
                  onClick={() => navigate(`/world/${nextWorldId}`)}
                  className="stream-button bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 inline-flex items-center gap-2"
                >
                  {t('world.nextWorld', 'العالم التالي')}
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-slate-900/70 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h3 className="text-white text-lg font-black">{t('world.worldProgress', 'تقدم العالم')}</h3>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden mb-2">
                <div className="h-full transition-all bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${completionRatio}%` }} />
              </div>
              <p className="text-xs text-slate-300 mb-4">{completionRatio}%</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/world/${previousWorldId}`)}
                  className="stream-button bg-slate-800 hover:bg-slate-700 text-slate-100 py-2 inline-flex justify-center items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  {t('world.prev', 'السابق')}
                </button>
                <button
                  onClick={() => navigate(`/world/${nextWorldId}`)}
                  className="stream-button bg-slate-800 hover:bg-slate-700 text-slate-100 py-2 inline-flex justify-center items-center gap-1"
                >
                  {t('world.next', 'التالي')}
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <section className="mb-12">
          <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
            {worldIds.map((id) => {
              const info = ALL_WORLDS[id];
              const isActive = id === worldId;
              return (
                <button
                  key={id}
                  onClick={() => navigate(`/world/${id}`)}
                  className={`shrink-0 rounded-full px-4 py-2 border transition-all inline-flex items-center gap-2 ${isActive ? 'bg-white text-slate-900 border-white' : 'bg-slate-900/65 text-slate-100 border-white/20 hover:border-white/40'}`}
                >
                  <img src={info.avatar} alt={info.name} className="w-7 h-7 rounded-full object-cover object-top border border-white/30" />
                  <span className="font-bold text-sm">{t(`characters.${info.name.toLowerCase()}`)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* All Videos Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-100 mb-6 pl-3 border-l-4 border-sky-500">{t('world.videos')}</h2>
          {worldVideos.length === 0 ? (
            <div className="bg-slate-900/75 border border-slate-700 rounded-2xl p-8 text-center text-slate-200">
              {t('world.noVideos')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {worldVideos.map(video => (
                <motion.div
                  key={`all-${video.id || video._id || video.title}`}
                  whileHover={{ scale: 1.03 }}
                  className="stream-card aspect-video bg-slate-900/70 border border-slate-600/70 rounded-2xl overflow-hidden cursor-pointer relative group shadow-lg"
                  onClick={() => handleOpenVideo(video)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="w-14 h-14 rounded-full bg-black/55 border border-white/25 backdrop-blur-md flex items-center justify-center group-hover:bg-sky-700/70 transition-colors">
                      <Play className="fill-white text-white w-7 h-7 ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 z-20">
                    <h3 className="text-white font-bold text-lg line-clamp-2">{getVideoTitle(video)}</h3>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Short Films Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-100 mb-6 pl-3 border-l-4 border-blue-500">{t('world.shortFilms')}</h2>
          <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar snap-x">
            {shorts.length === 0 && <p className="text-slate-300">{t('world.noVideos')}</p>}
            {shorts.map(short => (
              <motion.div
                key={short.id || short._id || short.title}
                whileHover={{ scale: 1.05 }}
                className="stream-card min-w-[240px] md:min-w-[280px] aspect-video bg-slate-900/70 border border-slate-600/70 rounded-xl overflow-hidden cursor-pointer relative group snap-start shadow-lg"
                onClick={() => handleOpenVideo(short)}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="w-16 h-16 rounded-full bg-black/55 border border-white/25 backdrop-blur-md flex items-center justify-center group-hover:bg-blue-700/70 transition-colors">
                    <Play className="fill-white text-white w-8 h-8 ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <h3 className="text-white font-bold text-lg">{getVideoTitle(short)}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Series Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-100 mb-6 pl-3 border-l-4 border-orange-500">{t('world.series')}</h2>
          <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar snap-x">
            {series.length === 0 && <p className="text-slate-300">{t('world.noVideos')}</p>}
            {series.map(item => (
              <motion.div
                key={item.id || item._id || item.title}
                whileHover={{ scale: 1.05 }}
                className="stream-card min-w-[240px] md:min-w-[280px] aspect-video bg-slate-900/70 border border-slate-600/70 rounded-xl overflow-hidden cursor-pointer relative group snap-start shadow-lg"
                onClick={() => handleOpenVideo(item)}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="w-16 h-16 rounded-full bg-black/55 border border-white/25 backdrop-blur-md flex items-center justify-center group-hover:bg-orange-600/70 transition-colors">
                    <Play className="fill-white text-white w-8 h-8 ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <h3 className="text-white font-bold text-lg">{getVideoTitle(item)}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {spotlightVideos.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-slate-100 mb-8 pl-4 border-l-4 border-fuchsia-500">{t('world.spotlight', 'الأكثر مشاهدة')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {spotlightVideos.map((video, index) => (
                <motion.button
                  key={`spotlight-${video.id || video._id || video.title}`}
                  whileHover={{ y: -4 }}
                  onClick={() => handleOpenVideo(video)}
                  className="relative aspect-video rounded-2xl overflow-hidden border border-white/20"
                >
                  <img
                    src={video.thumbnail_url || video.thumbnail || '/BackGrounds/SultanBg.png'}
                    alt={getVideoTitle(video)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <span className="absolute top-2 left-2 w-8 h-8 rounded-full bg-fuchsia-500 text-white text-sm font-black flex items-center justify-center">{index + 1}</span>
                  <p className="absolute bottom-3 left-3 right-3 text-white font-bold text-sm line-clamp-2">{getVideoTitle(video)}</p>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Games Section (Locked) */}
        <section className="mb-16 relative">
          <h2 className="text-3xl font-bold text-slate-100 mb-8 pl-4 border-l-4 border-sky-400">{t('world.games')}</h2>
          <div className="relative">
            <div className="flex gap-6 overflow-hidden pb-8 blur-md opacity-50 select-none pointer-events-none">
              {[1, 2, 3].map(i => (
                <div key={i} className="min-w-[280px] aspect-square bg-slate-900/60 rounded-3xl border border-slate-700" />
              ))}
            </div>
            
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <div className="stream-card bg-slate-900/85 backdrop-blur-xl border border-amber-400/50 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                  <Lock className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-yellow-500 drop-shadow-md">{t('world.soon')}</h3>
              </div>
            </div>
          </div>
        </section>
      </div>

      <VideoPlayerModal 
        isOpen={!!selectedVideo} 
        onClose={() => setSelectedVideo(null)} 
        videoUrl={selectedVideo?.playback_url || selectedVideo?.url}
        title={getVideoTitle(selectedVideo)}
        profileId={activeChild?._id}
      />
    </div>
  );
};

export default WorldViewPage;

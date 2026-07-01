import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

const toAbsoluteVideoUrl = (url?: string) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;

  const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
  if (!base) return url;

  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
};

const isProtectedPlaybackUrl = (url?: string) => {
  if (!url) return false;
  return url.startsWith('/api/content/') || /^https?:\/\/[^/]+\/api\/content\/.+\/playback/i.test(url);
};

const parsePlaybackErrorMessage = async (err: any, fallbackMessage: string): Promise<string> => {
  const data = err?.response?.data;
  if (!data) return fallbackMessage;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed?.message || data;
    } catch {
      return data;
    }
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text();
      if (!text) return fallbackMessage;
      const parsed = JSON.parse(text);
      return parsed?.message || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  return data?.message || fallbackMessage;
};

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
  profileId?: string;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ isOpen, onClose, videoUrl, title, profileId }) => {
  const { t } = useTranslation();
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setResolvedVideoUrl(null);
    setErrorMessage(null);
    setIsLoading(false);
    onClose();
  }, [onClose]);

  const sourceUrl = useMemo(() => toAbsoluteVideoUrl(videoUrl), [videoUrl]);
  const isProtectedPlayback = useMemo(() => isProtectedPlaybackUrl(videoUrl), [videoUrl]);
  const fallbackPlaybackError = t('video.playbackLoadError');

  useEffect(() => {
    if (!isOpen || !sourceUrl) {
      setResolvedVideoUrl(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        if (!isProtectedPlayback) {
          setResolvedVideoUrl(sourceUrl);
          return;
        }

        const response = await api.get(sourceUrl, {
          responseType: 'blob',
          params: profileId ? { profileId } : undefined,
        });

        objectUrl = URL.createObjectURL(response.data);
        if (!cancelled) setResolvedVideoUrl(objectUrl);
      } catch (err: any) {
        console.error('Video load failed', err);
        if (!cancelled) {
          setResolvedVideoUrl(null);
          setErrorMessage(await parsePlaybackErrorMessage(err, fallbackPlaybackError));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadVideo();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, sourceUrl, profileId, isProtectedPlayback, fallbackPlaybackError]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-12"
        >
          <button
            onClick={handleClose}
            aria-label={t('video.close')}
            className="absolute top-6 right-6 rtl:left-6 rtl:right-auto text-white/50 hover:text-white transition-colors p-2 bg-white/10 hover:bg-white/20 rounded-full z-10"
          >
            <X className="w-8 h-8" />
          </button>
          
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative"
          >
            {resolvedVideoUrl ? (
              <video
                src={resolvedVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onError={() => {
                  setResolvedVideoUrl(null);
                  setErrorMessage(
                    resolvedVideoUrl && !resolvedVideoUrl.startsWith('blob:')
                      ? t('video.sourceError')
                      : t('video.playError'),
                  );
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white px-6 text-center">
                <p className="text-2xl mb-4 font-bold">{title || t('video.loading')}</p>
                {isLoading && <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                {!isLoading && errorMessage && (
                  <p className="text-red-300 text-sm md:text-base max-w-lg">{errorMessage}</p>
                )}
              </div>
            )}
          </motion.div>

          <button
            onClick={handleClose}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold border border-white/30 transition-colors"
          >
            {t('video.closeVideo')}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPlayerModal;

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export type LocalizedText = string | Partial<Record<'ar' | 'en', string>>;

export interface TimelineDecoration {
  id: string;
  imageUrl: string;
  alt?: LocalizedText;
  className?: string;
}

export interface InteractiveTimelineCharacter {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  imageUrl: string;
  themeColor: string;
  decorations?: TimelineDecoration[];
}

interface InteractiveTimelineProps {
  characters: InteractiveTimelineCharacter[];
  onExploreCharacter?: (character: InteractiveTimelineCharacter) => void;
  className?: string;
  exploreLabel?: string;
}

type ColorVarsStyle = React.CSSProperties & {
  '--character-glow': string;
};

const resolveLocalizedText = (value: LocalizedText, language: string) => {
  if (typeof value === 'string') return value;

  const normalizedLanguage = language.startsWith('ar') ? 'ar' : 'en';
  return value[normalizedLanguage] || value.en || value.ar || '';
};

const InteractiveTimeline: React.FC<InteractiveTimelineProps> = ({
  characters,
  onExploreCharacter,
  className = '',
  exploreLabel,
}) => {
  const { t, i18n } = useTranslation();

  const actionLabel = exploreLabel || t('home.explore', 'Explore World / استكشف العالم');

  return (
    <section className={`relative ${className}`}>
      <motion.div
        className="mx-auto mb-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-lg text-white/80"
        animate={{ y: [0, 5, 0], opacity: [0.45, 1, 0.45] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.8, ease: 'easeInOut' }}
        aria-hidden
      >
        v
      </motion.div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-white/20" />

        <div className="space-y-12 md:space-y-16">
          {characters.map((character, index) => {
            const isOdd = index % 2 === 1;
            const showAvatarFirst = isOdd;

            const cardColorStyle: ColorVarsStyle = {
              '--character-glow': character.themeColor,
            };

            const avatarPanel = (
              <div className="relative overflow-visible px-2 md:px-4">
                <div
                  style={cardColorStyle}
                  className="relative h-32 w-32 md:h-40 md:w-40 rounded-full border border-white/35 bg-slate-950/70 shadow-[0_0_40px_var(--character-glow)]"
                >
                  <div className="absolute inset-2 rounded-full border border-white/20" />
                  <img
                    src={character.imageUrl}
                    alt={resolveLocalizedText(character.name, i18n.language)}
                    className="absolute bottom-0 left-1/2 h-[116%] w-[116%] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_14px_24px_rgba(15,23,42,0.55)]"
                  />

                  {(character.decorations || []).map((decoration) => (
                    <img
                      key={decoration.id}
                      src={decoration.imageUrl}
                      alt={resolveLocalizedText(decoration.alt || '', i18n.language)}
                      className={decoration.className || 'absolute -top-5 -right-5 h-12 w-12 animate-pulse'}
                    />
                  ))}
                </div>
              </div>
            );

            const infoCard = (
              <div
                style={cardColorStyle}
                className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-[0_16px_45px_rgba(2,6,23,0.35)]"
              >
                <h3
                  className="mb-2 text-xl md:text-2xl font-extrabold"
                  style={{ color: character.themeColor, textShadow: '0 0 20px var(--character-glow)' }}
                >
                  {resolveLocalizedText(character.name, i18n.language)}
                </h3>
                <p className="mb-4 text-xs md:text-sm leading-relaxed text-slate-200">
                  {resolveLocalizedText(character.description, i18n.language)}
                </p>
                <button
                  onClick={() => onExploreCharacter?.(character)}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 shadow-[0_0_20px_var(--character-glow)]"
                >
                  {actionLabel}
                </button>
              </div>
            );

            const startContent = showAvatarFirst ? avatarPanel : infoCard;
            const endContent = showAvatarFirst ? infoCard : avatarPanel;

            return (
              <motion.article
                key={character.id}
                className="relative flex flex-row rtl:flex-row-reverse items-center gap-2 md:gap-6"
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ type: 'spring', stiffness: 110, damping: 18 }}
              >
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-[calc(50%-2.4rem)] -translate-x-full -translate-y-1/2 border-t-2 border-dashed border-white/20" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-[calc(50%-2.4rem)] -translate-y-1/2 border-t-2 border-dashed border-white/20" />

                <div className="flex flex-1 justify-end rtl:justify-start">{startContent}</div>

                <div className="z-10 flex w-10 shrink-0 justify-center">
                  <span
                    style={cardColorStyle}
                    className="block h-4 w-4 rounded-full border border-white/60 bg-white shadow-[0_0_16px_var(--character-glow)]"
                  />
                </div>

                <div className="flex flex-1 justify-start rtl:justify-end">{endContent}</div>
              </motion.article>
            );
          })}
        </div>
      </div>

      <motion.div
        className="mx-auto mt-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-lg text-white/80"
        animate={{ y: [0, 5, 0], opacity: [0.45, 1, 0.45] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.8, ease: 'easeInOut', delay: 0.4 }}
        aria-hidden
      >
        v
      </motion.div>
    </section>
  );
};

export default InteractiveTimeline;

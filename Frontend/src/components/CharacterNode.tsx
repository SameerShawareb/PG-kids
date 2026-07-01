import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface CharacterNodeProps {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  color: string;
  index: number;
}

const CharacterNode: React.FC<CharacterNodeProps> = ({ id, name, avatar, bio, color, index }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEven = index % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: isEven ? -100 : 100 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-20%" }}
      transition={{ type: "spring", bounce: 0.4, duration: 1 }}
      className={`relative flex items-center justify-center w-full min-h-[80vh] ${isEven ? 'flex-col md:flex-row' : 'flex-col md:flex-row-reverse'}`}
    >
      {/* Connecting Path Line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent -z-10 hidden md:block" />

      {/* The Node */}
      <div className="flex-1 flex justify-center p-8 relative">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="relative w-64 h-64 md:w-80 md:h-80 rounded-full"
          style={{ boxShadow: `0 0 60px ${color}40, inset 0 0 40px ${color}40` }}
        >
          <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: color }} />
          <div className="absolute inset-2 rounded-full overflow-visible flex items-end justify-center">
            <img 
              src={avatar} 
              alt={name} 
              className="w-[120%] h-[120%] object-contain object-bottom drop-shadow-2xl z-10 origin-bottom"
            />
          </div>
        </motion.div>
      </div>

      {/* Info Panel */}
      <div className={`flex-1 p-8 text-center md:text-left ${!isEven && 'md:text-right'}`}>
        <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-4" style={{ textShadow: `0 0 20px ${color}` }}>
          {name}
        </h2>
        <p className="text-xl text-gray-300 mb-8 max-w-md mx-auto md:mx-0">
          {bio || t('home.defaultBio')}
        </p>
        <button
          onClick={() => navigate(`/world/${id}`)}
          className="px-8 py-4 rounded-full text-white font-bold text-lg shadow-xl transition-transform hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}, #0B0F19)` }}
        >
          {t('home.explore')}
        </button>
      </div>
    </motion.div>
  );
};

export default CharacterNode;

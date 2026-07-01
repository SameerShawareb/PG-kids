import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChild } from '../context/ChildContext';
import api from '../api/axios';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface Profile {
  _id: string;
  name: string;
  age: number;
  avatar: string;
  favoritedWorlds: string[];
}

const ProfilesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setActiveChild } = useChild();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data } = await api.get('/api/profiles');
        const mappedProfiles = data.data.map((p: any) => {
          const id = p.id || p._id;
          return {
            _id: id,
            name: p.name,
            age: p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : p.age,
            avatar: p.avatar,
            favoritedWorlds: p.favorited_worlds || []
          };
        });
        setProfiles(mappedProfiles);
      } catch (err) {
        console.error(err);
        // Fallback for mock if backend isn't ready
        setProfiles([
          { _id: '1', name: 'Zaid', age: 8, avatar: '/characters/Bader.png', favoritedWorlds: ['1', '2'] },
          { _id: '2', name: 'Mohammad', age: 10, avatar: '/characters/Tantal.png', favoritedWorlds: ['3'] },
          { _id: '3', name: 'Farah', age: 6, avatar: '/characters/Lulwa.png', favoritedWorlds: ['1', '2', '3'] },
        ]);
      }
    };
    fetchProfiles();
  }, []);

  const handleSelect = (child: Profile) => {
    setActiveChild(child);
    navigate('/home');
  };

  return (
    <div className="stream-page min-h-screen bg-transparent flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-700/25 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="stream-pill px-8 py-3 mb-12 relative z-10"
      >
        <h1 className="text-3xl md:text-5xl font-extrabold stream-title text-center">
          {t('profiles.title')}
        </h1>
      </motion.div>

      <div className="flex flex-wrap justify-center gap-8 relative z-10">
        {profiles.map((profile, idx) => (
          <motion.div
            key={profile._id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1, type: 'spring' }}
            whileHover={{ scale: 1.1, y: -10 }}
            className="flex flex-col items-center gap-4 cursor-pointer"
            onClick={() => handleSelect(profile)}
          >
            <div className="stream-card w-28 h-28 md:w-40 md:h-40 !rounded-full overflow-hidden border border-slate-500/50 hover:border-sky-400 transition-colors bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl relative group">
              <img 
                src={profile.avatar === 'custom' ? (localStorage.getItem(`pgkids_custom_avatar_${profile._id}`) || '/characters/Bader.png') : profile.avatar} 
                alt={profile.name} 
                className={`w-full h-full object-cover drop-shadow-2xl group-hover:scale-110 transition-transform duration-500 ${profile.avatar === 'custom' ? 'object-center' : 'object-top scale-110 origin-top'}`}
              />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/5 transition-colors" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-100 hover:text-sky-300 transition-colors">
              {profile.name}
            </h2>
          </motion.div>
        ))}

        {user?.role === 'parent' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: profiles.length * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="flex flex-col items-center gap-4 cursor-pointer"
            onClick={() => navigate('/parent')}
          >
            <div className="stream-card w-28 h-28 md:w-40 md:h-40 !rounded-full flex items-center justify-center border-2 border-dashed border-slate-500 hover:border-orange-400 bg-slate-900/60 hover:bg-slate-800 transition-all text-slate-300 hover:text-orange-300">
              <Plus className="w-16 h-16" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-200">
              {t('parent.addChild')}
            </h2>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ProfilesPage;

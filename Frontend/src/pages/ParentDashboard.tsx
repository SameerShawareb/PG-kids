import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Upload } from 'lucide-react';

interface Profile {
  _id: string;
  name: string;
  age: number;
  avatar: string;
}

const avatars = [
  '/characters/Bader.png',
  '/characters/Bader1.png',
  '/characters/Budour.png',
  '/characters/Labib.png',
  '/characters/Lulwa.png',
  '/characters/Naya.png',
  '/characters/Tantal.png',
  '/characters/The Shark Sultan.png',
  '/characters/qatrab.png',
  '/characters/shahed.png',
  '/characters/shams.png',
];

const ParentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', age: '', avatar: avatars[0] });
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'parent') {
      navigate('/auth');
      return;
    }
    fetchProfiles();
  }, [user, navigate]);

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
      setProfiles([
        { _id: '1', name: 'Zaid', age: 8, avatar: '/characters/Bader.png' },
      ]);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - Number(newProfile.age));
      
      const { data } = await api.post('/api/profiles', {
        name: newProfile.name,
        dob: dob.toISOString(),
        avatar: newProfile.avatar
      });

      const profileId = data.data.id || data.data._id;
      if (newProfile.avatar === 'custom' && customAvatarPreview) {
        localStorage.setItem(`pgkids_custom_avatar_${profileId}`, customAvatarPreview);
      }

      setIsModalOpen(false);
      setCustomAvatarPreview(null);
      setNewProfile({ name: '', age: '', avatar: avatars[0] });
      fetchProfiles();
    } catch (err) {
      console.error(err);
      const mockId = Date.now().toString();
      if (newProfile.avatar === 'custom' && customAvatarPreview) {
        localStorage.setItem(`pgkids_custom_avatar_${mockId}`, customAvatarPreview);
      }
      setProfiles([...profiles, { _id: mockId, name: newProfile.name, age: Number(newProfile.age), avatar: newProfile.avatar }]);
      setIsModalOpen(false);
      setCustomAvatarPreview(null);
      setNewProfile({ name: '', age: '', avatar: avatars[0] });
    }
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      alert(t('profile.avatarTooLarge', 'الصورة كبيرة جداً! يرجى اختيار صورة أقل من 200 كيلوبايت.'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCustomAvatarPreview(base64String);
      setNewProfile({ ...newProfile, avatar: 'custom' });
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string) => {
    const pin = prompt(t('parent.confirmDeleteWithPin'));
    if (!pin) return;
    try {
      await api.delete(`/api/profiles/${id}`, { data: { pin } });
      fetchProfiles();
    } catch (err) {
      console.error(err);
      setProfiles(profiles.filter(p => p._id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] pt-24 px-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t('parent.dashboard')}</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            {t('parent.addChild')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {profiles.map((profile) => (
            <motion.div
              key={profile._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm relative group hover:bg-white/10 transition-colors"
            >
              <button
                onClick={() => handleDelete(profile._id)}
                className="absolute top-4 right-4 rtl:left-4 rtl:right-auto p-2 bg-red-500/20 text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 bg-gradient-to-b from-blue-900/50 to-purple-900/50">
                  <img src={profile.avatar === 'custom' ? (localStorage.getItem(`pgkids_custom_avatar_${profile._id}`) || '/characters/Bader.png') : profile.avatar} alt={profile.name} className={`w-full h-full object-cover ${profile.avatar === 'custom' ? 'object-center' : 'object-top scale-110 origin-top'}`} />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white mb-0.5">{profile.name}</h2>
                  <p className="text-sm text-gray-400">{t('parent.age')}: {profile.age}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1f2e] border border-white/10 p-8 rounded-3xl w-full max-w-2xl relative"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 rtl:left-6 rtl:right-auto text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-3xl font-bold text-white mb-8">{t('parent.addChild')}</h2>

              <form onSubmit={handleAddChild} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input
                    type="text"
                    placeholder={t('auth.name')}
                    required
                    value={newProfile.name}
                    onChange={e => setNewProfile({...newProfile, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder={t('parent.age')}
                    required
                    min="1"
                    max="18"
                    value={newProfile.age}
                    onChange={e => setNewProfile({...newProfile, age: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
 
                {/* Custom photo upload */}
                <div className="flex flex-col sm:flex-row gap-6 items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-blue-500/50 bg-slate-800 shrink-0">
                    <img
                      src={newProfile.avatar === 'custom' && customAvatarPreview ? customAvatarPreview : newProfile.avatar}
                      alt="Preview"
                      className={`w-full h-full object-cover ${newProfile.avatar === 'custom' ? 'object-center' : 'object-top scale-110 origin-top'}`}
                    />
                  </div>
                  <div className="flex-1 space-y-2 text-left rtl:text-right">
                    <span className="text-sm font-semibold text-white block">{t('parent.customAvatar', 'تحميل صورة للطفل')}</span>
                    <label className="stream-button inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs px-4 py-2 cursor-pointer border border-slate-700">
                      <Upload className="w-4 h-4" />
                      {t('profile.uploadPhoto', 'رفع صورة خاصة')}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCustomAvatarUpload}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-4">{t('parent.avatar')}</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 max-h-60 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                    {avatars.map(avatar => (
                      <button
                        type="button"
                        key={avatar}
                        onClick={() => {
                          setNewProfile({...newProfile, avatar});
                          setCustomAvatarPreview(null);
                        }}
                        className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all ${newProfile.avatar === avatar ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/20' : 'border-transparent hover:border-white/20 bg-white/5'}`}
                      >
                        <img src={avatar} alt={t('parent.avatarOptionAlt')} className="w-full h-full object-cover object-top scale-110 origin-top" />
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t('parent.addChild')}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParentDashboard;

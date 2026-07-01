import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, LogOut, Compass, Home, Users, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChild } from '../context/ChildContext';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface Profile {
  _id: string;
  name: string;
  age: number;
  avatar: string;
  favoritedWorlds: string[];
}

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { activeChild, setActiveChild } = useChild();
  const navigate = useNavigate();
  const location = useLocation();

    const [profiles, setProfiles] = useState<Profile[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleClose = () => setMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  useEffect(() => {
    if (user && user.role === 'parent') {
      api.get('/api/profiles')
        .then(({ data }) => {
          const mapped = (data.data || []).map((p: any) => ({
            _id: p.id || p._id,
            name: p.name,
            age: p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : p.age,
            avatar: p.avatar,
            favoritedWorlds: p.favorited_worlds || []
          }));
          setProfiles(mapped);
        })
        .catch((err) => {
          console.error('Failed to load profiles in header', err);
        });
    }
  }, [user, activeChild]);

  const toggleLanguage = () => {
    const currentLang = i18n.language || 'ar';
    const newLang = currentLang.startsWith('ar') ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header dir="ltr" className="fixed top-0 w-full z-50 bg-slate-950/70 backdrop-blur-md border-b border-slate-700/60 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-[0_8px_30px_rgba(2,6,23,0.45)]">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="stream-pill px-3 py-1 shrink-0 cursor-pointer"
          aria-label="Go to home"
        >
          <img 
            src="/logo-pg.png" 
            alt="PG Kids Logo" 
            className="h-10 w-auto animate-float object-contain hover:scale-105 transition-transform duration-300"
          />
        </button>

        {user && user.role === 'parent' && (
          <div className="relative group shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className={`stream-button inline-flex items-center gap-2 px-2.5 py-1 text-xs border ${
                location.pathname === '/profile' || location.pathname === '/profiles' || location.pathname === '/parent'
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-900/70 text-slate-100 border-slate-600 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              {user.name}
            </button>
            
            {/* Dropdown list */}
            <div className={`absolute left-0 mt-1 w-52 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
              menuOpen ? 'block' : 'hidden group-hover:block'
            }`}>
              {/* Select Child Profile */}
              <div className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider text-left">
                {t('header.childrenList', 'اختر حساب الطفل')}
              </div>
              <div className="space-y-1 mt-1">
                {profiles.map((profile) => (
                  <button
                    key={profile._id}
                    onClick={() => {
                      setActiveChild(profile);
                      navigate('/home');
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left font-bold ${
                      activeChild?._id === profile._id 
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-slate-900 shrink-0">
                      <img 
                        src={profile.avatar === 'custom' ? (localStorage.getItem(`pgkids_custom_avatar_${profile._id}`) || '/characters/Bader.png') : profile.avatar} 
                        alt={profile.name} 
                        className={`w-full h-full object-cover ${profile.avatar === 'custom' ? 'object-center' : 'object-top scale-110 origin-top'}`} 
                      />
                    </div>
                    <span className="text-xs truncate">{profile.name}</span>
                  </button>
                ))}
                
                <div className="border-t border-slate-800 my-1"></div>
                
                {/* Settings Options */}
                <div className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider text-left">
                  {t('header.settingsSection', 'الإعدادات')}
                </div>
                
                <button
                  onClick={() => navigate('/profile')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left font-bold text-xs ${
                    location.pathname === '/profile' ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{t('header.settingsAndProfile', 'إعدادات الملف الشخصي')}</span>
                </button>
                
                <button
                  onClick={() => navigate('/parent')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left font-bold text-xs ${
                    location.pathname === '/parent' ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>{t('header.parentDashboard', 'لوحة تحكم الأبوين')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {user && (
          <nav className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {/* Home link */}
            {(user.role === 'parent' || user.role === 'child') && (
              <button
                onClick={() => navigate('/home')}
                className={`stream-button inline-flex items-center gap-2 px-2.5 py-1 text-xs border ${
                  location.pathname === '/home'
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-slate-900/70 text-slate-100 border-slate-600 hover:border-slate-300'
                }`}
              >
                <Home className="w-4 h-4" />
                {t('header.home')}
              </button>
            )}

            {/* Worlds link */}
            {(user.role === 'parent' || user.role === 'child' || user.role === 'admin') && (
              <button
                onClick={() => navigate('/world/1')}
                className={`stream-button inline-flex items-center gap-2 px-2.5 py-1 text-xs border ${
                  location.pathname.startsWith('/world')
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-slate-900/70 text-slate-100 border-slate-600 hover:border-slate-300'
                }`}
              >
                <Compass className="w-4 h-4" />
                {t('header.worlds')}
              </button>
            )}

            {/* Admin link */}
            {user.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className={`stream-button inline-flex items-center gap-2 px-2.5 py-1 text-xs border ${
                  location.pathname === '/admin'
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-slate-900/70 text-slate-100 border-slate-600 hover:border-slate-300'
                }`}
              >
                <Shield className="w-4 h-4" />
                {t('header.admin')}
              </button>
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={toggleLanguage}
          className="stream-button flex items-center gap-2 px-3.5 py-1.5 text-sm bg-gradient-to-r from-sky-500 to-orange-500 hover:from-sky-400 hover:to-orange-400 transition-all text-white font-semibold"
        >
          <Globe className="w-5 h-5" />
          {t('header.toggleLang')}
        </button>
        {!user ? (
          <button
            onClick={() => navigate('/auth')}
            className="stream-button flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-sky-600 hover:from-orange-400 hover:to-sky-500 text-white font-bold text-xs shadow-lg transition-all"
          >
            {t('auth.login', 'تسجيل الدخول')}
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="stream-button flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-orange-300 transition-all border-slate-600"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;

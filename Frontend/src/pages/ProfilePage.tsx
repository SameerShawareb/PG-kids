import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChild } from '../context/ChildContext';
import api from '../api/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Unlock, Upload, Star, Check, AlertCircle, Save, Globe } from 'lucide-react';

const ALL_WORLDS = [
  { id: '1', name: 'Bader', avatar: '/characters/Bader.png', color: '#3B82F6' },
  { id: '2', name: 'Lulwa', avatar: '/characters/Lulwa.png', color: '#EC4899' },
  { id: '3', name: 'Tantal', avatar: '/characters/Tantal.png', color: '#10B981' },
  { id: '4', name: 'Sultan', avatar: '/characters/The Shark Sultan.png', color: '#F59E0B' },
  { id: '5', name: 'Budour', avatar: '/characters/Budour.png', color: '#8B5CF6' },
  { id: '6', name: 'Naya', avatar: '/characters/Naya.png', color: '#06B6D4' },
  { id: '7', name: 'Labib', avatar: '/characters/Labib.png', color: '#F43F5E' },
];

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

const ProfilePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { activeChild, setActiveChild } = useChild();
  const navigate = useNavigate();

  // Authentication & Locking
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Setup PIN state
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [setupPinError, setSetupPinError] = useState<string | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);

  // Child Settings Form
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childAvatar, setChildAvatar] = useState(avatars[0]);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [favoritedWorlds, setFavoritedWorlds] = useState<string[]>([]);

  // Parent Settings Form
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [confirmPasswordForEmail, setConfirmPasswordForEmail] = useState('');
  const [showEmailPasswordInput, setShowEmailPasswordInput] = useState(false);

  // Password Change Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // PIN Change Form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinFields, setShowPinFields] = useState(false);

  // UI state
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeChild) {
      navigate('/profiles');
      return;
    }

    // Initialize forms
    setChildName(activeChild.name);
    setChildAge(String(activeChild.age));
    setChildAvatar(activeChild.avatar === 'custom' ? avatars[0] : activeChild.avatar);
    setFavoritedWorlds(activeChild.favoritedWorlds || []);

    const storedCustomAvatar = localStorage.getItem(`pgkids_custom_avatar_${activeChild._id}`);
    if (storedCustomAvatar) {
      setCustomAvatarPreview(storedCustomAvatar);
      setChildAvatar('custom');
    }

    if (user) {
      setParentName(user.name);
      setParentEmail(user.email);
    }
  }, [activeChild, user, navigate]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setPinError(null);
    try {
      const { data } = await api.post('/api/auth/parent-pin/verify', { pin: pinInput });
      if (data.data.verified) {
        setIsUnlocked(true);
        setPinInput('');
      } else {
        setPinError(t('profile.incorrectPin', 'رمز PIN غير صحيح. يرجى المحاولة مرة أخرى.'));
      }
    } catch (err) {
      console.error(err);
      setPinError(t('profile.incorrectPin', 'رمز PIN غير صحيح. يرجى المحاولة مرة أخرى.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingPin(true);
    setSetupPinError(null);

    if (setupPin !== setupConfirmPin) {
      setSetupPinError(t('profile.pinMismatch', 'رمزي PIN غير متطابقين.'));
      setIsSettingPin(false);
      return;
    }

    try {
      await api.put('/api/auth/parent-pin', {
        current_password: setupPassword,
        new_pin: setupPin,
        confirm_pin: setupConfirmPin,
      });

      // Reload page to bootstrap AuthContext and update the has_parent_pin status
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setSetupPinError(err.response?.data?.message || t('profile.setupPinError', 'فشل تفعيل رمز PIN. تأكد من صحة كلمة المرور وأن الرمز غير مكرر أو بديهي.'));
    } finally {
      setIsSettingPin(false);
    }
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (keep it small for localStorage, e.g., max 150KB)
    if (file.size > 200 * 1024) {
      alert(t('profile.avatarTooLarge', 'الصورة كبيرة جداً! يرجى اختيار صورة أقل من 200 كيلوبايت.'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCustomAvatarPreview(base64String);
      setChildAvatar('custom');
    };
    reader.readAsDataURL(file);
  };

  const toggleWorldFavorite = (worldId: string) => {
    if (favoritedWorlds.includes(worldId)) {
      setFavoritedWorlds(favoritedWorlds.filter((id) => id !== worldId));
    } else {
      setFavoritedWorlds([...favoritedWorlds, worldId]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // 1. Save custom avatar locally if selected
      if (childAvatar === 'custom' && customAvatarPreview) {
        localStorage.setItem(`pgkids_custom_avatar_${activeChild?._id}`, customAvatarPreview);
      } else {
        localStorage.removeItem(`pgkids_custom_avatar_${activeChild?._id}`);
      }

      // 2. Prepare payload and update child profile
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - Number(childAge));
      
      await api.put(`/api/profiles/${activeChild?._id}`, {
        name: childName,
        dob: dob.toISOString(),
        avatar: childAvatar,
        favorited_worlds: favoritedWorlds,
      });

      // Update child context
      const updatedChild = {
        _id: activeChild?._id || '',
        name: childName,
        age: Number(childAge),
        avatar: childAvatar,
        favoritedWorlds: favoritedWorlds,
      };
      setActiveChild(updatedChild);

      // 3. Update Parent Profile if modified
      if (user && (parentName !== user.name || parentEmail !== user.email)) {
        const parentPayload: any = { name: parentName };
        if (parentEmail !== user.email) {
          parentPayload.email = parentEmail;
          parentPayload.current_password = confirmPasswordForEmail;
        }

        await api.patch('/api/auth/me', parentPayload);
      }

      // 4. Update Password if requested
      if (showPasswordFields && currentPassword && newPassword) {
        await api.patch('/api/auth/change-password', {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordFields(false);
      }

      // 5. Update PIN if requested
      if (showPinFields && currentPin && newPin) {
        await api.put('/api/auth/parent-pin', {
          current_pin: currentPin,
          new_pin: newPin,
          confirm_pin: confirmPin,
        });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setShowPinFields(false);
      }

      setSaveStatus({ success: true, message: t('profile.saveSuccess', 'تم تحديث الملف الشخصي بنجاح!') });
      // Lock settings again after successful save
      setIsUnlocked(false);
      setShowEmailPasswordInput(false);
      setConfirmPasswordForEmail('');
    } catch (err: any) {
      console.error(err);
      setSaveStatus({
        success: false,
        message: err.response?.data?.message || t('profile.saveError', 'فشل تحديث الملف الشخصي. يرجى المحاولة مرة أخرى.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="stream-page min-h-screen bg-transparent pt-24 pb-20 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -left-10 w-56 h-56 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-72 h-72 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <div className="text-center mb-8">
          <div className="stream-pill w-max px-6 py-1.5 mx-auto mb-4">
            <h1 className="text-2xl md:text-3xl font-extrabold stream-title">
              {t('profile.title', 'الملف الشخصي والإعدادات')}
            </h1>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!isUnlocked ? (
            user && !user.has_parent_pin ? (
              // Setup PIN Screen
              <motion.div
                key="setup-pin-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto p-6 md:p-8 rounded-3xl stream-surface stream-card border border-white/10 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-yellow-500/20 border border-yellow-500/35 flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-6 h-6 text-yellow-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3">
                  {t('profile.setupPinTitle', 'إعداد رمز PIN للأبوين')}
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  {t('profile.setupPinDescription', 'يرجى إعداد رمز PIN (من 4 إلى 6 أرقام) لحماية إعدادات الرقابة الأبوية.')}
                </p>

                <form onSubmit={handleSetupPin} className="space-y-4 text-left">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold block">{t('profile.currentPassword', 'كلمة المرور الحالية للأبوين')}</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold block">{t('profile.newPin', 'رمز PIN الجديد')}</label>
                      <input
                        type="password"
                        required
                        maxLength={6}
                        placeholder="••••"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-bold tracking-wider text-slate-100"
                        value={setupPin}
                        onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold block">{t('profile.confirmPin', 'تأكيد رمز PIN')}</label>
                      <input
                        type="password"
                        required
                        maxLength={6}
                        placeholder="••••"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-bold tracking-wider text-slate-100"
                        value={setupConfirmPin}
                        onChange={(e) => setSetupConfirmPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  {setupPinError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mt-2 justify-center">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{setupPinError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSettingPin}
                    className="stream-button w-full bg-gradient-to-r from-orange-500 to-sky-600 hover:from-orange-400 hover:to-sky-500 text-white font-bold py-3 px-6 shadow-lg transition-all mt-2"
                  >
                    {isSettingPin ? t('admin.saving', 'جاري الحفظ...') : t('profile.setupPinButton', 'حفظ وتفعيل رمز PIN')}
                  </button>
                </form>
              </motion.div>
            ) : (
              // Enter PIN Screen
              <motion.div
                key="lock-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto p-6 md:p-8 rounded-3xl stream-surface stream-card border border-white/10 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/35 flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-3">
                  {t('profile.lockedMessage', 'الإعدادات مغلقة. يرجى إدخال رمز PIN للأبوين للتعديل.')}
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  {t('profile.enterPin', 'أدخل رمز PIN للأبوين لفتح الإعدادات')}
                </p>

                <form onSubmit={handleVerifyPin} className="space-y-4">
                  <input
                    type="password"
                    required
                    maxLength={6}
                    placeholder="••••"
                    className="w-full max-w-[160px] mx-auto bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-center tracking-widest text-2xl font-bold"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  />
                  
                  {pinError && (
                    <div className="flex items-center justify-center gap-2 text-red-400 text-sm mt-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="stream-button w-full bg-gradient-to-r from-orange-500 to-sky-600 hover:from-orange-400 hover:to-sky-500 text-white font-bold py-3 px-6 shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
                  >
                    {isVerifying ? t('admin.saving', 'جاري التحميل...') : t('profile.unlock', 'فتح الإعدادات')}
                  </button>
                </form>
              </motion.div>
            )
          ) : (
            <motion.form
              key="settings-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              onSubmit={handleSaveProfile}
              className="space-y-6"
            >
              {/* Unlocked Message Banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-400">
                  <Unlock className="w-5 h-5 shrink-0" />
                  <span className="font-bold text-sm">{t('profile.unlockedMessage', 'تم فتح الإعدادات بنجاح!')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUnlocked(false)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  {t('profile.lock', 'قفل الإعدادات')}
                </button>
              </div>

              {/* Child Profile Settings */}
              <div className="stream-card stream-surface p-6 rounded-3xl border border-white/10 space-y-6">
                <h2 className="text-xl font-black text-white border-b border-white/10 pb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-sky-400" />
                  {t('profile.childSection', 'إعدادات الطفل')}
                </h2>

                <div className="flex flex-col md:flex-row gap-8 items-center">
                  {/* Avatar upload/picker preview */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-sky-400 shadow-lg bg-slate-800">
                      <img
                        src={childAvatar === 'custom' && customAvatarPreview ? customAvatarPreview : childAvatar}
                        alt="Preview"
                        className={`w-full h-full object-cover ${childAvatar === 'custom' ? 'object-center' : 'object-top scale-110 origin-top'}`}
                      />
                    </div>
                    <label className="stream-button flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs px-4 py-2 cursor-pointer border border-slate-700">
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

                  {/* Child parameters */}
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold block">{t('profile.name', 'الاسم')}</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold block">{t('profile.age', 'العمر')}</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={18}
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Predefined Avatars List */}
                <div className="space-y-3">
                  <label className="text-xs text-slate-400 font-bold block">{t('profile.avatar', 'اختر صورة الشخصية الكرتونية')}</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                    {avatars.map((av) => (
                      <button
                        type="button"
                        key={av}
                        onClick={() => {
                          setChildAvatar(av);
                          setCustomAvatarPreview(null);
                        }}
                        className={`w-full aspect-square rounded-full overflow-hidden border-2 transition-all ${
                          childAvatar === av ? 'border-sky-400 scale-105 shadow-md shadow-sky-500/20' : 'border-transparent bg-slate-900 hover:border-slate-500'
                        }`}
                      >
                        <img src={av} alt="Avatar Option" className="w-full h-full object-cover object-top" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Favorited Worlds Selection */}
              <div className="stream-card stream-surface p-6 rounded-3xl border border-white/10 space-y-4">
                <h2 className="text-xl font-black text-white pb-2 border-b border-white/10 flex items-center gap-2">
                  <Star className="w-5 h-5 text-orange-400 fill-orange-400/20" />
                  {t('profile.favoritedWorlds', 'عواملي المفضلة')}
                </h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {ALL_WORLDS.map((world) => {
                    const isFav = favoritedWorlds.includes(world.id);
                    return (
                      <button
                        type="button"
                        key={world.id}
                        onClick={() => toggleWorldFavorite(world.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                          isFav ? 'bg-orange-500/10 border-orange-500 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0 bg-slate-800">
                          <img src={world.avatar} alt={world.name} className="w-full h-full object-cover object-top" />
                        </div>
                        <span className="font-bold text-sm leading-tight text-left rtl:text-right">{t(`characters.${world.name.toLowerCase()}`)}</span>
                        {isFav && <Check className="w-4 h-4 text-orange-400 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* General Settings */}
              <div className="stream-card stream-surface p-6 rounded-3xl border border-white/10 space-y-4">
                <h2 className="text-xl font-black text-white pb-2 border-b border-white/10 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  {t('profile.general', 'الإعدادات العامة')}
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-white block">{t('profile.language', 'لغة واجهة المستخدم')}</span>
                    <p className="text-xs text-slate-400">{t('profile.langDescription', 'اختر لغة العرض المفضلة للموقع')}</p>
                  </div>

                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
                    <button
                      type="button"
                      onClick={() => handleLanguageChange('ar')}
                      className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                        i18n.language.startsWith('ar') ? 'bg-gradient-to-r from-orange-500 to-sky-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      عربي
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLanguageChange('en')}
                      className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                        i18n.language.startsWith('en') ? 'bg-gradient-to-r from-orange-500 to-sky-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>

              {/* Parent & Account Settings */}
              <div className="stream-card stream-surface p-6 rounded-3xl border border-white/10 space-y-6">
                <h2 className="text-xl font-black text-white border-b border-white/10 pb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  {t('profile.parentSection', 'الرقابة الأبوية والحساب')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold block">{t('profile.parentName', 'اسم ولي الأمر')}</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold block">{t('profile.email', 'البريد الإلكتروني')}</label>
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                      value={parentEmail}
                      onChange={(e) => {
                        setParentEmail(e.target.value);
                        if (user && e.target.value !== user.email) {
                          setShowEmailPasswordInput(true);
                        } else {
                          setShowEmailPasswordInput(false);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Password confirmation for Email change */}
                {showEmailPasswordInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-2"
                  >
                    <span className="text-xs text-orange-300 font-bold">{t('profile.confirmPassForEmail', 'تأكيد كلمة المرور مطلوب لتغيير البريد الإلكتروني')}</span>
                    <input
                      type="password"
                      placeholder={t('profile.currentPassword', 'كلمة المرور الحالية')}
                      className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                      value={confirmPasswordForEmail}
                      onChange={(e) => setConfirmPasswordForEmail(e.target.value)}
                    />
                  </motion.div>
                )}

                {/* Change Password toggle & fields */}
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    className="text-sm font-bold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1"
                  >
                    {t('profile.changePassword', 'تغيير كلمة المرور')}
                  </button>

                  {showPasswordFields && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                    >
                      <input
                        type="password"
                        placeholder={t('profile.currentPassword', 'كلمة المرور الحالية')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder={t('profile.newPassword', 'كلمة المرور الجديدة')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <input
                        type="password"
                        placeholder={t('profile.confirmPassword', 'تأكيد كلمة المرور الجديدة')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </motion.div>
                  )}
                </div>

                {/* Change PIN toggle & fields */}
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowPinFields(!showPinFields)}
                    className="text-sm font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    {t('profile.changePin', 'تغيير رمز PIN للأبوين')}
                  </button>

                  {showPinFields && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                    >
                      <input
                        type="password"
                        maxLength={6}
                        placeholder={t('profile.currentPin', 'رمز PIN الحالي')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none text-center font-bold tracking-wider"
                        value={currentPin}
                        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      />
                      <input
                        type="password"
                        maxLength={6}
                        placeholder={t('profile.newPin', 'رمز PIN الجديد')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none text-center font-bold tracking-wider"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      />
                      <input
                        type="password"
                        maxLength={6}
                        placeholder={t('profile.confirmPin', 'تأكيد رمز PIN الجديد')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none text-center font-bold tracking-wider"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Status feedback & submit */}
              <AnimatePresence>
                {saveStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className={`p-4 rounded-2xl flex items-center gap-2.5 text-sm ${
                      saveStatus.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{saveStatus.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="stream-button flex-1 bg-gradient-to-r from-orange-500 to-sky-600 hover:from-orange-400 hover:to-sky-500 text-white font-bold py-3.5 px-6 shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {isSaving ? t('admin.saving', 'جاري الحفظ...') : t('profile.save', 'حفظ الإعدادات')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsUnlocked(false)}
                  className="stream-button bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3.5 font-bold"
                >
                  {t('profile.cancel', 'إلغاء')}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProfilePage;

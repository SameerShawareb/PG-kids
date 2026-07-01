import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Trash2, Upload, Pencil, BarChart3 } from 'lucide-react';
import { resolveContentTitle } from '../utils/contentTitles';

interface Content {
  id?: string;
  _id?: string;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  description?: string;
  type: string;
  age_group?: string;
  ageGroup?: string;
  world_id?: string;
  worldId?: string;
  world_section?: 'shorts' | 'series';
  worldSection?: 'shorts' | 'series';
  is_published?: boolean;
}

interface WorldOption {
  id: string;
  key?: string;
  label: string;
}

const DEFAULT_WORLDS = [
  { id: '1', key: 'bader' },
  { id: '2', key: 'lulwa' },
  { id: '3', key: 'tantal' },
  { id: '4', key: 'sultan' },
  { id: '5', key: 'budour' },
  { id: '6', key: 'naya' },
  { id: '7', key: 'labib' },
];

const AdminDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'worlds' | 'library' | 'statistics'>('worlds');
  const [contents, setContents] = useState<Content[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/auth');
      return;
    }
    fetchContents();
  }, [user, navigate]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    titleAr: '',
    titleEn: '',
    description: '',
    ageGroup: 'all',
    worldId: '',
    worldSection: 'shorts' as 'shorts' | 'series',
    isPublished: true,
  });
  const [uploadForm, setUploadForm] = useState({
    title: '',
    titleAr: '',
    titleEn: '',
    description: '',
    type: 'video',
    ageGroup: 'all',
    category: '',
    worldId: '',
    worldSection: 'shorts' as 'shorts' | 'series',
    file: null as File | null,
    thumbnail: null as File | null,
  });
  const [worldUploadForm, setWorldUploadForm] = useState({
    worldId: '',
    title: '',
    titleAr: '',
    titleEn: '',
    description: '',
    profileImage: null as File | null,
    backgroundImage: null as File | null,
  });

  const fetchContents = async () => {
    try {
      const { data } = await api.get('/api/admin/content');
      setContents(data.data);
    } catch (err) {
      console.error(err);
      // Fallback
      setContents([]);
    }
  };

  const getAssignedWorldId = (content: Content) => content.world_id || content.worldId || '';

  const knownWorlds = useMemo<WorldOption[]>(() => {
    const worldMap = new Map<string, WorldOption>();

    DEFAULT_WORLDS.forEach((world) => {
      worldMap.set(world.id, {
        id: world.id,
        key: world.key,
        label: t(`characters.${world.key}`),
      });
    });

    contents.forEach((content) => {
      const worldId = getAssignedWorldId(content);
      if (!worldId) return;

      const current = worldMap.get(worldId);
      const localizedTitle = resolveContentTitle(content, i18n.language) || content.title || '';

      if (content.type === 'world' && localizedTitle) {
        worldMap.set(worldId, {
          id: worldId,
          key: current?.key,
          label: localizedTitle,
        });
        return;
      }

      if (!current) {
        worldMap.set(worldId, {
          id: worldId,
          label: `${t('admin.world', 'العالم')} #${worldId}`,
        });
      }
    });

    return Array.from(worldMap.values()).sort((a, b) => {
      const aNum = Number(a.id);
      const bNum = Number(b.id);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return a.label.localeCompare(b.label, i18n.language === 'ar' ? 'ar' : 'en');
    });
  }, [contents, i18n.language, t]);

  const getWorldLabel = (worldId?: string | null) => {
    if (!worldId) return '-';
    return knownWorlds.find((world) => world.id === worldId)?.label || `${t('admin.world', 'العالم')} #${worldId}`;
  };

  const handleDeleteContent = async (content: Content) => {
    const contentId = content.id || content._id;
    if (!contentId) {
      alert(t('admin.invalidContentId'));
      return;
    }

    const confirmed = window.confirm(t('admin.confirmDelete'));
    if (!confirmed) return;

    try {
      setDeletingId(contentId);
      await api.delete(`/api/admin/content/${contentId}`);
      setContents(prev => prev.filter(item => (item.id || item._id) !== contentId));
      alert(t('admin.deleteSuccess'));
    } catch (err: any) {
      console.error('Delete failed', err);
      alert(err.response?.data?.message || t('admin.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteWorld = async (worldId: string) => {
    const confirmed = window.confirm(t('admin.confirmDeleteWorld', 'سيتم حذف كل فيديوهات هذا العالم نهائياً. هل أنت متأكد؟'));
    if (!confirmed) return;

    try {
      setDeletingWorldId(worldId);
      await api.delete(`/api/admin/content/world/${worldId}`);
      setContents((prev) => prev.filter((item) => getAssignedWorldId(item) !== worldId));
      alert(t('admin.deleteWorldSuccess', 'تم حذف كل محتوى العالم نهائياً'));
    } catch (err: any) {
      console.error('Delete world failed', err);
      alert(err.response?.data?.message || t('admin.deleteWorldFailed', 'فشل حذف محتوى العالم'));
    } finally {
      setDeletingWorldId(null);
    }
  };

  const handleOpenEditContent = (content: Content) => {
    const contentId = content.id || content._id;
    if (!contentId) return;

    setEditingContentId(contentId);
    setEditForm({
      title: content.title || '',
      titleAr: content.title_ar || '',
      titleEn: content.title_en || '',
      description: content.description || '',
      ageGroup: content.age_group || content.ageGroup || 'all',
      worldId: getAssignedWorldId(content),
      worldSection: content.world_section || content.worldSection || 'shorts',
      isPublished: content.is_published ?? true,
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitEditContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContentId) return;

    try {
      setIsSavingEdit(true);
      const payload = {
        title: editForm.title,
        title_ar: editForm.titleAr || null,
        title_en: editForm.titleEn || null,
        description: editForm.description,
        age_group: editForm.ageGroup,
        world_id: editForm.worldId || null,
        world_section: editForm.worldId ? editForm.worldSection : null,
        is_published: editForm.isPublished,
      };

      await api.put(`/api/admin/content/${editingContentId}`, payload);
      await fetchContents();

      setIsEditModalOpen(false);
      setEditingContentId(null);
      alert(t('admin.editSuccess', 'تم تعديل بيانات المحتوى بنجاح'));
    } catch (err: any) {
      console.error('Edit failed', err);
      alert(err.response?.data?.message || t('admin.editFailed', 'فشل تعديل بيانات المحتوى'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      alert(t('admin.selectFileFirst'));
      return;
    }

    const formData = new FormData();
    formData.append('title', uploadForm.title);
    formData.append('description', uploadForm.description);
    if (uploadForm.titleAr.trim()) formData.append('title_ar', uploadForm.titleAr.trim());
    if (uploadForm.titleEn.trim()) formData.append('title_en', uploadForm.titleEn.trim());
    formData.append('type', uploadForm.type);
    formData.append('age_group', uploadForm.ageGroup);
    formData.append('category', uploadForm.category);
    if (uploadForm.worldId) {
      formData.append('world_id', uploadForm.worldId);
      formData.append('world_section', uploadForm.worldSection);
    }
    formData.append('is_published', 'true');
    formData.append('file', uploadForm.file);
    if (uploadForm.thumbnail) {
      formData.append('thumbnail', uploadForm.thumbnail);
    }

    try {
      await api.post('/api/admin/content/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(t('admin.uploadSuccess'));
      setUploadForm({
        title: '',
        titleAr: '',
        titleEn: '',
        description: '',
        type: 'video',
        ageGroup: 'all',
        category: '',
        worldId: '',
        worldSection: 'shorts',
        file: null,
        thumbnail: null,
      });
      setIsUploadModalOpen(false);
      fetchContents();
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(err.response?.data?.message || t('admin.uploadFailed'));
    }
  };

  const handleWorldUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const worldId = worldUploadForm.worldId.trim();
    if (!worldId || !worldUploadForm.profileImage || !worldUploadForm.backgroundImage) {
      alert(t('admin.worldAssetsRequired', 'أدخل معرف العالم واختر صورة الشخصية وصورة الخلفية أولاً'));
      return;
    }

    const selectedWorld = knownWorlds.find((world) => world.id === worldId);
    const defaultWorldTitle = selectedWorld?.label || `${t('admin.world', 'العالم')} #${worldId}`;

    const formData = new FormData();
    formData.append('title', worldUploadForm.title.trim() || defaultWorldTitle);
    formData.append('description', worldUploadForm.description);
    if (worldUploadForm.titleAr.trim()) formData.append('title_ar', worldUploadForm.titleAr.trim());
    if (worldUploadForm.titleEn.trim()) formData.append('title_en', worldUploadForm.titleEn.trim());
    formData.append('type', 'world');
    formData.append('age_group', 'all');
    formData.append('category', 'world-assets');
    formData.append('world_id', worldId);
    formData.append('world_section', 'shorts');
    formData.append('is_published', 'true');
    formData.append('file', worldUploadForm.profileImage);
    formData.append('thumbnail', worldUploadForm.backgroundImage);

    try {
      await api.post('/api/admin/content/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(t('admin.uploadSuccess'));
      setWorldUploadForm({
        worldId: '',
        title: '',
        titleAr: '',
        titleEn: '',
        description: '',
        profileImage: null,
        backgroundImage: null,
      });
      setIsUploadModalOpen(false);
      fetchContents();
    } catch (err: any) {
      console.error('World upload failed', err);
      alert(err.response?.data?.message || t('admin.uploadFailed'));
    }
  };

  const filteredLibraryContents = contents.filter((c) => c.type !== 'world');
  const worldsSummary = knownWorlds.map((world) => {
    const videosCount = filteredLibraryContents.filter((item) => getAssignedWorldId(item) === world.id).length;
    return { ...world, videosCount };
  });
  const stats = {
    totalContent: filteredLibraryContents.length,
    totalVideos: filteredLibraryContents.filter((item) => item.type === 'video').length,
    totalAudio: filteredLibraryContents.filter((item) => item.type === 'audio').length,
    published: filteredLibraryContents.filter((item) => item.is_published).length,
    worldAssigned: filteredLibraryContents.filter((item) => Boolean(getAssignedWorldId(item))).length,
    worldsWithVideos: worldsSummary.filter((world) => world.videosCount > 0).length,
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] pt-24 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <h1 className="text-4xl font-bold text-white mb-8">{t('admin.dashboard')}</h1>

        <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
          <button
            onClick={() => setActiveTab('worlds')}
            className={`px-6 py-2 rounded-full font-semibold transition-all ${activeTab === 'worlds' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            {t('admin.worlds')}
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-6 py-2 rounded-full font-semibold transition-all ${activeTab === 'library' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            {t('admin.library')}
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-6 py-2 rounded-full font-semibold transition-all ${activeTab === 'statistics' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            {t('admin.statistics', 'Statistics')}
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white">
              {activeTab === 'worlds'
                ? t('admin.worlds')
                : activeTab === 'library'
                  ? t('admin.library')
                  : t('admin.statistics', 'Statistics')}
            </h2>
            {activeTab !== 'statistics' && (
              <div className="flex gap-4">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full font-medium transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {activeTab === 'worlds'
                    ? t('admin.uploadWorldAssets', 'رفع صور العالم')
                    : t('admin.upload')}
                </button>
              </div>
            )}
          </div>

          {activeTab === 'worlds' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="p-4">{t('admin.world')}</th>
                    <th className="p-4">{t('admin.videosCount', 'عدد الفيديوهات')}</th>
                    <th className="p-4 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {worldsSummary.map((world) => (
                    <tr key={world.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-gray-300">
                      <td className="p-4 font-semibold text-white">{world.label}</td>
                      <td className="p-4">{world.videosCount}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteWorld(world.id)}
                          disabled={deletingWorldId === world.id || world.videosCount === 0}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t('admin.deleteWorld', 'حذف العالم')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'library' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="p-4">{t('admin.title')}</th>
                    <th className="p-4">{t('admin.description')}</th>
                    <th className="p-4">{t('admin.type')}</th>
                    <th className="p-4">{t('admin.world')}</th>
                    <th className="p-4">{t('admin.ageGroup')}</th>
                    <th className="p-4 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLibraryContents.map((content) => {
                    return (
                      <tr key={content.id || content._id || `${content.title}-${content.type}`} className="border-b border-white/5 hover:bg-white/5 transition-colors text-gray-300">
                        <td className="p-4 font-semibold text-white">{resolveContentTitle(content, i18n.language) || content.title}</td>
                        <td className="p-4">{content.description || '-'}</td>
                        <td className="p-4 capitalize">{content.type}</td>
                        <td className="p-4">{getWorldLabel(getAssignedWorldId(content))}</td>
                        <td className="p-4">{content.age_group || content.ageGroup || '-'}</td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditContent(content)}
                              className="p-2 text-amber-300 hover:text-amber-200 hover:bg-amber-400/10 rounded-full transition-colors"
                              title={t('admin.edit', 'تعديل')}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteContent(content)}
                              disabled={deletingId === (content.id || content._id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t('admin.delete')}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLibraryContents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        {t('admin.noContentFound')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-[#10192d] p-5">
                <div className="text-sm text-slate-400">{t('admin.totalContent', 'Total Content')}</div>
                <div className="text-3xl font-black text-white mt-2">{stats.totalContent}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#10192d] p-5">
                <div className="text-sm text-slate-400">{t('admin.totalVideos', 'Total Videos')}</div>
                <div className="text-3xl font-black text-white mt-2">{stats.totalVideos}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#10192d] p-5">
                <div className="text-sm text-slate-400">{t('admin.totalAudio', 'Total Audio')}</div>
                <div className="text-3xl font-black text-white mt-2">{stats.totalAudio}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#10192d] p-5">
                <div className="text-sm text-slate-400">{t('admin.publishedContent', 'Published Content')}</div>
                <div className="text-3xl font-black text-white mt-2">{stats.published}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#10192d] p-5">
                <div className="text-sm text-slate-400">{t('admin.assignedToWorlds', 'Assigned to Worlds')}</div>
                <div className="text-3xl font-black text-white mt-2">{stats.worldAssigned}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#10192d] p-5">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <BarChart3 className="w-4 h-4" />
                  {t('admin.worldsWithVideos', 'Worlds with Videos')}
                </div>
                <div className="text-3xl font-black text-white mt-2">{stats.worldsWithVideos}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] border border-white/10 p-8 rounded-3xl w-full max-w-md relative">
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              x
            </button>
            <h2 className="text-2xl font-bold text-white mb-6">
              {activeTab === 'worlds' ? t('admin.uploadWorldAssets', 'رفع صور العالم') : t('admin.upload')}
            </h2>

            {activeTab === 'worlds' ? (
              <form onSubmit={handleWorldUploadSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    list="admin-known-world-ids"
                    placeholder={t('admin.worldIdPlaceholder', 'معرف العالم (مثال: ocean-1)')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={worldUploadForm.worldId}
                    onChange={(e) => setWorldUploadForm({ ...worldUploadForm, worldId: e.target.value })}
                  />
                  <datalist id="admin-known-world-ids">
                    {knownWorlds.map((world) => (
                      <option key={world.id} value={world.id} />
                    ))}
                  </datalist>
                  <p className="text-xs text-slate-400 mt-2">
                    {t('admin.worldIdHint', 'يمكنك إدخال معرف جديد لإضافة عالم جديد، أو استخدام معرف موجود لتحديث صوره.')}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder={t('admin.title')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={worldUploadForm.title}
                  onChange={(e) => setWorldUploadForm({ ...worldUploadForm, title: e.target.value })}
                />

                <textarea
                  placeholder={t('admin.description')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={worldUploadForm.description}
                  onChange={(e) => setWorldUploadForm({ ...worldUploadForm, description: e.target.value })}
                />

                <label className="block text-sm text-slate-300">
                  {t('admin.worldProfileImage', 'صورة الشخصية')}
                  <input
                    type="file"
                    required
                    accept="image/*"
                    className="w-full text-gray-400 mt-2"
                    onChange={(e) => setWorldUploadForm({ ...worldUploadForm, profileImage: e.target.files?.[0] || null })}
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  {t('admin.worldBackgroundImage', 'صورة خلفية العالم')}
                  <input
                    type="file"
                    required
                    accept="image/*"
                    className="w-full text-gray-400 mt-2"
                    onChange={(e) => setWorldUploadForm({ ...worldUploadForm, backgroundImage: e.target.files?.[0] || null })}
                  />
                </label>

                <button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  {t('admin.upload')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder={t('admin.title')}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadForm.title}
                  onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Arabic title (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadForm.titleAr}
                  onChange={e => setUploadForm({ ...uploadForm, titleAr: e.target.value })}
                />

                <input
                  type="text"
                  placeholder="English title (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadForm.titleEn}
                  onChange={e => setUploadForm({ ...uploadForm, titleEn: e.target.value })}
                />

                <textarea
                  placeholder={t('admin.description')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadForm.description}
                  onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                />

                <div className="flex gap-4">
                  <select
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uploadForm.type}
                    onChange={e => setUploadForm({ ...uploadForm, type: e.target.value })}
                  >
                    <option value="video">{t('admin.video')}</option>
                    <option value="audio">{t('admin.audio')}</option>
                  </select>

                  <select
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uploadForm.ageGroup}
                    onChange={e => setUploadForm({ ...uploadForm, ageGroup: e.target.value })}
                  >
                    <option value="all">{t('admin.allAges')}</option>
                    <option value="2-5">2-5</option>
                    <option value="3-5">3-5</option>
                    <option value="6-8">6-8</option>
                    <option value="9-12">9-12</option>
                  </select>
                </div>

                <input
                  type="text"
                  placeholder={t('admin.categoryPlaceholder')}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadForm.category}
                  onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                />

                <select
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadForm.worldId}
                  onChange={e => setUploadForm({ ...uploadForm, worldId: e.target.value })}
                >
                  <option value="">{t('admin.noWorldHome', 'بدون عالم (يعرض في Home)')}</option>
                  {knownWorlds.map((world) => (
                    <option key={world.id} value={world.id}>{world.label}</option>
                  ))}
                </select>

                {uploadForm.worldId && (
                  <select
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uploadForm.worldSection}
                    onChange={e => setUploadForm({ ...uploadForm, worldSection: e.target.value as 'shorts' | 'series' })}
                  >
                    <option value="shorts">{t('world.shortFilms')}</option>
                    <option value="series">{t('world.series')}</option>
                  </select>
                )}

                <label className="block text-sm text-slate-300">
                  {t('admin.file', 'الملف')}
                  <input
                    type="file"
                    required
                    accept={uploadForm.type === 'audio' ? 'audio/*' : 'video/*'}
                    className="w-full text-gray-400 mt-2"
                    onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  />
                </label>

                {uploadForm.type === 'video' && (
                  <label className="block text-sm text-slate-300">
                    {t('admin.videoThumbnail', 'صورة الفيديو')}
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-gray-400 mt-2"
                      onChange={e => setUploadForm({ ...uploadForm, thumbnail: e.target.files?.[0] || null })}
                    />
                  </label>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  {t('admin.upload')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] border border-white/10 p-8 rounded-3xl w-full max-w-lg relative">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingContentId(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              x
            </button>

            <h2 className="text-2xl font-bold text-white mb-6">{t('admin.editContent', 'تعديل بيانات الفيديو')}</h2>

            <form onSubmit={handleSubmitEditContent} className="space-y-4">
              <input
                type="text"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t('admin.title')}
              />

              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                value={editForm.titleAr}
                onChange={(e) => setEditForm((prev) => ({ ...prev, titleAr: e.target.value }))}
                placeholder={t('admin.titleAr', 'العنوان بالعربي (اختياري)')}
              />

              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                value={editForm.titleEn}
                onChange={(e) => setEditForm((prev) => ({ ...prev, titleEn: e.target.value }))}
                placeholder={t('admin.titleEn', 'العنوان بالإنجليزي (اختياري)')}
              />

              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('admin.description')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={editForm.ageGroup}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, ageGroup: e.target.value }))}
                >
                  <option value="all">{t('admin.allAges')}</option>
                  <option value="2-5">2-5</option>
                  <option value="3-5">3-5</option>
                  <option value="6-8">6-8</option>
                  <option value="9-12">9-12</option>
                </select>

                <select
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={editForm.worldId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, worldId: e.target.value }))}
                >
                  <option value="">{t('admin.noWorldHome', 'بدون عالم (يعرض في Home)')}</option>
                  {knownWorlds.map((world) => (
                    <option key={world.id} value={world.id}>{world.label}</option>
                  ))}
                </select>
              </div>

              {editForm.worldId && (
                <select
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-4 py-3 text-white"
                  value={editForm.worldSection}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, worldSection: e.target.value as 'shorts' | 'series' }))}
                >
                  <option value="shorts">{t('world.shortFilms')}</option>
                  <option value="series">{t('world.series')}</option>
                </select>
              )}

              <label className="flex items-center gap-2 text-slate-200 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.isPublished}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
                />
                {t('admin.isPublished', 'منشور')}
              </label>

              <button
                type="submit"
                disabled={isSavingEdit}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                {isSavingEdit ? t('admin.saving', 'جاري الحفظ...') : t('admin.saveChanges', 'حفظ التعديلات')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

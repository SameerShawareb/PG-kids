export interface LocalizableContentTitle {
  title?: string;
  title_ar?: string | null;
  title_en?: string | null;
}

export const resolveContentTitle = (item: LocalizableContentTitle, language?: string) => {
  const normalizedLanguage = String(language || '').toLowerCase();
  const isArabic = normalizedLanguage.startsWith('ar');

  if (isArabic) return item.title_ar || item.title || '';
  return item.title_en || item.title || '';
};

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import arTranslations from './locales/ar.json';

const LANGUAGE_STORAGE_KEY = 'pgkids_lang';

const getInitialLanguage = () => {
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === 'ar' || savedLanguage === 'en') return savedLanguage;

  const browserLanguage = navigator.language?.toLowerCase();
  return browserLanguage?.startsWith('ar') ? 'ar' : 'en';
};

const applyDocumentLanguage = (lang: string) => {
  document.documentElement.dir = lang.startsWith('ar') ? 'rtl' : 'ltr';
  document.documentElement.lang = lang.startsWith('ar') ? 'ar' : 'en';
};

const initialLanguage = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      ar: { translation: arTranslations },
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

applyDocumentLanguage(initialLanguage);

i18n.on('languageChanged', (lang) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang.startsWith('ar') ? 'ar' : 'en');
  applyDocumentLanguage(lang);
});

export default i18n;

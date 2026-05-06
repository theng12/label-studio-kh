import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../locales/en.json';
import km from '../../locales/km.json';
import th from '../../locales/th.json';
import ko from '../../locales/ko.json';
import zh from '../../locales/zh.json';
import ja from '../../locales/ja.json';

const STORAGE_KEY = 'lskh.lang';

const resources = {
  en: { translation: en },
  km: { translation: km },
  th: { translation: th },
  ko: { translation: ko },
  zh: { translation: zh },
  ja: { translation: ja },
};

const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'en';

void i18n.use(initReactI18next).init({
  resources,
  lng: stored,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: string): void {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'km', label: 'ខ្មែរ (Khmer)' },
  { code: 'th', label: 'ไทย (Thai)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'zh', label: '中文 (Chinese)' },
  { code: 'ja', label: '日本語 (Japanese)' },
] as const;

export default i18n;

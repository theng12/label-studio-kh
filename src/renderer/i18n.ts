import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../locales/en.json';
import km from '../../locales/km.json';

// Supported UI languages. Trimmed to English + Khmer in 0.5.2 — the
// other four (th / ko / zh / ja) were stubs that hadn't been kept in
// sync with new strings. Easy to re-add later if real translations
// come back: import the JSON, add an entry to `resources` + a row to
// SUPPORTED_LANGUAGES, and ship.
const STORAGE_KEY = 'lskh.lang';

const resources = {
  en: { translation: en },
  km: { translation: km },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'km', label: 'ខ្មែរ (Khmer)' },
] as const;

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code) as readonly string[];

// Coerce the persisted language to a still-supported one. An existing
// user who had picked Thai before the trim shouldn't see broken UI on
// next launch — quietly fall back to English.
const stored =
  (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'en';
const initialLng = SUPPORTED_CODES.includes(stored) ? stored : 'en';

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Persist the coerced value so the localStorage stays in a valid state.
if (stored !== initialLng && typeof localStorage !== 'undefined') {
  localStorage.setItem(STORAGE_KEY, initialLng);
}

export function setLanguage(lang: string): void {
  const next = SUPPORTED_CODES.includes(lang) ? lang : 'en';
  localStorage.setItem(STORAGE_KEY, next);
  void i18n.changeLanguage(next);
}

export default i18n;

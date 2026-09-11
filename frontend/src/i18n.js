import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import the comprehensive dictionaries we just created
import enTranslation from './locales/en.json';
import hiTranslation from './locales/hi.json';
import mrTranslation from './locales/mr.json';
import teTranslation from './locales/te.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        // Map the imported JSON files to their language codes
        resources: {
            en: enTranslation,
            hi: hiTranslation,
            mr: mrTranslation,
            te: teTranslation
        },
        fallbackLng: 'en',

        // Language detection configuration
        detection: {
            // Check localStorage first, then fallback to browser language
            order: ['localStorage', 'navigator'],

            // Automatically cache the user's selected language to localStorage
            caches: ['localStorage'],
        },

        interpolation: {
            escapeValue: false // React already escapes values to prevent XSS
        }
    });

export default i18n;
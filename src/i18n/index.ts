import initI18n from './config';

// Initialize i18n when the module is imported
if (typeof window !== 'undefined') {
  initI18n();
}

export { default as initI18n } from './config';

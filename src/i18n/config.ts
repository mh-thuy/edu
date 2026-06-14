import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonEn from '@/../public/locales/en/common.json';
import commonVi from '@/../public/locales/vi/common.json';
import authEn from '@/../public/locales/en/auth.json';
import authVi from '@/../public/locales/vi/auth.json';
import validationEn from '@/../public/locales/en/validation.json';
import validationVi from '@/../public/locales/vi/validation.json';
import dashboardEn from '@/../public/locales/en/dashboard.json';
import dashboardVi from '@/../public/locales/vi/dashboard.json';
import roomEn from '@/../public/locales/en/room.json';
import roomVi from '@/../public/locales/vi/room.json';
import teacherEn from '@/../public/locales/en/teacher.json';
import teacherVi from '@/../public/locales/vi/teacher.json';
import studentEn from '@/../public/locales/en/student.json';
import studentVi from '@/../public/locales/vi/student.json';
import classEn from '@/../public/locales/en/class.json';
import classVi from '@/../public/locales/vi/class.json';
import scheduleEn from '@/../public/locales/en/schedule.json';
import scheduleVi from '@/../public/locales/vi/schedule.json';
import financeEn from '@/../public/locales/en/finance.json';
import financeVi from '@/../public/locales/vi/finance.json';

const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    validation: validationEn,
    dashboard: dashboardEn,
    room: roomEn,
    teacher: teacherEn,
    student: studentEn,
    class: classEn,
    schedule: scheduleEn,
    finance: financeEn,
  },
  vi: {
    common: commonVi,
    auth: authVi,
    validation: validationVi,
    dashboard: dashboardVi,
    room: roomVi,
    teacher: teacherVi,
    student: studentVi,
    class: classVi,
    schedule: scheduleVi,
    finance: financeVi,
  },
};

const initI18n = () => {
  if (i18next.isInitialized) return;

  i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      },
    });
};

export default initI18n;

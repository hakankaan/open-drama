import type { ContentLanguage } from '@open-drama/contracts';

/** UI locales are the content languages (adr-0011): one setting switches both. English is canonical. */
export const LOCALES = ['en', 'zh', 'ja', 'ko'] as const satisfies readonly ContentLanguage[];
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'open-drama-locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
};

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

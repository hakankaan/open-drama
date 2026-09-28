import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import en from '../../messages/en.json';
import { DEFAULT_LOCALE, isLocale } from './locales';

type Messages = { [key: string]: string | Messages };

function merge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = typeof value === 'object' && typeof current === 'object' ? merge(current, value) : value;
  }
  return out;
}

/** Locale from the cookie; missing keys of a variant fall back to English. */
export default getRequestConfig(async () => {
  const raw = (await cookies()).get('open-drama-locale')?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  let messages: Messages = en;
  if (locale !== 'en') {
    try {
      const variant = ((await import(`../../messages/${locale}.json`)) as { default: Messages }).default;
      messages = merge(en, variant);
    } catch {
      // No catalog for this locale yet: English everywhere.
    }
  }
  return { locale, messages };
});

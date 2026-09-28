import { inArray } from 'drizzle-orm';
import {
  ContentLanguage,
  DEFAULT_CONTENT_LANGUAGE,
  type AppSettingsView,
  type UpdateAppSettings,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import { appSettings } from '../../db/schema';

const KEYS = ['contentLanguage', 'toursSeen'] as const;

/** AppSettingsView. An unset or invalid language reads as the default (AppSettings invariant). */
export function getAppSettings(): AppSettingsView {
  const rows = db.select().from(appSettings).where(inArray(appSettings.key, [...KEYS])).all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const language = ContentLanguage.safeParse(map.get('contentLanguage'));
  let toursSeen: string[] = [];
  try {
    const parsed: unknown = JSON.parse(map.get('toursSeen') ?? '[]');
    if (Array.isArray(parsed)) toursSeen = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // Corrupt value reads as none seen.
  }
  return { contentLanguage: language.success ? language.data : DEFAULT_CONTENT_LANGUAGE, toursSeen };
}

const put = (key: (typeof KEYS)[number], value: string) =>
  db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date().toISOString() } })
    .run();

/** SetContentLanguage and RecordToursSeen (tours are only ever added). */
export function updateAppSettings(input: UpdateAppSettings): AppSettingsView {
  const current = getAppSettings();
  if (input.contentLanguage) put('contentLanguage', input.contentLanguage);
  if (input.toursSeen?.length) {
    const merged = [...new Set([...current.toursSeen, ...input.toursSeen])];
    put('toursSeen', JSON.stringify(merged));
  }
  return getAppSettings();
}

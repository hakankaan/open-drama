'use client';

import { useTranslations } from 'next-intl';
import type { DramaDetail } from '@open-drama/contracts';

/**
 * How many of the episodes before `before` (all of them when absent) have a ready recap, so missing ones are named
 * before an agent that reads them runs (adr-0014). Nothing for anthologies or when there is no earlier episode.
 */
export function EarlierRecaps({ drama, before }: { drama: DramaDetail; before?: number }) {
  const t = useTranslations('studio.script.recap');
  const earlier = drama.episodes.filter((e) => before === undefined || e.episodeNumber < before);
  if (!drama.serial || earlier.length === 0) return null;
  const ready = earlier.filter((e) => e.hasRecap && !e.recapStale).length;
  const stale = earlier.filter((e) => e.hasRecap && e.recapStale).length;
  const missing = earlier.length - ready - stale;
  return (
    <p className="max-w-lg text-sm text-muted">
      {ready === earlier.length ? t('allReady', { n: earlier.length }) : t('earlier', { ready, n: earlier.length, stale, missing })}
    </p>
  );
}

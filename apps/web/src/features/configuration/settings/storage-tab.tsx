'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { useStorageUsage } from '../../media/api';

const formatBytes = (bytes: number, locale: string) => {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value);
};

export function StorageTab() {
  const t = useTranslations('settings.storage');
  const locale = useLocale();
  const { data } = useStorageUsage();
  if (!data) return <Skeleton className="h-64" />;

  const buckets = [...data.usageByBucket].sort((a, b) => b.bytes - a.bytes);
  const max = Math.max(1, ...buckets.map((b) => b.bytes));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface p-5" aria-labelledby="data-dir">
        <div className="flex items-center gap-2">
          <h2 id="data-dir" className="text-base font-semibold">
            {t('dataDir')}
          </h2>
          <Tag>{t(`mode.${data.mode}`)}</Tag>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">{t('root')}</dt>
          <dd className="font-mono text-[13px] break-all">{data.dataDir}</dd>
          <dt className="text-muted">{t('database')}</dt>
          <dd className="font-mono text-[13px] break-all">{data.databasePath}</dd>
          <dt className="text-muted">{t('media')}</dt>
          <dd className="font-mono text-[13px] break-all">{data.storageRoot}</dd>
          <dt className="text-muted">{t('workspace')}</dt>
          <dd className="font-mono text-[13px] break-all">{data.workspaceDir}</dd>
        </dl>
        <p className="mt-4 text-[13px] text-ink-2">{t('backupNote')}</p>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5" aria-labelledby="usage">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="usage" className="text-base font-semibold">
            {t('usage')}
          </h2>
          {data.stale ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('counting')}
            </span>
          ) : null}
          <span className="ml-auto flex gap-4 text-sm text-ink-2">
            <span>{t('total', { size: formatBytes(data.totalBytes, locale) })}</span>
            {data.freeBytes !== null ? <span>{t('free', { size: formatBytes(data.freeBytes, locale) })}</span> : null}
          </span>
        </div>
        {buckets.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{data.stale ? t('counting') : t('empty')}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {buckets.map((b) => (
              <li key={b.bucket} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
                <span className="text-ink-2">{t(`bucket.${b.bucket}`)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-ink-2" style={{ width: `${(b.bytes / max) * 100}%` }} />
                </span>
                <span className="text-right text-[13px] text-muted tabular-nums">
                  {formatBytes(b.bytes, locale)}
                  <span className="ml-2">{t('files', { count: b.files })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

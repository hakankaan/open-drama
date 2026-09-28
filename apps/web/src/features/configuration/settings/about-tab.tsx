'use client';

import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/brand-mark';
import { useHealth } from '../api';

export function AboutTab() {
  const t = useTranslations('settings.about');
  const health = useHealth();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5">
        <BrandMark className="h-12 w-12" />
        <div>
          <p className="font-display text-3xl leading-none font-bold tracking-wide">Open Drama</p>
          <p className="mt-1 text-sm text-muted">
            {health.data ? t('version', { version: health.data.version }) : t('versionUnknown')}
          </p>
        </div>
      </section>
      <section className="rounded-lg border border-warning/40 bg-warning-soft p-5" aria-labelledby="exposure">
        <h2 id="exposure" className="flex items-center gap-2 text-base font-semibold">
          <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
          {t('exposureTitle')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink">{t('exposureBody')}</p>
      </section>
      <section className="flex flex-col gap-2 text-sm">
        <a className="text-accent-soft-ink hover:underline" href="https://github.com/hakankaan/open-drama" target="_blank" rel="noreferrer">
          {t('source')}
        </a>
        <a
          className="text-accent-soft-ink hover:underline"
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          {t('licence')}
        </a>
      </section>
    </div>
  );
}

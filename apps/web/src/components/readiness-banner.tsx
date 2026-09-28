'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useReadiness } from '@/features/configuration/api';

/** Site-wide banner from ConfigurationReadiness; re-checked on every route change. */
export function ReadinessBanner() {
  const t = useTranslations('readiness');
  const types = useTranslations('serviceType');
  const pathname = usePathname();
  const { data, refetch } = useReadiness();

  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);

  if (!data || data.ready) return null;
  const missing = data.missingTypes.map((type) => types(type)).join(', ');
  return (
    <div role="status" className="border-b border-warning/30 bg-warning-soft">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:px-6">
        <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <p className="text-ink">{t('missing', { types: missing, count: data.missingTypes.length })}</p>
        <Link
          href="/settings?tab=ai"
          className="font-medium text-accent-soft-ink underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
        >
          {t('action')}
        </Link>
      </div>
    </div>
  );
}

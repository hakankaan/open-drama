'use client';

import { Check, ChevronDown, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { CatalogPrice, ServiceType } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useModelRunnerCatalog } from '../api';

/**
 * Browses ModelRunner's live catalog for the endpoints this service type can use, with their prices; picking one adds
 * it to the model list. The catalog is loaded only once the panel is opened.
 */
export function ModelCatalog({
  serviceType,
  models,
  onAdd,
}: {
  serviceType: ServiceType;
  models: string[];
  onAdd: (model: string) => void;
}) {
  const t = useTranslations('settings.ai.dialog.catalog');
  const format = useFormatter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const catalog = useModelRunnerCatalog(serviceType, open);

  const usd = (n: number) => format.number(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 3 });
  const price = (p: CatalogPrice) => {
    switch (p.unit) {
      case 'tokens':
        return t('perMillionTokens', { input: usd(p.input), output: usd(p.output) });
      case 'image':
        return t('perImage', { amount: usd(p.amount) });
      case 'second':
        return p.min === p.max
          ? t('perSecond', { amount: usd(p.min) })
          : t('perSecondRange', { min: usd(p.min), max: usd(p.max) });
    }
  };

  const needle = query.trim().toLowerCase();
  const shown = (catalog.data ?? []).filter(
    (m) => !needle || m.id.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle),
  );

  return (
    <div className="rounded-md border border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-ink-2 hover:text-ink"
      >
        {t('toggle')}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-2 border-t border-line p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-9"
          />
          {catalog.isPending ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : catalog.isError ? (
            <p className="flex items-center justify-between gap-2 text-[13px] text-danger">
              {t('error')}
              <Button size="sm" variant="ghost" onClick={() => void catalog.refetch()}>
                {t('retry')}
              </Button>
            </p>
          ) : shown.length === 0 ? (
            <p className="text-[13px] text-muted">{t('empty')}</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {shown.map((m) => {
                const added = models.includes(m.id);
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink" title={m.description || undefined}>
                        {m.name}
                      </p>
                      <p className="truncate font-mono text-xs text-muted">{m.id}</p>
                    </div>
                    {m.price ? <span className="shrink-0 text-xs text-ink-2 tabular-nums">{price(m.price)}</span> : null}
                    <Button
                      size="sm"
                      variant={added ? 'ghost' : 'secondary'}
                      disabled={added}
                      onClick={() => onAdd(m.id)}
                      aria-label={added ? t('addedModel', { model: m.id }) : t('addModel', { model: m.id })}
                    >
                      {added ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                      {added ? t('added') : t('add')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted">{t('hint')}</p>
        </div>
      ) : null}
    </div>
  );
}

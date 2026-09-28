'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

const ORDER = ['light', 'dark', 'system'] as const;
const noop = () => () => {};

/** Cycles light → dark → system. The theme is persisted by next-themes. */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const current = (mounted ? theme : 'system') as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
  const Icon = current === 'light' ? Sun : current === 'dark' ? Moon : Monitor;
  return (
    <Tooltip content={t('switchTo', { theme: t(next) })}>
      <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={t('current', { theme: t(current) })}>
        <Icon className="h-[18px] w-[18px]" />
      </Button>
    </Tooltip>
  );
}

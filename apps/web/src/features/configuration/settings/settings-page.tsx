'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { AgentsTab } from '../../agents/agents-tab';
import { AboutTab } from './about-tab';
import { AiTab } from './ai-tab';
import { GeneralTab } from './general-tab';
import { StorageTab } from './storage-tab';
import { StylesTab } from './styles-tab';

const TABS = { ai: AiTab, general: GeneralTab, styles: StylesTab, agents: AgentsTab, storage: StorageTab, about: AboutTab } as const;
type TabKey = keyof typeof TABS;

export function SettingsPage() {
  const t = useTranslations('settings');
  const params = useSearchParams();
  const requested = params.get('tab');
  const tab: TabKey = requested && requested in TABS ? (requested as TabKey) : 'ai';
  const Tab = TABS[tab];
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-5xl leading-none font-bold tracking-wide">{t('title')}</h1>
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <nav aria-label={t('title')} className="flex gap-1 overflow-x-auto md:flex-col">
          {(Object.keys(TABS) as TabKey[]).map((key) => (
            <Link
              key={key}
              href={`/settings?tab=${key}`}
              aria-current={tab === key ? 'page' : undefined}
              data-tour={`settings-tab-${key}`}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === key ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {t(`tabs.${key}`)}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          <Tab />
        </div>
      </div>
    </div>
  );
}

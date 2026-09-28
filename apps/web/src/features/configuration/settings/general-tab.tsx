'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { useLanguageSwitch } from '@/components/language-dialog';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/locales';
import { cn } from '@/lib/cn';

const noop = () => () => {};

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
        active ? 'border-accent bg-accent-soft text-accent-soft-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
      )}
    >
      {children}
    </button>
  );
}

export function GeneralTab() {
  const t = useTranslations('settings.general');
  const tt = useTranslations('theme');
  const locale = useLocale() as Locale;
  const { request, dialog } = useLanguageSwitch();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const current = mounted ? theme : undefined;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="content-language">
        <div>
          <h2 id="content-language" className="text-base font-semibold">
            {t('language')}
          </h2>
          <p className="text-sm text-ink-2">{t('languageBody')}</p>
        </div>
        <div className="grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
          {LOCALES.map((l) => (
            <Choice key={l} active={l === locale} onClick={() => request(l)}>
              {LOCALE_LABELS[l]}
            </Choice>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="appearance">
        <div>
          <h2 id="appearance" className="text-base font-semibold">
            {t('appearance')}
          </h2>
          <p className="text-sm text-ink-2">{t('appearanceBody')}</p>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-2">
          <Choice active={current === 'light'} onClick={() => setTheme('light')}>
            <Sun className="h-4 w-4" aria-hidden /> {tt('lightLabel')}
          </Choice>
          <Choice active={current === 'dark'} onClick={() => setTheme('dark')}>
            <Moon className="h-4 w-4" aria-hidden /> {tt('darkLabel')}
          </Choice>
          <Choice active={current === 'system'} onClick={() => setTheme('system')}>
            <Monitor className="h-4 w-4" aria-hidden /> {tt('systemLabel')}
          </Choice>
        </div>
      </section>
      {dialog}
    </div>
  );
}

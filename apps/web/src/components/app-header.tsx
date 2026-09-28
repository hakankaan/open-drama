'use client';

import { GithubIcon } from './github-icon';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { BrandMark } from './brand-mark';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/', key: 'projects', match: (p: string) => p === '/' || p.startsWith('/drama') },
  { href: '/settings', key: 'settings', match: (p: string) => p.startsWith('/settings') },
] as const;

export function AppHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Open Drama">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-[22px] leading-none font-bold tracking-wide">Open Drama</span>
        </Link>
        <nav className="ml-2 flex items-center gap-1 rounded-full border border-line bg-surface p-1" aria-label={t('label')}>
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                data-tour={`nav-${item.key}`}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink',
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a
            href="https://github.com/hakankaan/open-drama"
            target="_blank"
            rel="noreferrer"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:inline-flex"
            aria-label={t('github')}
          >
            <GithubIcon className="h-[18px] w-[18px]" />
          </a>
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}

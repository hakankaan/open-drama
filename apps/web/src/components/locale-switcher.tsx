'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/locales';
import { useLanguageSwitch } from './language-dialog';

export function LocaleSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale() as Locale;
  const { request, dialog } = useLanguageSwitch();
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t('menu')}>
            <Languages className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
          </Button>
        </MenuTrigger>
        <MenuContent keepFocus>
          {LOCALES.map((l) => (
            <MenuItem key={l} checked={l === locale} onSelect={() => request(l)}>
              {LOCALE_LABELS[l]}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {dialog}
    </>
  );
}

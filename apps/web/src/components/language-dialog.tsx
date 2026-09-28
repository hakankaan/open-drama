'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUpdateAppSettings } from '@/features/configuration/api';
import { LOCALE_COOKIE, LOCALE_LABELS, type Locale } from '@/i18n/locales';
import { useToastError } from '@/lib/errors';

/**
 * One switch for the UI language and the AI content language (adr-0011). Confirming saves the content
 * language, then the UI locale; Cancel leaves both unchanged.
 */
export function useLanguageSwitch() {
  const t = useTranslations('language');
  const current = useLocale() as Locale;
  const router = useRouter();
  const toastError = useToastError();
  const update = useUpdateAppSettings();
  const [pending, setPending] = useState<Locale | null>(null);

  const confirm = async () => {
    if (!pending) return;
    try {
      await update.mutateAsync({ contentLanguage: pending });
    } catch (err) {
      toastError(err);
      return;
    }
    document.cookie = `${LOCALE_COOKIE}=${pending}; path=/; max-age=31536000; samesite=lax`;
    try {
      window.localStorage.setItem('open-drama:locale', JSON.stringify(pending));
    } catch {
      // Cookie alone is enough.
    }
    setPending(null);
    router.refresh();
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={t('confirmTitle', { language: pending ? LOCALE_LABELS[pending] : '' })}
      description={t('confirmBody')}
      confirmLabel={t('confirm')}
      onConfirm={confirm}
      pending={update.isPending}
      danger={false}
    />
  );

  return {
    request: (locale: Locale) => {
      if (locale !== current) setPending(locale);
    },
    dialog,
  };
}

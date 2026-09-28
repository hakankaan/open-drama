'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { ApiError } from './api';

/**
 * Maps an error to a readable toast: network, validation and precondition messages come from the server;
 * task failures use their errorClass (moderation gets the "switch model" hint).
 */
export function useToastError() {
  const t = useTranslations('errors');
  return useCallback(
    (err: unknown, fallback?: string) => {
      if (!(err instanceof ApiError)) {
        toast.error(fallback ?? t('unknown'));
        return;
      }
      if (err.code === 'NETWORK') return toast.error(t('network'));
      switch (err.errorClass) {
        case 'moderation':
          return toast.error(t('moderation'), { description: err.message });
        case 'auth':
          return toast.error(t('auth'), { description: err.message });
        case 'quota':
          return toast.error(t('quota'), { description: err.message });
        case 'timeout':
          return toast.error(t('timeout'), { description: err.message });
        case 'provider':
        case 'config':
          return toast.error(t('provider'), { description: err.message });
      }
      if (err.code === 'INTERNAL') return toast.error(fallback ?? t('unknown'));
      return toast.error(err.message);
    },
    [t],
  );
}

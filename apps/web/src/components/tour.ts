'use client';

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import { useAppSettings, useUpdateAppSettings } from '@/features/configuration/api';

export interface TourStep {
  /** `data-tour` attribute of the element to highlight; omit for a centred step. */
  target?: string;
  title: string;
  description: string;
}

/**
 * An onboarding tour that runs once: seen tours are stored in app settings (RecordToursSeen), so they stay seen
 * across browsers and reinstalls of the web app. Returns a function that replays it.
 */
export function useTour(id: string, steps: TourStep[], ready: boolean) {
  const t = useTranslations('tour');
  const { data: settings } = useAppSettings();
  const { mutate: recordSeen } = useUpdateAppSettings();
  const started = useRef(false);

  const start = useCallback(() => {
    const driveSteps: DriveStep[] = steps.map((s) => ({
      element: s.target ? `[data-tour="${s.target}"]` : undefined,
      popover: { title: s.title, description: s.description },
    }));
    const tour = driver({
      steps: driveSteps,
      showProgress: true,
      progressText: t('progress', { current: '{{current}}', total: '{{total}}' }),
      nextBtnText: t('next'),
      prevBtnText: t('back'),
      doneBtnText: t('done'),
      popoverClass: 'od-tour',
      onDestroyed: () => recordSeen({ toursSeen: [id] }),
    });
    tour.drive();
  }, [id, steps, t, recordSeen]);

  useEffect(() => {
    if (!ready || !settings || started.current || settings.toursSeen.includes(id)) return;
    started.current = true;
    start();
  }, [ready, settings, id, start]);

  return start;
}

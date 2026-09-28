import type { DramaStatus } from '@open-drama/contracts';

export const STATUS_TONE: Record<DramaStatus, 'neutral' | 'info' | 'success'> = {
  draft: 'neutral',
  active: 'info',
  completed: 'success',
};

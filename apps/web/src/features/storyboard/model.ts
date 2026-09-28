import type { ShotCard } from '@open-drama/contracts';

export type ShotState = 'generating' | 'failed' | 'done' | 'pending';

/**
 * Shot video state (Plan 3 §4.6), only from latestVideoTask and videoPath: generating wins, so a regeneration shows
 * on a shot that already has a video; failed only when there is no video to fall back on.
 */
export function shotStateOf(shot: Pick<ShotCard, 'videoPath' | 'latestVideoTask'>): ShotState {
  const task = shot.latestVideoTask;
  if (task?.status === 'processing') return 'generating';
  if (task?.status === 'failed' && !shot.videoPath) return 'failed';
  if (shot.videoPath) return 'done';
  return 'pending';
}

export const shotTitle = (shot: Pick<ShotCard, 'title' | 'description' | 'shotNumber'>, fallback: string) =>
  shot.title.trim() || shot.description.replace(/\[Shot \d+\]/g, ' ').trim().split('\n')[0]?.slice(0, 80) || fallback;

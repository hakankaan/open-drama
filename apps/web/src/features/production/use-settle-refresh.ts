'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useEpisodeAssets } from '../assets/api';
import { productionKeys, useEpisodeJobs } from './api';

/**
 * When a job or an image task of the episode settles, the data it changed (script, assets, stage rail) is
 * refetched once. Polling itself stays limited to the lists that carry the running state.
 */
export function useSettleRefresh(episodeId: number, dramaId: number) {
  const qc = useQueryClient();
  const jobs = useEpisodeJobs(episodeId);
  const assets = useEpisodeAssets(episodeId);
  // Last seen state per job kind and per running image task; null until the first data arrives.
  const previous = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!jobs.data || !assets.data) return;
    const current = new Map<string, string>();
    const j = jobs.data;
    const jobList = [
      ['rewrite', j.rewrite],
      ['breakdown', j.breakdown],
      ['videoPromptBatch', j.videoPromptBatch],
      ...Object.entries(j.extraction).map(([target, job]) => [`extraction:${target}`, job] as const),
    ] as const;
    for (const [key, job] of jobList) if (job) current.set(key, `${job.id}:${job.status}`);
    for (const card of [...assets.data.characters, ...assets.data.scenes, ...assets.data.props]) {
      const task = card.latestImageTask;
      if (task) current.set(`image:${task.id}`, task.status);
    }
    const before = previous.current;
    previous.current = current;
    if (before === null) return;
    // A job or task that is new or changed and is no longer running has settled (even one too fast to be seen running).
    const settled = [...current.entries()].some(
      ([key, state]) => before.get(key) !== state && !state.endsWith('running') && state !== 'processing',
    );
    if (!settled) return;
    void qc.invalidateQueries({ queryKey: productionKeys.episode(episodeId) });
    void qc.invalidateQueries({ queryKey: productionKeys.pipeline(episodeId) });
    void qc.invalidateQueries({ queryKey: productionKeys.drama(dramaId) });
    void qc.invalidateQueries({ queryKey: ['assets'] });
  }, [jobs.data, assets.data, qc, episodeId, dramaId]);
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Film, MergeStarted, type MergeShots } from '@open-drama/contracts';
import { ApiError, request } from '@/lib/api';
import { generationKeys } from '../generation/api';

export const compositingKeys = {
  films: (episodeId: number) => ['compositing', 'films', episodeId] as const,
};

/** EpisodeFilms, newest first; polled every 3 s while a merge renders (Plan 3 §4.7). */
export const useEpisodeFilms = (episodeId: number) =>
  useQuery({
    queryKey: compositingKeys.films(episodeId),
    queryFn: () => request(z.array(Film), 'GET', `/episodes/${episodeId}/films`),
    refetchInterval: (query) => (query.state.data?.some((f) => f.status === 'processing') ? 3000 : false),
  });

/** MergeShots. A 409 means a merge is already rendering: the list is refetched so its polling picks it up. */
export function useMergeShots(episodeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MergeShots) => request(MergeStarted, 'POST', `/episodes/${episodeId}/merge`, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: compositingKeys.films(episodeId) });
      void qc.invalidateQueries({ queryKey: generationKeys.episodeTasks(episodeId) });
    },
  });
}

export const isMergeRunning = (err: unknown) => err instanceof ApiError && err.code === 'CONFLICT';


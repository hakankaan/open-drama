'use client';

import { useQuery } from '@tanstack/react-query';
import { EpisodeGenerationTasks, VideoProviderCaps, videoCapsFor } from '@open-drama/contracts';
import { qs, request } from '@/lib/api';

export const generationKeys = {
  episodeTasks: (episodeId: number) => ['generation', 'episode-tasks', episodeId] as const,
  videoCaps: (provider: string | null, model: string | null) => ['generation', 'video-caps', provider, model] as const,
};

/**
 * What a video model accepts, as the API reads it from the provider (adr-0013 amendment 5). The caps table answers
 * until then, and when the API cannot: a model it refuses is explained when a video is requested.
 */
export function useVideoCaps(provider: string | null, model: string | null): VideoProviderCaps {
  const query = useQuery({
    queryKey: generationKeys.videoCaps(provider, model),
    queryFn: () => request(VideoProviderCaps, 'GET', '/video-models/caps' + qs({ provider, model })),
    enabled: Boolean(provider),
    staleTime: 10 * 60_000,
    retry: false,
  });
  return query.data ?? videoCapsFor(provider, model);
}

const activeCount = (d: EpisodeGenerationTasks | undefined) =>
  d ? d.tasks.filter((t) => t.status === 'processing').length + d.films.filter((f) => f.status === 'processing').length : 0;

/**
 * EpisodeGenerationTasks for the task drawer and its badge: refreshed every 4 s while anything is active, and on
 * opening the drawer (the stages start work without telling the drawer).
 */
export function useEpisodeTasks(episodeId: number) {
  const query = useQuery({
    queryKey: generationKeys.episodeTasks(episodeId),
    queryFn: () => request(EpisodeGenerationTasks, 'GET', `/episodes/${episodeId}/generation-tasks`),
    refetchInterval: (q) => (activeCount(q.state.data) > 0 ? 4000 : false),
  });
  return { ...query, active: activeCount(query.data) };
}

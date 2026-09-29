'use client';

import { useQuery } from '@tanstack/react-query';
import { EpisodeGenerationTasks } from '@open-drama/contracts';
import { request } from '@/lib/api';

export const generationKeys = {
  episodeTasks: (episodeId: number) => ['generation', 'episode-tasks', episodeId] as const,
};

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

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Drama,
  DramaDetail,
  DramaListResponse,
  DramaStats,
  EpisodePipelineStatus,
  EpisodeJobs,
  EpisodeView,
  JobStarted,
  type CreateDrama,
  type CreateEpisode,
  type TextModelOverride,
  type UpdateDrama,
  type UpdateEpisode,
} from '@open-drama/contracts';
import { request } from '@/lib/api';

export const productionKeys = {
  dramas: ['production', 'dramas'] as const,
  stats: ['production', 'stats'] as const,
  drama: (id: number) => ['production', 'drama', id] as const,
  episode: (id: number) => ['production', 'episode', id] as const,
  pipeline: (id: number) => ['production', 'pipeline', id] as const,
  jobs: (id: number) => ['production', 'jobs', id] as const,
};



export const useDramaList = () =>
  useQuery({ queryKey: productionKeys.dramas, queryFn: () => request(DramaListResponse, 'GET', '/dramas?pageSize=200') });

export const useDramaStats = () =>
  useQuery({ queryKey: productionKeys.stats, queryFn: () => request(DramaStats, 'GET', '/dramas/stats') });

export const useDramaDetail = (id: number) =>
  useQuery({ queryKey: productionKeys.drama(id), queryFn: () => request(DramaDetail, 'GET', `/dramas/${id}`) });

function useInvalidateDramas() {
  const qc = useQueryClient();
  return (id?: number) => {
    void qc.invalidateQueries({ queryKey: productionKeys.dramas });
    void qc.invalidateQueries({ queryKey: productionKeys.stats });
    if (id !== undefined) void qc.invalidateQueries({ queryKey: productionKeys.drama(id) });
  };
}

export function useCreateDrama() {
  const invalidate = useInvalidateDramas();
  return useMutation({
    mutationFn: (body: CreateDrama) => request(Drama, 'POST', '/dramas', body),
    onSettled: () => invalidate(),
  });
}

/** Optimistic on the launcher list (the status menu), rolled back on error. */
export function useUpdateDrama() {
  const qc = useQueryClient();
  const invalidate = useInvalidateDramas();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateDrama & { id: number }) => request(Drama, 'PATCH', `/dramas/${id}`, body),
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: productionKeys.dramas });
      const previous = qc.getQueryData<DramaListResponse>(productionKeys.dramas);
      if (previous) {
        qc.setQueryData<DramaListResponse>(productionKeys.dramas, {
          ...previous,
          items: previous.items.map((d) => (d.id === id ? { ...d, ...body } : d)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => ctx?.previous && qc.setQueryData(productionKeys.dramas, ctx.previous),
    onSettled: (_data, _err, vars) => invalidate(vars.id),
  });
}

export function useDeleteDrama() {
  const invalidate = useInvalidateDramas();
  return useMutation({
    mutationFn: (id: number) => request(z.object({ id: z.number() }), 'DELETE', `/dramas/${id}`),
    onSettled: () => invalidate(),
  });
}

// Episodes

export const useEpisode = (id: number | undefined) =>
  useQuery({
    queryKey: productionKeys.episode(id ?? 0),
    queryFn: () => request(EpisodeView, 'GET', `/episodes/${id}`),
    enabled: id !== undefined,
  });

export const usePipelineStatus = (id: number | undefined) =>
  useQuery({
    queryKey: productionKeys.pipeline(id ?? 0),
    queryFn: () => request(EpisodePipelineStatus, 'GET', `/episodes/${id}/pipeline-status`),
    enabled: id !== undefined,
  });

function useEpisodeMutation<TVars>(fn: (vars: TVars) => Promise<{ id: number; dramaId: number }>) {
  const qc = useQueryClient();
  const invalidate = useInvalidateDramas();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if ('services' in data) qc.setQueryData(productionKeys.episode(data.id), data);
      void qc.invalidateQueries({ queryKey: productionKeys.pipeline(data.id) });
      invalidate(data.dramaId);
    },
  });
}

export const useCreateEpisode = () => useEpisodeMutation((body: CreateEpisode) => request(EpisodeView, 'POST', '/episodes', body));

export const useUpdateEpisode = () =>
  useEpisodeMutation(({ id, ...body }: UpdateEpisode & { id: number }) =>
    request(EpisodeView, 'PATCH', `/episodes/${id}`, body),
  );

export const useSkipRewrite = () =>
  useEpisodeMutation((id: number) => request(EpisodeView, 'POST', `/episodes/${id}/skip-rewrite`));

export function useDeleteEpisode(dramaId: number) {
  const invalidate = useInvalidateDramas();
  return useMutation({
    mutationFn: (id: number) => request(z.object({ id: z.number() }), 'DELETE', `/episodes/${id}`),
    onSettled: () => invalidate(dramaId),
  });
}

// Jobs (EpisodeJobs): polled every 2.5 s while anything runs (Plan 3 §4.7).

const anyRunning = (jobs: EpisodeJobs | undefined) =>
  !!jobs &&
  [jobs.rewrite, jobs.breakdown, jobs.videoPromptBatch, ...Object.values(jobs.extraction)].some((j) => j?.status === 'running');

export const useEpisodeJobs = (id: number | undefined) =>
  useQuery({
    queryKey: productionKeys.jobs(id ?? 0),
    queryFn: () => request(EpisodeJobs, 'GET', `/episodes/${id}/jobs`),
    enabled: id !== undefined,
    refetchInterval: (query) => (anyRunning(query.state.data) ? 2500 : false),
  });

/** Starting a job (or finding one already running) invalidates the jobs query so polling starts at once. */
export function useStartRewrite(episodeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TextModelOverride) => request(JobStarted, 'POST', `/episodes/${episodeId}/rewrite`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.jobs(episodeId) }),
  });
}

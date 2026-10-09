'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import {
  AgentJob,
  Drama,
  DramaDetail,
  DramaJobs,
  DramaListResponse,
  DramaStats,
  EpisodePipelineStatus,
  EpisodeJobs,
  EpisodeView,
  JobStarted,
  type CreateDrama,
  type CreateEpisode,
  type PlanEpisodes,
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
  dramaJobs: (id: number) => ['production', 'dramaJobs', id] as const,
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

/** The skip may start the episode's recap job, so the jobs query is invalidated like a job start. */
export function useSkipRewrite() {
  const qc = useQueryClient();
  const invalidate = useInvalidateDramas();
  return useMutation({
    mutationFn: (id: number) => request(EpisodeView, 'POST', `/episodes/${id}/skip-rewrite`),
    onSuccess: (data) => {
      qc.setQueryData(productionKeys.episode(data.id), data);
      void qc.invalidateQueries({ queryKey: productionKeys.pipeline(data.id) });
      invalidate(data.dramaId);
    },
    onSettled: (_data, _err, id) => void qc.invalidateQueries({ queryKey: productionKeys.jobs(id) }),
  });
}

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
  [jobs.rewrite, jobs.write, jobs.breakdown, jobs.videoPromptBatch, jobs.recap, ...Object.values(jobs.extraction)].some(
    (j) => j?.status === 'running',
  );

export const useEpisodeJobs = (id: number | undefined) =>
  useQuery({
    queryKey: productionKeys.jobs(id ?? 0),
    queryFn: () => request(EpisodeJobs, 'GET', `/episodes/${id}/jobs`),
    enabled: id !== undefined,
    refetchInterval: (query) => (anyRunning(query.state.data) ? 2500 : false),
  });

/**
 * DramaJobs (adr-0015): the outline and plan jobs, polled while either runs. The drama detail is refetched when a job
 * settles or a plan batch lands (its progress.written grows), so the outline and the new episodes show up.
 */
export function useDramaJobs(id: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: productionKeys.dramaJobs(id),
    queryFn: () => request(DramaJobs, 'GET', `/dramas/${id}/jobs`),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && [d.outline, d.plan].some((j) => j?.status === 'running') ? 2500 : false;
    },
  });
  const d = query.data;
  const written = d?.plan && Array.isArray(d.plan.progress.written) ? d.plan.progress.written.length : 0;
  const state = d ? `${d.outline?.id}:${d.outline?.status}|${d.plan?.id}:${d.plan?.status}:${written}` : null;
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (state === null || !d) return;
    const before = previous.current;
    previous.current = state;
    if (before === null) {
      // The first snapshot: a job that settled after the detail was fetched (a fast one, finished before the jobs
      // request answered) has changed what the detail shows, so it is refetched once.
      const fetched = qc.getQueryState(productionKeys.drama(id))?.dataUpdatedAt ?? 0;
      const settledSince = [d.outline, d.plan].some((j) => j?.finishedAt !== null && j?.finishedAt !== undefined && Date.parse(j.finishedAt) > fetched);
      if (settledSince) void qc.invalidateQueries({ queryKey: productionKeys.drama(id) });
      return;
    }
    if (before !== state) void qc.invalidateQueries({ queryKey: productionKeys.drama(id) });
  }, [state, d, qc, id]);
  return query;
}

/** The story writer (adr-0015); a duplicate start returns the running job. */
export function useStartOutline(dramaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TextModelOverride) => request(JobStarted, 'POST', `/dramas/${dramaId}/outline`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.dramaJobs(dramaId) }),
  });
}

/** The episode planner (adr-0015): adds the requested episodes batch by batch. */
export function useStartPlan(dramaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlanEpisodes) => request(JobStarted, 'POST', `/dramas/${dramaId}/plan`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.dramaJobs(dramaId) }),
  });
}

/** Starting a job (or finding one already running) invalidates the jobs query so polling starts at once. */
export function useStartRewrite(episodeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TextModelOverride) => request(JobStarted, 'POST', `/episodes/${episodeId}/rewrite`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.jobs(episodeId) }),
  });
}

/** The episode writer expanding the beat sheet into the script (adr-0015). */
export function useStartWrite(episodeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TextModelOverride) => request(JobStarted, 'POST', `/episodes/${episodeId}/write`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.jobs(episodeId) }),
  });
}

export function useStartRecap(episodeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TextModelOverride) => request(JobStarted, 'POST', `/episodes/${episodeId}/recap`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.jobs(episodeId) }),
  });
}

/**
 * CancelJob: answers with the job as it is (usually still running); it settles as cancelled a moment later, which the
 * polled jobs query of its episode or drama shows.
 */
export function useCancelJob(owner: { episodeId: number } | { dramaId: number }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => request(AgentJob, 'POST', `/agent-jobs/${jobId}/cancel`),
    onSettled: () =>
      void qc.invalidateQueries({
        queryKey: 'episodeId' in owner ? productionKeys.jobs(owner.episodeId) : productionKeys.dramaJobs(owner.dramaId),
      }),
  });
}

import { z } from 'zod';
import { ExtractionTarget, JobKind, JobStatus, Timestamp } from './common';

/** One agent job (rewrite, extraction per target, breakdown, video-prompt batch), adr-0008. */
export const AgentJob = z.object({
  id: z.number().int(),
  kind: JobKind,
  episodeId: z.number().int(),
  target: z.string(),
  status: JobStatus,
  progress: z.record(z.string(), z.unknown()),
  error: z.string().nullable(),
  startedAt: Timestamp,
  finishedAt: Timestamp.nullable(),
});
export type AgentJob = z.infer<typeof AgentJob>;

/** Response of every job-starting endpoint; a duplicate start returns the running job. */
export const JobStarted = z.object({
  jobId: z.number().int(),
  alreadyRunning: z.boolean(),
});
export type JobStarted = z.infer<typeof JobStarted>;

/** EpisodeJobs: the latest job per kind (and per target for extraction). */
export const EpisodeJobs = z.object({
  episodeId: z.number().int(),
  rewrite: AgentJob.nullable(),
  extraction: z.record(ExtractionTarget, AgentJob.nullable()),
  breakdown: AgentJob.nullable(),
  videoPromptBatch: AgentJob.nullable(),
});
export type EpisodeJobs = z.infer<typeof EpisodeJobs>;

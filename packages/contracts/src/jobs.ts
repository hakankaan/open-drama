import { z } from 'zod';
import { ExtractionTarget, JobKind, JobStatus, Timestamp } from './common';

/** Which aggregate a job kind belongs to (adr-0015): a drama-scoped job carries no episode. */
export type JobScope = 'drama' | 'episode';
export const JOB_SCOPE: Record<JobKind, JobScope> = {
  rewrite: 'episode',
  extraction: 'episode',
  breakdown: 'episode',
  videoPromptBatch: 'episode',
  recap: 'episode',
  write: 'episode',
  outline: 'drama',
  plan: 'drama',
};

/** One agent job (rewrite, extraction per target, breakdown, video-prompt batch, recap, episode write), adr-0008. */
export const AgentJob = z.object({
  id: z.number().int(),
  kind: JobKind,
  /** Null for a drama-scoped job (outline, plan). */
  episodeId: z.number().int().nullable(),
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
  /** The episode writer expanding the beat sheet into the script (adr-0015); never beside a rewrite. */
  write: AgentJob.nullable(),
  extraction: z.record(ExtractionTarget, AgentJob.nullable()),
  breakdown: AgentJob.nullable(),
  videoPromptBatch: AgentJob.nullable(),
  /** The latest recap job of the episode, whichever script revision it was keyed by (adr-0014). */
  recap: AgentJob.nullable(),
});
export type EpisodeJobs = z.infer<typeof EpisodeJobs>;

/** DramaJobs: the latest drama-scoped job per kind (adr-0015). */
export const DramaJobs = z.object({
  dramaId: z.number().int(),
  outline: AgentJob.nullable(),
  /** Its progress carries the request and the ids of the episodes added so far. */
  plan: AgentJob.nullable(),
});
export type DramaJobs = z.infer<typeof DramaJobs>;

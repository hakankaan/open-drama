import { and, desc, eq, isNull } from 'drizzle-orm';
import { JOB_SCOPE, type AgentJob, type DramaJobs, type EpisodeJobs, type JobKind, type JobStarted } from '@open-drama/contracts';
import { db } from '../../db/client';
import { agentJobs } from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { logger } from '../../http/logger';
import { scrubSecrets } from '../../lib/secrets';

type Row = typeof agentJobs.$inferSelect;

export const toAgentJob = ({ dramaId: _dramaId, ...row }: Row): AgentJob => row;

export interface JobKey {
  kind: JobKind;
  dramaId: number;
  /** Null for a drama-scoped kind, an episode of the drama for an episode-scoped one (JOB_SCOPE, adr-0015). */
  episodeId: number | null;
  target?: string;
}

export type ProgressFn = (progress: Record<string, unknown>) => void;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface JobHooks {
  /** Written on the row when it is inserted, so the state is there before `work` starts (the planner's request). */
  initialProgress?: Record<string, unknown>;
  /** Runs in the transaction that marks the job done (the breakdown purges parked shots here). */
  onDone?: (jobId: number, tx: Tx) => void;
  /** Runs in the transaction that marks the job failed (the breakdown restores parked shots here). */
  onFailure?: (jobId: number, tx: Tx) => void;
}

/**
 * Starts a job unless one is already running for (kind, drama, episode-or-none, target); a duplicate start returns
 * the running job with alreadyRunning: true (adr-0008, adr-0015). `work` runs detached; its outcome is recorded on
 * the row together with the matching hook, in one transaction, so a crash never leaves a finished swap on a job
 * still marked running.
 */
export function runJob(
  key: JobKey,
  work: (ctx: { jobId: number; progress: ProgressFn }) => Promise<void>,
  hooks: JobHooks = {},
): JobStarted {
  const target = key.target ?? '';
  if ((JOB_SCOPE[key.kind] === 'drama') !== (key.episodeId === null)) {
    throw new Error(`A ${key.kind} job is ${JOB_SCOPE[key.kind]}-scoped; it was started ${key.episodeId === null ? 'without' : 'with'} an episode`);
  }
  const inserted = db.transaction((tx) => {
    const running = tx
      .select({ id: agentJobs.id })
      .from(agentJobs)
      .where(
        and(
          eq(agentJobs.kind, key.kind),
          eq(agentJobs.dramaId, key.dramaId),
          key.episodeId === null ? isNull(agentJobs.episodeId) : eq(agentJobs.episodeId, key.episodeId),
          eq(agentJobs.target, target),
          eq(agentJobs.status, 'running'),
        ),
      )
      .get();
    if (running) return { jobId: running.id, alreadyRunning: true };
    const row = tx
      .insert(agentJobs)
      .values({ kind: key.kind, episodeId: key.episodeId, dramaId: key.dramaId, target, progress: hooks.initialProgress ?? {} })
      .returning({ id: agentJobs.id })
      .get();
    return { jobId: row.id, alreadyRunning: false };
  });
  if (inserted.alreadyRunning) return inserted;

  const { jobId } = inserted;
  const progress: ProgressFn = (value) =>
    db.update(agentJobs).set({ progress: value }).where(eq(agentJobs.id, jobId)).run();

  const settle = (status: 'done' | 'failed', error: string | null, hook?: (jobId: number, tx: Tx) => void) =>
    db.transaction((tx) => {
      hook?.(jobId, tx);
      tx.update(agentJobs).set({ status, error, finishedAt: nowIso() }).where(eq(agentJobs.id, jobId)).run();
    });
  // Nothing here may reject: an unhandled rejection exits Node.
  void (async () => {
    let failure: string | null = null;
    try {
      await work({ jobId, progress });
    } catch (err) {
      failure = scrubSecrets(err instanceof Error ? err.message : String(err));
    }
    if (failure === null) {
      try {
        settle('done', null, hooks.onDone);
        return;
      } catch (err) {
        failure = `Finishing the job failed: ${(err as Error).message}`;
      }
    }
    logger.warn({ jobId, kind: key.kind, err: failure }, 'job failed');
    try {
      settle('failed', failure, hooks.onFailure);
    } catch (err) {
      logger.error({ jobId, kind: key.kind, err: (err as Error).message }, 'job bookkeeping failed');
    }
  })();
  return inserted;
}

const latest = (episodeId: number, kind: JobKind, target = '') =>
  db
    .select()
    .from(agentJobs)
    .where(and(eq(agentJobs.episodeId, episodeId), eq(agentJobs.kind, kind), eq(agentJobs.target, target)))
    .orderBy(desc(agentJobs.id))
    .get();

/** Recap jobs are keyed by script revision; the studio shows the latest one whichever revision it was for. */
const latestOfKind = (episodeId: number, kind: JobKind) =>
  db
    .select()
    .from(agentJobs)
    .where(and(eq(agentJobs.episodeId, episodeId), eq(agentJobs.kind, kind)))
    .orderBy(desc(agentJobs.id))
    .get();

const view = (row: Row | undefined) => (row ? toAgentJob(row) : null);

export const latestExtractionJobs = (episodeId: number): EpisodeJobs['extraction'] => ({
  characters: view(latest(episodeId, 'extraction', 'characters')),
  scenes: view(latest(episodeId, 'extraction', 'scenes')),
  props: view(latest(episodeId, 'extraction', 'props')),
});

/** The latest drama-scoped job of a kind (no episode). */
const latestOfDrama = (dramaId: number, kind: JobKind) =>
  db
    .select()
    .from(agentJobs)
    .where(and(eq(agentJobs.dramaId, dramaId), isNull(agentJobs.episodeId), eq(agentJobs.kind, kind)))
    .orderBy(desc(agentJobs.id))
    .get();

/** DramaJobs: the latest outline and plan job of the drama (adr-0015). */
export function getDramaJobs(dramaId: number): DramaJobs {
  return { dramaId, outline: view(latestOfDrama(dramaId, 'outline')), plan: view(latestOfDrama(dramaId, 'plan')) };
}

/** EpisodeJobs: the latest job per kind (per target for extraction, any target for recap). */
export function getEpisodeJobs(episodeId: number): EpisodeJobs {
  return {
    episodeId,
    rewrite: view(latest(episodeId, 'rewrite')),
    write: view(latest(episodeId, 'write')),
    extraction: latestExtractionJobs(episodeId),
    breakdown: view(latest(episodeId, 'breakdown')),
    videoPromptBatch: view(latest(episodeId, 'videoPromptBatch')),
    recap: view(latestOfKind(episodeId, 'recap')),
  };
}

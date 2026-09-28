import { and, desc, eq } from 'drizzle-orm';
import type { AgentJob, EpisodeJobs, JobKind, JobStarted } from '@open-drama/contracts';
import { db } from '../../db/client';
import { agentJobs } from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { logger } from '../../http/logger';

type Row = typeof agentJobs.$inferSelect;

export const toAgentJob = ({ dramaId: _dramaId, ...row }: Row): AgentJob => row;

export interface JobKey {
  kind: JobKind;
  episodeId: number;
  dramaId: number;
  target?: string;
}

export type ProgressFn = (progress: Record<string, unknown>) => void;

/**
 * Starts a job unless one is already running for (kind, episode, target); a duplicate start returns the running
 * job with alreadyRunning: true (adr-0008). `work` runs detached; its outcome is recorded on the row, and
 * `onFailure` runs before the row is marked failed (the breakdown uses it to restore parked shots).
 */
export function runJob(
  key: JobKey,
  work: (ctx: { jobId: number; progress: ProgressFn }) => Promise<void>,
  onFailure?: (jobId: number) => void,
): JobStarted {
  const target = key.target ?? '';
  const inserted = db.transaction((tx) => {
    const running = tx
      .select({ id: agentJobs.id })
      .from(agentJobs)
      .where(
        and(
          eq(agentJobs.kind, key.kind),
          eq(agentJobs.episodeId, key.episodeId),
          eq(agentJobs.target, target),
          eq(agentJobs.status, 'running'),
        ),
      )
      .get();
    if (running) return { jobId: running.id, alreadyRunning: true };
    const row = tx
      .insert(agentJobs)
      .values({ kind: key.kind, episodeId: key.episodeId, dramaId: key.dramaId, target })
      .returning({ id: agentJobs.id })
      .get();
    return { jobId: row.id, alreadyRunning: false };
  });
  if (inserted.alreadyRunning) return inserted;

  const { jobId } = inserted;
  const progress: ProgressFn = (value) =>
    db.update(agentJobs).set({ progress: value }).where(eq(agentJobs.id, jobId)).run();

  // Only work() decides the outcome: a failed bookkeeping write after success must not trigger onFailure
  // (which would undo a completed breakdown), and nothing here may reject (an unhandled rejection exits Node).
  const bookkeep = (what: string, fn: () => void) => {
    try {
      fn();
    } catch (err) {
      logger.error({ jobId, kind: key.kind, what, err: (err as Error).message }, 'job bookkeeping failed');
    }
  };
  void (async () => {
    let failure: string | null = null;
    try {
      await work({ jobId, progress });
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }
    if (failure === null) {
      bookkeep('done', () =>
        db.update(agentJobs).set({ status: 'done', finishedAt: nowIso() }).where(eq(agentJobs.id, jobId)).run(),
      );
      return;
    }
    logger.warn({ jobId, kind: key.kind, err: failure }, 'job failed');
    if (onFailure) bookkeep('onFailure', () => onFailure(jobId));
    bookkeep('failed', () =>
      db.update(agentJobs)
        .set({ status: 'failed', error: failure, finishedAt: nowIso() })
        .where(eq(agentJobs.id, jobId))
        .run(),
    );
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

const view = (row: Row | undefined) => (row ? toAgentJob(row) : null);

export const latestExtractionJobs = (episodeId: number): EpisodeJobs['extraction'] => ({
  characters: view(latest(episodeId, 'extraction', 'characters')),
  scenes: view(latest(episodeId, 'extraction', 'scenes')),
  props: view(latest(episodeId, 'extraction', 'props')),
});

/** EpisodeJobs: the latest job per kind (per target for extraction). */
export function getEpisodeJobs(episodeId: number): EpisodeJobs {
  return {
    episodeId,
    rewrite: view(latest(episodeId, 'rewrite')),
    extraction: latestExtractionJobs(episodeId),
    breakdown: view(latest(episodeId, 'breakdown')),
    videoPromptBatch: view(latest(episodeId, 'videoPromptBatch')),
  };
}

import { and, eq, isNull, ne, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { agentJobs, films, generationTasks } from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { env } from '../../env';
import { restoreParkedShots } from '../storyboard/service';

const RESTART_MESSAGE = 'Interrupted by a server restart';
/** No provider task id: it was queued, or sent without an answer yet, and a sent one may have run (and billed) anyway. */
const UNANSWERED_MESSAGE =
  'Interrupted by a server restart before the provider confirmed it; if it had already been sent, the provider may still have run and billed it';

export interface BootCleanupResult {
  tasks: number;
  films: number;
  jobs: number;
  restoredShots: number;
}

/**
 * FailInterruptedTasks: nothing can still be running right after boot, so every in-flight row is failed, except a
 * generation the provider had already accepted (it has a provider task id): that one is paid for and is left
 * processing for ResumeInterruptedTasks (adr-0005). Offline mode resumes nothing.
 */
export function failInterrupted(): BootCleanupResult {
  const now = nowIso();
  const failTasks = (where: SQL | undefined, error: string) =>
    db
      .update(generationTasks)
      .set({ status: 'failed', error, errorClass: 'timeout', completedAt: now })
      .where(and(eq(generationTasks.status, 'processing'), where))
      .run().changes;
  const tasks =
    failTasks(and(isNull(generationTasks.providerTaskId), ne(generationTasks.provider, 'stub')), UNANSWERED_MESSAGE) +
    failTasks(env.OPEN_DRAMA_STUB_PROVIDERS ? undefined : eq(generationTasks.provider, 'stub'), RESTART_MESSAGE);
  const filmCount = db
    .update(films)
    .set({ status: 'failed', error: RESTART_MESSAGE, completedAt: now })
    .where(eq(films.status, 'processing'))
    .run().changes;

  const running = db.select().from(agentJobs).where(eq(agentJobs.status, 'running')).all();
  let restoredShots = 0;
  for (const job of running) {
    db.transaction((tx) => {
      if (job.kind === 'breakdown' && job.episodeId !== null) restoredShots += restoreParkedShots(tx, job.id, job.episodeId);
      tx.update(agentJobs).set({ status: 'failed', error: RESTART_MESSAGE, finishedAt: now }).where(eq(agentJobs.id, job.id)).run();
    });
  }
  return { tasks, films: filmCount, jobs: running.length, restoredShots };
}

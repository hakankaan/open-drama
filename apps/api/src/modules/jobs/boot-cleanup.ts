import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { agentJobs, films, generationTasks } from '../../db/schema';
import { nowIso } from '../../db/schema/columns';
import { restoreParkedShots } from '../storyboard/parking';

const RESTART_MESSAGE = 'Interrupted by a server restart';

export interface BootCleanupResult {
  tasks: number;
  films: number;
  jobs: number;
  restoredShots: number;
}

/** FailInterruptedTasks: nothing can still be running right after boot, so every in-flight row is failed. */
export function failInterrupted(): BootCleanupResult {
  const now = nowIso();
  const tasks = db
    .update(generationTasks)
    .set({ status: 'failed', error: RESTART_MESSAGE, completedAt: now })
    .where(eq(generationTasks.status, 'processing'))
    .run().changes;
  const filmCount = db
    .update(films)
    .set({ status: 'failed', error: RESTART_MESSAGE, completedAt: now })
    .where(eq(films.status, 'processing'))
    .run().changes;

  const running = db.select().from(agentJobs).where(eq(agentJobs.status, 'running')).all();
  let restoredShots = 0;
  for (const job of running) {
    if (job.kind === 'breakdown') restoredShots += restoreParkedShots(job.id, job.episodeId);
    db.update(agentJobs)
      .set({ status: 'failed', error: RESTART_MESSAGE, finishedAt: now })
      .where(eq(agentJobs.id, job.id))
      .run();
  }
  return { tasks, films: filmCount, jobs: running.length, restoredShots };
}

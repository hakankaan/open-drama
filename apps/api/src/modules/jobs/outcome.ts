import { and, eq, inArray, isNull } from 'drizzle-orm';
import { PlanProgress, type JobOutcome } from '@open-drama/contracts';
import { db } from '../../db/client';
import { dramas, episodes, type agentJobs } from '../../db/schema';

type Row = typeof agentJobs.$inferSelect;

/**
 * What a settled job produced (adr-0016), read from its targets as they are now: the outline's size and revision, the
 * episodes a plan added (kept by a failed or cancelled plan too), the script and the recap job a write started, the
 * recap's size and revision. Null while the job runs, and for a failed run that saved nothing.
 */
export function jobOutcome(job: Row): JobOutcome | null {
  if (job.status === 'running') return null;
  switch (job.kind) {
    case 'outline': {
      if (job.status !== 'done') return null;
      const row = db.select({ outline: dramas.outline, outlineRevision: dramas.outlineRevision }).from(dramas).where(eq(dramas.id, job.dramaId)).get();
      return row ? { kind: 'outline', outlineChars: row.outline.length, outlineRevision: row.outlineRevision } : null;
    }
    case 'plan': {
      const plan = PlanProgress.safeParse(job.progress);
      if (!plan.success) return null;
      const added =
        plan.data.written.length === 0
          ? []
          : db
              .select({ id: episodes.id, episodeNumber: episodes.episodeNumber, title: episodes.title, synopsis: episodes.description })
              .from(episodes)
              .where(and(inArray(episodes.id, plan.data.written), isNull(episodes.deletedAt)))
              .orderBy(episodes.episodeNumber)
              .all();
      return { kind: 'plan', requested: plan.data.count, planned: added.length, added };
    }
    case 'write':
    case 'rewrite': {
      if (job.status !== 'done' || job.episodeId === null) return null;
      const row = db.select({ scriptContent: episodes.scriptContent, scriptRevision: episodes.scriptRevision }).from(episodes).where(eq(episodes.id, job.episodeId)).get();
      if (!row) return null;
      const recapJobId = job.progress.recapJobId;
      return { kind: job.kind, scriptChars: row.scriptContent?.length ?? 0, scriptRevision: row.scriptRevision, recapJobId: typeof recapJobId === 'number' ? recapJobId : null };
    }
    case 'recap': {
      if (job.status !== 'done' || job.episodeId === null) return null;
      const row = db.select({ recap: episodes.recap, recapRevision: episodes.recapRevision }).from(episodes).where(eq(episodes.id, job.episodeId)).get();
      return row ? { kind: 'recap', recapChars: row.recap.length, recapRevision: row.recapRevision } : null;
    }
    default:
      return { kind: job.kind };
  }
}

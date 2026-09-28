import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { JobKind, JobStatus } from '@open-drama/contracts';
import { id, json, nowIso } from './columns';

export const agentJobs = sqliteTable(
  'agent_jobs',
  {
    id: id(),
    kind: text().$type<JobKind>().notNull(),
    episodeId: integer().notNull(),
    dramaId: integer().notNull(),
    // '' when the kind has no target (only extraction uses one).
    target: text().notNull().default(''),
    status: text().$type<JobStatus>().notNull().default('running'),
    progress: json<Record<string, unknown>>().notNull().default({}),
    error: text(),
    startedAt: text().notNull().$defaultFn(nowIso),
    finishedAt: text(),
  },
  (t) => [
    index('agent_jobs_episode_idx').on(t.episodeId),
    // One active job per (kind, episode, target).
    uniqueIndex('agent_jobs_running_uq')
      .on(t.kind, t.episodeId, t.target)
      .where(sql`${t.status} = 'running'`),
  ],
);

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { JobKind, JobStatus } from '@open-drama/contracts';
import { id, json, nowIso } from './columns';

export const agentJobs = sqliteTable(
  'agent_jobs',
  {
    id: id(),
    kind: text().$type<JobKind>().notNull(),
    // Null for a drama-scoped job (outline, plan): the kind fixes the scope (adr-0015).
    episodeId: integer(),
    dramaId: integer().notNull(),
    // '' when the kind has no target (extraction and recap use one).
    target: text().notNull().default(''),
    status: text().$type<JobStatus>().notNull().default('running'),
    progress: json<Record<string, unknown>>().notNull().default({}),
    error: text(),
    startedAt: text().notNull().$defaultFn(nowIso),
    finishedAt: text(),
  },
  (t) => [
    index('agent_jobs_episode_idx').on(t.episodeId),
    index('agent_jobs_drama_idx').on(t.dramaId),
    // One active job per (kind, drama, episode-or-none, target). Two partial indexes, because a NULL episode never
    // equals another NULL and would let two drama-scoped jobs of one kind run at once.
    uniqueIndex('agent_jobs_running_episode_uq')
      .on(t.kind, t.dramaId, t.episodeId, t.target)
      .where(sql`${t.status} = 'running' AND ${t.episodeId} IS NOT NULL`),
    uniqueIndex('agent_jobs_running_drama_uq')
      .on(t.kind, t.dramaId, t.target)
      .where(sql`${t.status} = 'running' AND ${t.episodeId} IS NULL`),
  ],
);

import { and, eq, lt } from 'drizzle-orm';
import type { AgentType, EpisodeView, StartTextRun } from '@open-drama/contracts';
import type { z } from 'zod';
import { db } from '../../../db/client';
import { agentJobs, episodes } from '../../../db/schema';
import { conflict, precondition } from '../../../http/errors';
import { getEpisodeJobs, runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { assertScriptFree, assertScriptReplaceable, getEpisodeRow, skipRewrite } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { maybeStartRecap, SERIES_NOTE } from './recap';

type Opts = z.input<typeof StartTextRun>;
type Row = typeof episodes.$inferSelect;

/** The creator's target length, so the script holds what fits it (the breakdown is held to it). */
const lengthNote = (seconds: number) =>
  `The episode runs ${seconds} seconds on screen: write only what fits that, keeping the story's beats in order and compressing or leaving out minor moments.`;

/** The two agents that write an episode's script from its raw content. */
const SCRIPT_JOBS = {
  rewrite: {
    agentType: 'script_rewriter',
    message: `Read this episode's raw content with read_episode_script, rewrite it as a formatted shooting script following your skills, then save the complete script with save_script.`,
    note: SERIES_NOTE,
    noContent: 'Paste the raw content before rewriting it',
    busy: 'rewrite',
  },
  write: {
    agentType: 'episode_writer',
    message:
      "Read this episode's beat sheet with read_episode_for_writing, expand it into a formatted shooting script following your skills, then save the complete script with save_script.",
    note: "The tool result's `series` block gives the project's premise, its story outline and the earlier episodes' recaps (ready, stale or missing), and `nextEpisode` the beats of the episode that follows: keep the story continuous with them and stop where this episode's beats stop.",
    noContent: 'Add the beat sheet (the raw content) before expanding it into a script',
    busy: 'expand the beats',
  },
} satisfies Record<'rewrite' | 'write', { agentType: AgentType; message: string; note: string; noContent: string; busy: string }>;

/**
 * In a serial drama the script agents read the earlier episodes' recaps: one still being written is waited for, so
 * the writer reads it rather than a stale or missing one (adr-0016).
 */
function assertEarlierRecapsSettled(ep: Row) {
  const running = db
    .select({ episodeNumber: episodes.episodeNumber })
    .from(agentJobs)
    .innerJoin(episodes, eq(episodes.id, agentJobs.episodeId))
    .where(
      and(eq(agentJobs.dramaId, ep.dramaId), eq(agentJobs.kind, 'recap'), eq(agentJobs.status, 'running'), lt(episodes.episodeNumber, ep.episodeNumber)),
    )
    .orderBy(episodes.episodeNumber)
    .get();
  if (running) throw conflict(`Episode ${running.episodeNumber}'s recap is being written; write this script once it is saved, so the writer reads it`);
}

/**
 * One script job, written to fit the episode's target length when it has one. Done only when save_script succeeded
 * (else one retry, then failed). The script has one agent at a time (assertScriptFree); a saved script is replaced
 * only with `replace` (adr-0016). In a serial drama the saved script's recap job is started before this job settles
 * and its id recorded in the progress, so the studio and an assistant waiting on the job find it at once.
 */
function startScriptJob(kind: keyof typeof SCRIPT_JOBS, episodeId: number, { replace, ...opts }: Opts) {
  const spec = SCRIPT_JOBS[kind];
  const ep = getEpisodeRow(episodeId);
  if (!ep.content.trim()) throw precondition(spec.noContent);
  // A retried start answers with the running job before the guards (its own script is the one being written).
  const running = getEpisodeJobs(ep.id)[kind];
  if (running?.status === 'running') return { jobId: running.id, alreadyRunning: true };
  assertScriptFree(ep.id, spec.busy, kind);
  assertScriptReplaceable(ep, replace);
  if (getDramaRow(ep.dramaId).serial) assertEarlierRecapsSettled(ep);
  return runJob({ kind, episodeId: ep.id, dramaId: ep.dramaId }, async ({ progress, signal }) => {
    const run = await runAgentUntilSaved(
      {
        agentType: spec.agentType,
        message: [spec.message, ep.targetDurationSeconds && lengthNote(ep.targetDurationSeconds), spec.note].filter(Boolean).join(' '),
        episodeId: ep.id,
        dramaId: ep.dramaId,
        signal,
        ...opts,
      },
      'save_script',
    );
    const recap = maybeStartRecap(ep.id, opts);
    progress({ steps: run.steps, model: run.model, recapJobId: recap?.jobId ?? null });
  });
}

/** RewriteScript → ScriptRewriteJob: the raw content rewritten as a shooting script. */
export const startRewrite = (episodeId: number, opts: Opts = {}) => startScriptJob('rewrite', episodeId, opts);

/**
 * WriteEpisodeScript → EpisodeWriteJob (adr-0015): the beat sheet expanded into the script through the same
 * save_script as the rewrite, so the recap chain runs unchanged.
 */
export const startWrite = (episodeId: number, opts: Opts = {}) => startScriptJob('write', episodeId, opts);

/**
 * SkipRewrite as both interfaces run it (adr-0016): the raw content becomes the script and, in a serial drama, the
 * recap job starts at once; its id comes back with the episode so the caller can wait on it.
 */
export function useContentAsScript(episodeId: number, opts: { replace?: boolean } = {}): { episode: EpisodeView; recapJobId: number | null } {
  const episode = skipRewrite(episodeId, opts);
  const recap = maybeStartRecap(episodeId);
  return { episode, recapJobId: recap?.jobId ?? null };
}

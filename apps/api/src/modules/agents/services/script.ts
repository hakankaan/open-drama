import type { AgentType, TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { runJob } from '../../jobs/run-job';
import { assertScriptFree, getEpisodeRow } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { maybeStartRecap, SERIES_NOTE } from './recap';

type Opts = z.input<typeof TextModelOverride>;

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
 * One script job, written to fit the episode's target length when it has one. Done only when save_script succeeded
 * (else one retry, then failed). The script has one agent at a time (assertScriptFree). In a serial drama the saved
 * script's recap job is started before this job settles, so the studio sees it at once.
 */
function startScriptJob(kind: keyof typeof SCRIPT_JOBS, episodeId: number, opts: Opts) {
  const spec = SCRIPT_JOBS[kind];
  const ep = getEpisodeRow(episodeId);
  if (!ep.content.trim()) throw precondition(spec.noContent);
  assertScriptFree(ep.id, spec.busy, kind);
  return runJob({ kind, episodeId: ep.id, dramaId: ep.dramaId }, async ({ signal }) => {
    await runAgentUntilSaved(
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
    maybeStartRecap(ep.id, opts);
  });
}

/** RewriteScript → ScriptRewriteJob: the raw content rewritten as a shooting script. */
export const startRewrite = (episodeId: number, opts: Opts = {}) => startScriptJob('rewrite', episodeId, opts);

/**
 * WriteEpisodeScript → EpisodeWriteJob (adr-0015): the beat sheet expanded into the script through the same
 * save_script as the rewrite, so the recap chain runs unchanged.
 */
export const startWrite = (episodeId: number, opts: Opts = {}) => startScriptJob('write', episodeId, opts);

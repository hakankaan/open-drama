import type { TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { runJob } from '../../jobs/run-job';
import { assertScriptFree, getEpisodeRow } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { maybeStartRecap } from './recap';
import { lengthNote } from './rewrite';

const MESSAGE =
  "Read this episode's beat sheet with read_episode_for_writing, expand it into a formatted shooting script following your skills, then save the complete script with save_script.";

const CONTEXT_NOTE =
  "The tool result's `series` block gives the project's premise, its story outline and the earlier episodes' recaps (ready, stale or missing), and `nextEpisode` the beats of the episode that follows: keep the story continuous with them and stop where this episode's beats stop.";

/**
 * WriteEpisodeScript → EpisodeWriteJob (adr-0015). The beats become the script through the same save_script as the
 * rewrite, so the recap chain runs unchanged. The script has one agent at a time: refused while a rewrite runs; a
 * running write is returned (alreadyRunning).
 */
export function startWrite(episodeId: number, opts: z.input<typeof TextModelOverride> = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!ep.content.trim()) throw precondition('Add the beat sheet (the raw content) before expanding it into a script');
  assertScriptFree(ep.id, 'expand the beats once it is saved', 'write');
  return runJob({ kind: 'write', episodeId: ep.id, dramaId: ep.dramaId }, async () => {
    await runAgentUntilSaved(
      {
        agentType: 'episode_writer',
        message: [MESSAGE, ep.targetDurationSeconds && lengthNote(ep.targetDurationSeconds), CONTEXT_NOTE].filter(Boolean).join(' '),
        episodeId: ep.id,
        dramaId: ep.dramaId,
        ...opts,
      },
      'save_script',
    );
    maybeStartRecap(ep.id, opts);
  });
}

import type { TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { runJob } from '../../jobs/run-job';
import { getEpisodeRow } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { maybeStartRecap, SERIES_NOTE } from './recap';

const MESSAGE = `Read this episode's raw content with read_episode_script, rewrite it as a formatted shooting script following your skills, then save the complete script with save_script.`;

/** The creator's target length, so the script holds what fits it (the breakdown is held to it). */
const lengthNote = (seconds: number) =>
  `The episode runs ${seconds} seconds on screen: write only what fits that, keeping the story's beats in order and compressing or leaving out minor moments.`;

/**
 * RewriteScript → ScriptRewriteJob, written to fit the episode's target length when it has one. Done only when
 * save_script succeeded (else one retry, then failed). In a serial drama the saved script's recap job is started
 * before the rewrite settles, so the studio sees it at once.
 */
export function startRewrite(episodeId: number, opts: z.input<typeof TextModelOverride> = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!ep.content.trim()) throw precondition('Paste the raw content before rewriting it');
  return runJob({ kind: 'rewrite', episodeId: ep.id, dramaId: ep.dramaId }, async () => {
    await runAgentUntilSaved(
      {
        agentType: 'script_rewriter',
        message: [MESSAGE, ep.targetDurationSeconds && lengthNote(ep.targetDurationSeconds), SERIES_NOTE].filter(Boolean).join(' '),
        episodeId: ep.id,
        dramaId: ep.dramaId,
        ...opts,
      },
      'save_script',
    );
    maybeStartRecap(ep.id, opts);
  });
}

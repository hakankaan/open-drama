import type { TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { runJob } from '../../jobs/run-job';
import { getEpisodeRow } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';

const MESSAGE =
  "Read this episode's raw content with read_episode_script, rewrite it as a formatted shooting script following your skills, then save the complete script with save_script.";

/** RewriteScript → ScriptRewriteJob. Done only when save_script succeeded (else one retry, then failed). */
export function startRewrite(episodeId: number, opts: z.input<typeof TextModelOverride> = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!ep.content.trim()) throw precondition('Paste the raw content before rewriting it');
  return runJob({ kind: 'rewrite', episodeId: ep.id, dramaId: ep.dramaId }, async () => {
    await runAgentUntilSaved(
      { agentType: 'script_rewriter', message: MESSAGE, episodeId: ep.id, dramaId: ep.dramaId, ...opts },
      'save_script',
    );
  });
}

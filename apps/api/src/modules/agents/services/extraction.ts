import type { ExtractionTarget, TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { runJob } from '../../jobs/run-job';
import { assertScriptSettled, getEpisodeRow } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';

const WHAT: Record<ExtractionTarget, string> = {
  characters: 'the characters (everyone seen on screen)',
  scenes: 'the scenes (each place at a time of day)',
  props: 'the plot-critical props (0 to 3; none is a valid answer)',
};

const message = (target: ExtractionTarget) =>
  `Extract only ${WHAT[target]} from this episode's script, and nothing else. Read the script with read_script_for_extraction, read the drama's existing ${target} with read_existing_${target} and reuse their exact names for matches, then save every ${target === 'props' ? 'prop' : target.slice(0, -1)} of this episode once with save_dedup_${target}.`;

/** StartExtraction → ExtractionJob per target; the three targets run in parallel, a duplicate start returns the running job. */
export function startExtraction(episodeId: number, target: ExtractionTarget, opts: z.input<typeof TextModelOverride> = {}) {
  const ep = getEpisodeRow(episodeId);
  assertScriptSettled(ep.id, 'extract assets');
  if (!ep.scriptContent?.trim()) throw precondition('Finish the script (rewrite or skip) before extracting assets');
  return runJob({ kind: 'extraction', episodeId: ep.id, dramaId: ep.dramaId, target }, async ({ progress, signal }) => {
    const run = await runAgentUntilSaved(
      { agentType: 'extractor', message: message(target), episodeId: ep.id, dramaId: ep.dramaId, signal, ...opts },
      `save_dedup_${target}`,
    );
    progress({ steps: run.steps, model: run.model });
  });
}

import { DESIGN_CAPS, type DesignTarget, type TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { conflict, precondition } from '../../../http/errors';
import { getDramaJobs, mergeProgress, runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { DESIGN_RUN_TOOLS } from '../tools';

const WHAT: Record<DesignTarget, string> = {
  characters: 'the cast (every character the story names, each with a role, an appearance and a styling)',
  scenes: 'the places (each location of the world at the time of day the story shows it, with a prompt and its lighting)',
  props: 'the plot-critical props (the few objects the story turns on, each with a type and a description; none is a valid answer)',
};

const message = (target: DesignTarget) =>
  `Design only ${WHAT[target]} for this project from its story, and nothing else: at most ${DESIGN_CAPS[target]}, the most important first. Read the story with read_story_for_design, read the project's existing ${target} with read_existing_${target} and reuse their exact names for matches, then save the whole set once with save_designed_${target}.`;

/**
 * DesignAssets → DesignJob per target (adr-0024), drama-scoped: the asset designer, offered the story, the kind's
 * existing assets and the kind's one save. The three targets run in parallel, a duplicate start returns the running
 * job. Refused without an outline (the designer works from it) and while the outline is being written (the run would
 * design from a text about to be replaced). The run's outcome is what its tools wrote on the progress: the outline
 * revision read and the save's counts.
 */
export function startDesign(dramaId: number, target: DesignTarget, opts: z.input<typeof TextModelOverride> = {}) {
  const drama = getDramaRow(dramaId);
  if (!drama.outline.trim()) throw precondition('Write the outline first: the assets are designed from it');
  if (getDramaJobs(dramaId).outline?.status === 'running') throw conflict('The outline is being written; design the assets once it is saved');
  return runJob(
    { kind: 'design', dramaId, episodeId: null, target },
    async ({ jobId, signal }) => {
      const run = await runAgentUntilSaved(
        { agentType: 'asset_designer', message: message(target), dramaId, jobId, signal, tools: DESIGN_RUN_TOOLS[target], ...opts },
        `save_designed_${target}`,
      );
      mergeProgress(jobId, { steps: run.steps, model: run.model });
    },
    // The revision at the start, replaced by the one the read tool saw.
    { initialProgress: { outlineRevision: drama.outlineRevision } },
  );
}

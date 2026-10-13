import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobStarted, PlanEpisodes, StartRecapInput, StartScriptJobInput, WriteOutlineInput } from '@open-drama/contracts';
import { startOutline } from '../../modules/agents/services/outline';
import { startPlan } from '../../modules/agents/services/plan';
import { startRecap } from '../../modules/agents/services/recap';
import { startRewrite, startWrite } from '../../modules/agents/services/script';
import { getEpisodeRow } from '../../modules/production/episodes';
import { studioPath, tool } from '../errors';

// The story-room agent runs (adr-0015). Each starts a job on the server and bills the creator's text service once;
// a job already running is returned instead of started again (alreadyRunning). wait_for_job reports the outcome.

const Started = JobStarted.extend({ studioPath: z.string() });
const BILLS = 'Starts a server job that bills the configured text service once; wait_for_job returns its outcome.';

const episodeStarted = (episodeId: number, started: { jobId: number; alreadyRunning: boolean }) => {
  const row = getEpisodeRow(episodeId);
  return { ...started, studioPath: studioPath.episode(row.dramaId, row.episodeNumber) };
};

export function registerStoryTools(server: McpServer) {
  tool(
    server,
    'write_outline',
    {
      title: 'Write the outline',
      description: `The story writer drafts the project's outline from its description, keeping the episodes already written or planned fixed. ${BILLS} Over an existing outline it needs replace: true, after the creator agreed. Refused while episodes are being planned.`,
      input: WriteOutlineInput,
      output: Started,
    },
    ({ dramaId, ...opts }) => ({ ...startOutline(dramaId, opts), studioPath: studioPath.drama(dramaId) }),
  );

  tool(
    server,
    'plan_episodes',
    {
      title: 'Plan episodes',
      description: `The episode planner adds count new episodes after the last one, each with a title, a synopsis and a beat sheet, from the outline (or the description). Optional target length in seconds per episode and resolution. ${BILLS} Append-only: nothing existing changes. The outcome lists the episodes added.`,
      input: PlanEpisodes.extend({ dramaId: z.number().int().positive().describe('The project (drama) id') }).strict(),
      output: Started,
    },
    ({ dramaId, ...input }) => ({ ...startPlan(dramaId, input), studioPath: studioPath.drama(dramaId) }),
  );

  tool(
    server,
    'write_episode_script',
    {
      title: 'Write the episode script',
      description: `The episode writer expands the episode's beat sheet into a formatted shooting script, continuous with the outline and the earlier recaps. ${BILLS} In a serial project the outcome names the recap job it started. Over an existing script it needs replace: true, after the creator agreed; refused while an earlier episode's recap is still being written.`,
      input: StartScriptJobInput,
      output: Started,
    },
    ({ episodeId, ...opts }) => episodeStarted(episodeId, startWrite(episodeId, opts)),
  );

  tool(
    server,
    'rewrite_script',
    {
      title: 'Rewrite the content as a script',
      description: `The script rewriter turns the episode's raw content (prose, notes, a chapter) into a formatted shooting script, keeping every event and inventing nothing. ${BILLS} Same guards as write_episode_script.`,
      input: StartScriptJobInput,
      output: Started,
    },
    ({ episodeId, ...opts }) => episodeStarted(episodeId, startRewrite(episodeId, opts)),
  );

  tool(
    server,
    'write_recap',
    {
      title: 'Write the recap',
      description: `The recap writer summarises the episode's script for the writers of the later episodes (serial projects only). ${BILLS} A recap that is still fresh for the current script is rewritten only with replace: true, after the creator agreed; a stale or missing one needs nothing.`,
      input: StartRecapInput,
      output: Started,
    },
    ({ episodeId, ...opts }) => episodeStarted(episodeId, startRecap(episodeId, opts)),
  );
}

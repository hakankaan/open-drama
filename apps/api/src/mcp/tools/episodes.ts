import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  CreateEpisode,
  DeleteEpisodeInput,
  EpisodeBrief,
  EpisodeJobs,
  EpisodePipelineStatus,
  EpisodeText,
  ReadEpisode,
  SaveBeatsInput,
  SaveRecapInput,
  SaveScriptInput,
  TextSaved,
  UpdateEpisodeInput,
  UseContentAsScriptInput,
  UseContentAsScriptResult,
  type EpisodeView,
} from '@open-drama/contracts';
import { useContentAsScript } from '../../modules/agents/services/script';
import { getEpisodeJobs } from '../../modules/jobs/run-job';
import { createEpisode, deleteEpisode, getEpisodeRow, getEpisodeView, readEpisodeText, saveEpisodeText, updateEpisode } from '../../modules/production/episodes';
import { getPipelineStatus } from '../../modules/production/pipeline';
import { studioPath, tool } from '../errors';

/** The episode without its large texts: sizes and revisions instead (read_episode gives one text). */
function brief(view: EpisodeView): EpisodeBrief {
  const { content, scriptContent, recap, ...rest } = view;
  return {
    ...rest,
    synopsis: view.description,
    beats: { characters: content.length, revision: view.beatsRevision },
    script: { characters: scriptContent?.length ?? 0, revision: view.scriptRevision },
    recap: { characters: recap.length, revision: view.recapRevision, stale: view.recapStale },
    studioPath: studioPath.episode(view.dramaId, view.episodeNumber),
  };
}

const saved = (episodeId: number, result: Omit<TextSaved, 'studioPath'>): TextSaved => {
  const row = getEpisodeRow(episodeId);
  return { ...result, studioPath: studioPath.episode(row.dramaId, row.episodeNumber) };
};

export function registerEpisodeTools(server: McpServer) {
  tool(
    server,
    'get_episode',
    {
      title: 'Get an episode',
      description:
        'One episode without its texts: title, synopsis, status, target length, the size and revision of its beats, script and recap (and whether the recap is stale), the pipeline stages reached, and its jobs. Use read_episode for a text.',
      input: z.strictObject({ episodeId: z.number().int().positive().describe('The episode id') }),
      output: z.object({ episode: EpisodeBrief, pipeline: EpisodePipelineStatus, jobs: EpisodeJobs }),
      readOnly: true,
    },
    ({ episodeId }) => ({ episode: brief(getEpisodeView(episodeId)), pipeline: getPipelineStatus(episodeId), jobs: getEpisodeJobs(episodeId) }),
  );

  tool(
    server,
    'read_episode',
    {
      title: 'Read an episode text',
      description:
        "One text of an episode: beats (the raw content or beat sheet), script or recap, with the revision to pass back as ifRevision when saving it (the recap also carries the scriptRevision to pass back as forScriptRevision). Scripts can be long; read one only when the creator wants to read or edit it.",
      input: ReadEpisode,
      output: EpisodeText,
      readOnly: true,
    },
    ({ episodeId, part }) => {
      const { text, revision, characters, scriptRevision } = readEpisodeText(episodeId, part);
      return { episodeId, part, text, revision, characters, ...(scriptRevision === undefined ? {} : { scriptRevision }) };
    },
  );

  tool(
    server,
    'create_episode',
    {
      title: 'Create an episode',
      description:
        'A new empty episode after the last one, with an optional title, resolution and target length in seconds. Each type with a usable image or video service is locked to it now, a type without one at its first generation; pass ids only to pin particular services.',
      input: CreateEpisode.strict(),
      output: EpisodeBrief,
    },
    (args) => brief(createEpisode(args)),
  );

  tool(
    server,
    'update_episode',
    {
      title: 'Update an episode',
      description: 'Title, synopsis (description), target length (null clears it), resolution or status. Texts are saved with save_beats, save_script and save_recap.',
      input: UpdateEpisodeInput,
      output: EpisodeBrief,
      idempotent: true,
    },
    ({ episodeId, ...patch }) => brief(updateEpisode(episodeId, patch)),
  );

  tool(
    server,
    'save_beats',
    {
      title: 'Save the beats',
      description:
        "Replaces the episode's raw content (the beat sheet, or the creator's own material) with the complete text. ifRevision is the beats revision from read_episode or get_episode; CONFLICT when it changed since. Refused while a script is being written from it.",
      input: SaveBeatsInput,
      output: TextSaved,
    },
    ({ episodeId, content, ifRevision }) => saved(episodeId, saveEpisodeText(episodeId, 'beats', content, ifRevision)),
  );

  tool(
    server,
    'save_script',
    {
      title: 'Save the script',
      description:
        "Replaces the episode's script with the complete formatted text. ifRevision is the script revision you read; CONFLICT when it changed since. A changed script makes the recap stale and the storyboard outdated; offer write_recap afterwards. Refused while an agent writes or reads the script.",
      input: SaveScriptInput,
      output: TextSaved,
    },
    ({ episodeId, scriptContent, ifRevision }) => saved(episodeId, saveEpisodeText(episodeId, 'script', scriptContent, ifRevision)),
  );

  tool(
    server,
    'save_recap',
    {
      title: 'Save the recap',
      description:
        "Replaces the episode's recap (what happened, for the writers of later episodes; up to 2000 characters) with the complete text, pinned to the current script. ifRevision is the recap revision you read; CONFLICT when it changed since. Pass forScriptRevision (the scriptRevision from the read) so a recap written for an older script is refused once the script changed. Refused while the recap writer runs.",
      input: SaveRecapInput,
      output: TextSaved,
    },
    ({ episodeId, recap, ifRevision, forScriptRevision }) => saved(episodeId, saveEpisodeText(episodeId, 'recap', recap, ifRevision, forScriptRevision)),
  );

  tool(
    server,
    'use_content_as_script',
    {
      title: 'Use the content as the script',
      description:
        "The raw content becomes the script as it is, for material that already is a formatted shooting script. A save, not a job; in a serial project it starts the recap job and returns its id. An existing script is replaced only with replace: true, after the creator agreed.",
      input: UseContentAsScriptInput,
      output: UseContentAsScriptResult,
    },
    ({ episodeId, replace }) => {
      const result = useContentAsScript(episodeId, { replace });
      return { ...result, studioPath: studioPath.episode(result.episode.dramaId, result.episode.episodeNumber) };
    },
  );

  tool(
    server,
    'delete_episode',
    {
      title: 'Delete an episode',
      description:
        'Deletes the episode (recoverable only by the server owner). Refused while one of its jobs runs, and, when it holds a script, shots or a film, until called with force: true after the creator agreed to lose them.',
      input: DeleteEpisodeInput,
      output: z.object({ id: z.number().int(), studioPath: z.string() }),
      confirm: true,
    },
    ({ episodeId, force }) => {
      const row = getEpisodeRow(episodeId);
      return { ...deleteEpisode(episodeId, { force }), studioPath: studioPath.drama(row.dramaId) };
    },
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  AssetDeleted,
  AssetList,
  AssetResult,
  CreateAssetInput,
  CreateCharacter,
  CreateProp,
  CreateScene,
  DeleteAssetInput,
  DescribeAssetInput,
  DesignAssetsInput,
  ExtractAssetsInput,
  FinalPromptWritten,
  JobStarted,
  ListAssetsInput,
  UpdateAssetInput,
  UpdateCharacter,
  UpdateProp,
  UpdateScene,
  WriteFinalPromptInput,
  type AssetKind,
} from '@open-drama/contracts';
import { invalid, precondition } from '../../http/errors';
import { describeAsset } from '../../modules/agents/services/describe';
import { startDesign } from '../../modules/agents/services/design';
import { startExtraction } from '../../modules/agents/services/extraction';
import { generateFinalPrompt, loadAssetForPrompt } from '../../modules/agents/services/final-prompt';
import {
  createCharacter,
  createProp,
  createScene,
  deleteCharacter,
  deleteProp,
  deleteScene,
  getDramaAssets,
  getEpisodeAssets,
  updateCharacter,
  updateProp,
  updateScene,
  type AssetCard,
} from '../../modules/assets/service';
import { getEpisodeRow } from '../../modules/production/episodes';
import { studioPath, tool } from '../errors';
import { BILLS } from './story';

// The assets tools (adr-0024 decision 9): thin mappings of the asset services and the designer, extractor and prompt
// generator runs. The paid image requests (generate_asset_image, the outfit picture) wait for the paid-generation
// opt-in of adr-0016; the studio's asset library draws them meanwhile.

/** The kind's own contract schema takes the fields it has and refuses the rest, as the studio's body validation does. */
function fieldsOf<S extends z.ZodType>(schema: S, kind: AssetKind, fields: object): z.output<S> {
  const result = schema.safeParse(fields);
  if (!result.success) {
    throw invalid(`Invalid ${kind}`, { issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  return result.data;
}

function create(kind: AssetKind, fields: object): AssetCard {
  if (kind === 'character') return createCharacter(fieldsOf(CreateCharacter.strict(), kind, fields));
  if (kind === 'scene') return createScene(fieldsOf(CreateScene.strict(), kind, fields));
  return createProp(fieldsOf(CreateProp.strict(), kind, fields));
}

function update(kind: AssetKind, id: number, fields: object): AssetCard {
  if (kind === 'character') return updateCharacter(id, fieldsOf(UpdateCharacter, kind, fields));
  if (kind === 'scene') return updateScene(id, fieldsOf(UpdateScene, kind, fields));
  return updateProp(id, fieldsOf(UpdateProp, kind, fields));
}

const DELETE = { character: deleteCharacter, scene: deleteScene, prop: deleteProp } satisfies Record<AssetKind, (id: number) => { id: number }>;

const result = (kind: AssetKind, asset: AssetCard) => ({ kind, asset, studioPath: studioPath.drama(asset.dramaId, 'assets') });

export function registerAssetTools(server: McpServer) {
  tool(
    server,
    'list_assets',
    {
      title: 'List the assets',
      description:
        "The project's characters, scenes and props (the asset library of the project page), or with an episodeId only those linked to that episode, each character with what it wears there (outfit). A card has the describing fields, the final prompt (finalPromptStale once a field changed since), the images (a character's views, else imagePath) and the latest image task. Its id is what the other assets tools take.",
      input: ListAssetsInput,
      output: AssetList,
      readOnly: true,
    },
    ({ dramaId, episodeId }) => {
      if (episodeId === undefined) return { ...getDramaAssets(dramaId), episodeId: null, studioPath: studioPath.drama(dramaId, 'assets') };
      const ep = getEpisodeRow(episodeId);
      if (ep.dramaId !== dramaId) throw invalid(`Episode ${episodeId} is not in project ${dramaId}`);
      const { extraction: _jobs, ...linked } = getEpisodeAssets(episodeId);
      return { dramaId, ...linked, studioPath: studioPath.episode(dramaId, ep.episodeNumber) };
    },
  );

  tool(
    server,
    'create_asset',
    {
      title: 'Create an asset',
      description:
        "A new character, scene or prop on the project, with the fields of its kind (a character or a prop needs a name, a scene a location). With episodeId it is linked to that episode too; without one it stays on the project until an episode's extraction links it by name. Refused (CONFLICT) when the name, or a scene's location and time, already exists. describe_asset fills the fields left empty.",
      input: CreateAssetInput,
      output: AssetResult,
    },
    ({ kind, ...fields }) => result(kind, create(kind, fields)),
  );

  tool(
    server,
    'update_asset',
    {
      title: 'Update an asset',
      description:
        "Changes the fields given and keeps the rest. The last write wins, as in the studio: read the asset with list_assets first. A changed describing field keeps the final prompt and marks it stale; a new name makes the shot prompts that mention it stale; a new styling or lighting makes the keyframes drawn from it stale. Refused (CONFLICT) while an image, a prompt or a description of the asset is in progress, as the studio's save is. Images are attached in the studio.",
      input: UpdateAssetInput,
      output: AssetResult,
      idempotent: true,
    },
    ({ kind, id, ...fields }) => result(kind, update(kind, id, fields)),
  );

  tool(
    server,
    'delete_asset',
    {
      title: 'Delete an asset',
      description:
        'Deletes the asset (recoverable only by the server owner): it leaves every episode and shot of the project, with its images. Refused until called with confirm: true after the creator agreed, and while one of its images is being generated (CONFLICT).',
      input: DeleteAssetInput,
      output: AssetDeleted,
      confirm: true,
    },
    ({ kind, id, confirm }) => {
      const asset = loadAssetForPrompt(kind, id);
      if (!confirm) {
        throw precondition(
          `Deleting the ${kind} "${asset.label}" removes it from every episode and shot of the project, with its images. Call again with confirm: true once the creator has agreed.`,
        );
      }
      return { kind, ...DELETE[kind](id), studioPath: studioPath.drama(asset.dramaId, 'assets') };
    },
  );

  tool(
    server,
    'design_assets',
    {
      title: 'Design assets from the story',
      description: `The asset designer designs one kind for the whole project from its story (premise, outline, episode synopses and recaps): characters (the cast the outline names, each with a role, an appearance and a styling), scenes (the places of its world at a time of day, with set dressing and lighting) or props (the few objects a thread turns on; none is a valid result). ${BILLS} Nothing existing is overwritten: a name already on the project only gets its empty fields filled. Start each kind once; the three run side by side. Refused without an outline and while the outline is being written. The outcome counts what was saved and filled and names what was skipped or did not fit (at most 12 characters, 10 scenes, 5 props per run).`,
      input: DesignAssetsInput,
      output: JobStarted.extend({ studioPath: z.string() }),
    },
    ({ dramaId, target, ...opts }) => ({ ...startDesign(dramaId, target, opts), studioPath: studioPath.drama(dramaId, 'story') }),
  );

  tool(
    server,
    'extract_assets',
    {
      title: 'Extract assets from a script',
      description: `The extractor reads the episode's script and saves one kind: the characters seen, the scenes (each place at a time of day) or the plot-critical props (none to three). ${BILLS} An asset already on the project, designed or made by hand, is linked by its name instead of being added again and only its empty fields are filled; a character the script shows in other clothes is dressed for this episode. Start each kind once; the three run side by side. Needs a finished script, and is refused while an agent writes it. list_assets with the episodeId shows the result.`,
      input: ExtractAssetsInput,
      output: JobStarted.extend({ studioPath: z.string() }),
    },
    ({ episodeId, target, ...opts }) => {
      const ep = getEpisodeRow(episodeId);
      return { ...startExtraction(episodeId, target, opts), studioPath: studioPath.episode(ep.dramaId, ep.episodeNumber) };
    },
  );

  tool(
    server,
    'describe_asset',
    {
      title: 'Describe an asset',
      description:
        "The asset designer writes one asset's describing fields from the story (character: role, appearance, styling, description; scene: prompt, lighting; prop: type, description), in the request, billing the configured text service once; a name, or a scene's location and time, is never changed. Without replace it fills only the empty fields and is refused (CONFLICT) when none is empty; replace: true rewrites them all, after the creator agreed. Refused while an image, a prompt or another description of the asset is in progress, and while a design run of its kind runs. A changed field marks the final prompt stale.",
      input: DescribeAssetInput,
      output: AssetResult,
    },
    async ({ kind, id, ...opts }) => result(kind, await describeAsset(kind, id, opts)),
  );

  tool(
    server,
    'write_final_prompt',
    {
      title: 'Write the image prompt',
      description:
        "The prompt generator writes the asset's image prompt from its fields (the project's visual style prefixed) and saves it, in the request, billing the configured text service once; nothing is drawn. An up-to-date prompt is returned as it is unless replace: true, after the creator agreed. With episodeId it is written in that episode's context, without one in the project's. The images are drawn in the studio's asset library.",
      input: WriteFinalPromptInput,
      output: FinalPromptWritten,
    },
    async ({ kind, id, replace, ...opts }) => {
      const finalPrompt = await generateFinalPrompt(kind, id, { ...opts, force: replace });
      return { kind, id, finalPrompt, studioPath: studioPath.drama(loadAssetForPrompt(kind, id).dramaId, 'assets') };
    },
  );
}

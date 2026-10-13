import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CreateDrama, Drama, DramaDetail, DramaJobs, DramaListQuery, DramaListResponse, SaveOutlineInput, TextSaved, UpdateDramaInput } from '@open-drama/contracts';
import { getDramaJobs } from '../../modules/jobs/run-job';
import { createDrama, getDramaDetail, listDramas, saveOutlineText, updateDrama } from '../../modules/production/dramas';
import { studioPath, tool } from '../errors';

const withPath = z.object({ studioPath: z.string() });

export function registerDramaTools(server: McpServer) {
  tool(
    server,
    'list_dramas',
    {
      title: 'List projects',
      description: "The creator's projects (dramas), most recently updated first, with episode and asset counts. Filter by status or a title search.",
      input: DramaListQuery.strict(),
      output: DramaListResponse,
      readOnly: true,
    },
    (args) => listDramas(args),
  );

  tool(
    server,
    'get_drama',
    {
      title: 'Get a project',
      description:
        'One project with its story outline (and outlineRevision, needed to save it), its episodes (title, synopsis, what each holds, revisions) and the outline and plan jobs.',
      input: z.strictObject({ dramaId: z.number().int().positive().describe('The project (drama) id') }),
      output: z.object({ drama: DramaDetail.extend(withPath.shape), jobs: DramaJobs }),
      readOnly: true,
    },
    ({ dramaId }) => ({ drama: { ...getDramaDetail(dramaId), studioPath: studioPath.drama(dramaId) }, jobs: getDramaJobs(dramaId) }),
  );

  tool(
    server,
    'create_drama',
    {
      title: 'Create a project',
      description:
        'A new project: title, description (the logline and tone), genre, tags, visual style (a preset value from list_style_presets), aspect ratio, and serial (true when the episodes continue one story and get recaps).',
      input: CreateDrama.strict(),
      output: Drama.extend(withPath.shape),
    },
    (args) => {
      const drama = createDrama(args);
      return { ...drama, studioPath: studioPath.drama(drama.id) };
    },
  );

  tool(
    server,
    'update_drama',
    {
      title: 'Update a project',
      description: 'Title, description, genre, tags, style, status or serial. The outline is saved with save_outline.',
      input: UpdateDramaInput,
      output: Drama.extend(withPath.shape),
      idempotent: true,
    },
    ({ dramaId, ...patch }) => ({ ...updateDrama(dramaId, patch), studioPath: studioPath.drama(dramaId) }),
  );

  tool(
    server,
    'save_outline',
    {
      title: 'Save the outline',
      description:
        "Replaces the project's story outline with the complete text given. ifRevision is the outlineRevision from get_drama; the save is refused with CONFLICT when the outline changed since (read it again). Refused while the story writer is writing it.",
      input: SaveOutlineInput,
      output: TextSaved,
    },
    ({ dramaId, outline, ifRevision }) => ({ ...saveOutlineText(dramaId, outline, ifRevision), studioPath: studioPath.drama(dramaId) }),
  );
}

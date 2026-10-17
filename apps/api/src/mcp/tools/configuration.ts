import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  AddModelServiceNoKey,
  AppSettingsView,
  CatalogBrowse,
  CatalogModel,
  ContentLanguage,
  CreateStylePreset,
  McpStatus,
  ModelService,
  ModelServiceListQuery,
  ModelServiceProbe,
  QUICK_SETUP_TEMPLATES,
  StylePreset,
  TestSavedModelService,
  UpdateModelServiceNoKey,
  UpdateStylePreset,
  type RequiredServiceType,
} from '@open-drama/contracts';
import { env } from '../../env';
import { listAssistantSkills } from '../../modules/agents/workspace/assistant';
import { apiBaseUrl } from '../../modules/configuration/assistant';
import { browseModelRunnerCatalog } from '../../modules/configuration/catalog';
import { createStylePreset, deleteStylePreset, listStylePresets, updateStylePreset } from '../../modules/configuration/presets';
import { getReadiness } from '../../modules/configuration/readiness';
import { ENVIRONMENT_KEYS } from '../../modules/configuration/seed';
import { addModelService, deleteModelService, listModelServices, testSavedModelService, updateModelService } from '../../modules/configuration/services';
import { getAppSettings, updateAppSettings } from '../../modules/configuration/settings';
import { getDramaStats } from '../../modules/production/dramas';
import { tool } from '../errors';

/** What each missing service type blocks: the story room runs on text alone (adr-0016). */
const BLOCKS: Record<RequiredServiceType, string[]> = {
  text: ['story outline', 'episode plan', 'scripts', 'recaps', 'asset extraction', 'storyboard breakdown', 'video prompts'],
  image: ['reference images of characters, scenes and props'],
  video: ['shot videos'],
};

/**
 * The one command that adds a key to a saved service without the key passing through the assistant: read from the
 * creator's terminal without echo, sent straight to the API, dropped from the shell afterwards. It names the API's
 * address on the server's own machine, since only /mcp may be published to the outside.
 */
export const keyCommand = (serviceId: number | '<id>') =>
  `read -rsp 'API key: ' KEY && echo && curl -sS -X PATCH ${apiBaseUrl()}/model-services/${serviceId} -H 'Content-Type: application/json' -d "{\\"apiKey\\":\\"$KEY\\"}" && unset KEY`;

const Settings = AppSettingsView.pick({ contentLanguage: true });

export function registerConfigurationTools(server: McpServer, lang: ContentLanguage) {
  tool(
    server,
    'get_status',
    {
      title: 'Status',
      description:
        'Start here. Version, readiness (which service types are missing and what each blocks; a text service is enough for the story room), the studio address or null when no web interface runs, the content language, project counts, the assistant skills available and any skipped, the quick-setup gateways with the environment variable that seeds them, and the command that adds a key to a saved service (addressed to the API on the server\'s own machine: the creator runs it there, or changes the address to one that reaches the API).',
      input: z.strictObject({}),
      output: McpStatus,
      readOnly: true,
    },
    () => {
      const readiness = getReadiness();
      const { skills, skipped } = listAssistantSkills(lang);
      return {
        version: env.OPEN_DRAMA_VERSION,
        readiness: { ...readiness, blocks: readiness.missingTypes.map((type) => ({ type, stages: BLOCKS[type] })) },
        studio: env.OPEN_DRAMA_WEB_UI ? (env.PUBLIC_BASE_URL ?? env.WEB_ORIGIN).replace(/\/+$/, '') : null,
        contentLanguage: getAppSettings().contentLanguage,
        projects: getDramaStats(),
        skills: skills.map((s) => ({ name: s.name, title: s.title })),
        skippedSkills: skipped,
        quickSetup: QUICK_SETUP_TEMPLATES.map((t) => ({ gateway: t.gateway, label: t.label, environmentVariable: ENVIRONMENT_KEYS[t.gateway] ?? null })),
        keyCommand: keyCommand('<id>'),
      };
    },
  );

  tool(
    server,
    'list_model_services',
    {
      title: 'List model services',
      description: 'The configured text, image and video services with provider, address, models, priority, whether active and whether a key is stored (hasKey). The key itself is never shown. activeOnly narrows to active ones.',
      input: ModelServiceListQuery.strict(),
      output: z.object({ services: z.array(ModelService) }),
      readOnly: true,
    },
    (args) => ({ services: listModelServices(args) }),
  );

  tool(
    server,
    'browse_model_catalog',
    {
      title: 'Browse the ModelRunner catalog',
      description: "ModelRunner's public catalog of the models this app can drive for a service type, with prices in US dollars; no key needed. query filters by a substring of the id or name; limit caps the list (default 20).",
      input: CatalogBrowse,
      output: z.object({ models: z.array(CatalogModel), total: z.number().int() }),
      readOnly: true,
    },
    async ({ type, query, limit }) => {
      const all = await browseModelRunnerCatalog(type);
      const q = query?.toLowerCase();
      const matching = q ? all.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)) : all;
      return { models: matching.slice(0, limit), total: matching.length };
    },
  );

  tool(
    server,
    'add_model_service',
    {
      title: 'Add a model service',
      description:
        'A new service without its key: type, provider, name, base URL, model ids, priority. It is listed with hasKey: false and is not usable until the creator adds the key in the studio or runs the keyCommand in the result on the server\'s machine (the key is read from their terminal; never ask for it in chat; the address in the command is the API\'s local one and may need changing where the creator runs it). Then test_model_service.',
      input: AddModelServiceNoKey,
      output: z.object({ service: ModelService, keyCommand: z.string() }),
    },
    (args) => {
      const service = addModelService(args);
      return { service, keyCommand: keyCommand(service.id) };
    },
  );

  tool(
    server,
    'update_model_service',
    {
      title: 'Update a model service',
      description: 'Name, provider, base URL, models (the first is the default), priority, active or settings of a saved service. A key is never passed here; a changed address or provider needs the key entered again by the creator.',
      input: UpdateModelServiceNoKey,
      output: ModelService,
      idempotent: true,
    },
    ({ id, ...patch }) => updateModelService(id, patch),
  );

  tool(
    server,
    'delete_model_service',
    {
      title: 'Delete a model service',
      description: 'Removes the service and its stored key. Episodes that locked it fall back to the active service of the same type. Refused while one of its generations runs. Only when the creator asks.',
      input: z.strictObject({ id: z.number().int().positive().describe('The service id') }),
      output: z.object({ id: z.number().int() }),
      confirm: true,
    },
    ({ id }) => deleteModelService(id),
  );

  tool(
    server,
    'test_model_service',
    {
      title: 'Test a model service',
      description: 'Probes a saved service with its stored key (one small request to the provider): reachable, key accepted, default model available, latency. model overrides the default model for this probe.',
      input: TestSavedModelService,
      output: ModelServiceProbe,
    },
    ({ id, model }) => testSavedModelService(id, model),
  );

  tool(
    server,
    'list_style_presets',
    {
      title: 'List visual styles',
      description: 'The visual style presets a project can use (value, name, the prompt fragment, whether built in or active). all: true includes disabled ones.',
      input: z.strictObject({ all: z.boolean().default(false) }),
      output: z.object({ presets: z.array(StylePreset) }),
      readOnly: true,
    },
    ({ all }) => ({ presets: listStylePresets(all) }),
  );

  tool(
    server,
    'create_style_preset',
    {
      title: 'Create a visual style',
      description: 'A new style preset: a value (lowercase identifier), a name, the prompt fragment prepended to every image and video prompt, and a description.',
      input: CreateStylePreset.strict(),
      output: StylePreset,
    },
    (args) => createStylePreset(args),
  );

  tool(
    server,
    'update_style_preset',
    {
      title: 'Update a visual style',
      description: 'Name, prompt, description or active of a style preset.',
      input: UpdateStylePreset.extend({ id: z.number().int().positive().describe('The preset id') }).strict(),
      output: StylePreset,
      idempotent: true,
    },
    ({ id, ...patch }) => updateStylePreset(id, patch),
  );

  tool(
    server,
    'delete_style_preset',
    {
      title: 'Delete a visual style',
      description: 'Removes a style preset. Refused for built-in presets and for one a project uses. Only when the creator asks.',
      input: z.strictObject({ id: z.number().int().positive().describe('The preset id') }),
      output: z.object({ id: z.number().int() }),
      confirm: true,
    },
    ({ id }) => deleteStylePreset(id),
  );

  tool(
    server,
    'get_settings',
    {
      title: 'Get the settings',
      description: 'The content language the agents write in.',
      input: z.strictObject({}),
      output: Settings,
      readOnly: true,
    },
    () => ({ contentLanguage: getAppSettings().contentLanguage }),
  );

  tool(
    server,
    'update_settings',
    {
      title: 'Update the settings',
      description: 'Sets the content language (en, zh, ja, ko) the agents write in.',
      input: z.strictObject({ contentLanguage: ContentLanguage }),
      output: Settings,
      idempotent: true,
    },
    ({ contentLanguage }) => ({ contentLanguage: updateAppSettings({ contentLanguage }).contentLanguage }),
  );
}

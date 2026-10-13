import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EpisodeTextPart, type ContentLanguage } from '@open-drama/contracts';
import { invalid } from '../http/errors';
import { listAssistantSkills, readAssistantDoc, readAssistantSkill } from '../modules/agents/workspace/assistant';
import { readOutline } from '../modules/production/dramas';
import { readEpisodeText } from '../modules/production/episodes';

const MARKDOWN = 'text/markdown';
const text = (uri: URL, body: string, mimeType = MARKDOWN) => ({ contents: [{ uri: uri.href, mimeType, text: body }] });

const FALLBACK_GUIDE =
  'Open Drama turns a story into a short drama: project → outline → planned episodes → scripts → recaps → assets → storyboard → shot videos → film. The guide document (workspace/assistant/guide.md) is missing from this workspace.';

const idOf = (value: string | string[] | undefined, what: string) => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(n) || n <= 0) throw invalid(`Invalid ${what} id in the resource address`);
  return n;
};

/**
 * Texts an assistant can attach by address (adr-0016): the guide, the assistant skills, a project's outline and an
 * episode's beats, script or recap. The texts carry their revision in the content so an edit can be saved afterwards.
 */
export function registerResources(server: McpServer, lang: ContentLanguage) {
  server.registerResource(
    'guide',
    'open-drama://guide',
    { title: 'How Open Drama works', description: 'The pipeline stages, jobs, locks and vocabulary, for the assistant.', mimeType: MARKDOWN },
    (uri) => text(uri, readAssistantDoc('guide', lang) ?? FALLBACK_GUIDE),
  );

  server.registerResource(
    'skill',
    new ResourceTemplate('open-drama://skills/{name}', {
      list: () => ({
        resources: listAssistantSkills(lang).skills.map((s) => ({ uri: `open-drama://skills/${s.name}`, name: s.name, title: s.title, description: s.description, mimeType: MARKDOWN })),
      }),
    }),
    { title: 'Assistant skill', description: 'One of the assistant skills, as a document.', mimeType: MARKDOWN },
    (uri, { name }) => {
      const skill = readAssistantSkill(String(Array.isArray(name) ? name[0] : name), lang);
      if (!skill) throw invalid(`No assistant skill named ${String(name)}`);
      return text(uri, `# ${skill.title}\n\n${skill.description}\n\n${skill.body}`);
    },
  );

  server.registerResource(
    'outline',
    new ResourceTemplate('open-drama://dramas/{id}/outline', { list: undefined }),
    { title: 'Project outline', description: "A project's story outline with its revision.", mimeType: MARKDOWN },
    (uri, { id }) => {
      const outline = readOutline(idOf(id, 'project'));
      return text(uri, `<!-- outlineRevision: ${outline.revision} -->\n${outline.text}`);
    },
  );

  server.registerResource(
    'episode-text',
    new ResourceTemplate('open-drama://episodes/{id}/{part}', { list: undefined, complete: { part: () => EpisodeTextPart.options } }),
    { title: 'Episode text', description: "An episode's beats, script or recap with its revision.", mimeType: 'text/plain' },
    (uri, { id, part }) => {
      const parsed = EpisodeTextPart.safeParse(Array.isArray(part) ? part[0] : part);
      if (!parsed.success) throw invalid('The part must be beats, script or recap');
      const read = readEpisodeText(idOf(id, 'episode'), parsed.data);
      const against = read.scriptRevision === undefined ? '' : `; scriptRevision: ${read.scriptRevision}`;
      return text(uri, `<!-- ${parsed.data} revision: ${read.revision}${against} -->\n${read.text}`, 'text/plain');
    },
  );
}

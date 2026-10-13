#!/usr/bin/env node
// Writes plugins/open-drama/, a Claude Code plugin whose skills are the assistant skills under workspace/assistant/
// (one source, adr-0016) and whose MCP server entry takes the server address and token from the installer's
// user config. Run after editing a skill: `node scripts/build-plugin.mjs`. Nothing here runs at serve time.
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'workspace', 'assistant');
const OUT = join(ROOT, 'plugins', 'open-drama');
const { version } = JSON.parse(readFileSync(join(ROOT, 'apps', 'api', 'package.json'), 'utf8'));

/** The frontmatter block and the body of a skill document. */
function parse(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  let args = null;
  for (const line of match[1].split(/\r?\n/)) {
    const top = /^(\w+):\s*(.*)$/.exec(line);
    if (top) {
      if (top[1] === 'arguments') {
        args = [];
        meta.arguments = args;
      } else meta[top[1]] = top[2].replace(/^["']|["']$/g, '');
      continue;
    }
    const item = /^\s+-\s+name:\s*(.*)$/.exec(line);
    if (item && args) args.push({ name: item[1].trim() });
    const field = /^\s+(description|required):\s*(.*)$/.exec(line);
    if (field && args?.length) args[args.length - 1][field[1]] = field[1] === 'required' ? field[2].trim() === 'true' : field[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: match[2] };
}

const yaml = (s) => JSON.stringify(s);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, '.claude-plugin'), { recursive: true });
mkdirSync(join(OUT, 'skills'), { recursive: true });

const names = readdirSync(SOURCE).filter((n) => statSync(join(SOURCE, n)).isDirectory() && /^[a-z][a-z0-9-]*$/.test(n));
for (const name of names) {
  const { meta, body } = parse(readFileSync(join(SOURCE, name, 'SKILL.md'), 'utf8'));
  const args = meta.arguments ?? [];
  // A plugin skill takes its arguments as one $ARGUMENTS string; the body's placeholders are filled from it in order.
  const hint = args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ');
  const rendered = args.length
    ? `${body.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_m, key) => `$${key.toUpperCase()}`)}\n\nArguments given: $ARGUMENTS${args.map((a) => `\n- ${a.name}: ${a.description}${a.required ? '' : ' (optional)'} → use it where $${a.name.toUpperCase()} appears above; "(not given)" when absent.`).join('')}\n`
    : body;
  const front = ['---', `name: ${name}`, `description: ${yaml(meta.description ?? name)}`, ...(hint ? [`argument-hint: ${yaml(hint)}`] : []), '---', ''].join('\n');
  mkdirSync(join(OUT, 'skills', name), { recursive: true });
  writeFileSync(join(OUT, 'skills', name, 'SKILL.md'), front + rendered);
}

writeFileSync(
  join(OUT, '.claude-plugin', 'plugin.json'),
  JSON.stringify(
    {
      name: 'open-drama',
      version,
      description: 'Run the Open Drama story room from Claude Code: create projects, write outlines, plan episodes, write and review scripts, over the server you host.',
      author: { name: 'Open Drama' },
      keywords: ['open-drama', 'short-drama', 'story', 'mcp'],
      userConfig: {
        server_url: {
          type: 'string',
          title: 'Open Drama server address',
          description: 'Where your Open Drama server is reached, without a trailing slash (for example http://localhost:3000).',
          required: true,
          default: 'http://localhost:3000',
        },
        api_token: {
          type: 'string',
          title: 'Assistant access token',
          description: 'From Settings › Assistant in the studio, or GET /api/v1/settings/assistant on the server.',
          required: true,
          sensitive: true,
        },
      },
    },
    null,
    2,
  ) + '\n',
);

writeFileSync(
  join(OUT, '.mcp.json'),
  JSON.stringify(
    {
      'open-drama': {
        type: 'http',
        url: '${user_config.server_url}/mcp',
        headers: { Authorization: 'Bearer ${user_config.api_token}' },
      },
    },
    null,
    2,
  ) + '\n',
);

writeFileSync(
  join(OUT, 'README.md'),
  `# Open Drama for Claude Code

Generated from \`workspace/assistant/\` by \`node scripts/build-plugin.mjs\`; edit the skills there, not here.

Install from this repository's marketplace, then give the plugin your server address and the assistant token from
Settings › Assistant:

\`\`\`
/plugin marketplace add <path or git url of this repository>
/plugin install open-drama
\`\`\`

The skills (${names.map((n) => `\`/open-drama:${n}\``).join(', ')}) call the server's MCP tools; nothing runs locally.
`,
);

mkdirSync(join(ROOT, '.claude-plugin'), { recursive: true });
writeFileSync(
  join(ROOT, '.claude-plugin', 'marketplace.json'),
  JSON.stringify(
    {
      name: 'open-drama',
      owner: { name: 'Open Drama' },
      metadata: { description: 'Open Drama, an open self-hostable AI short-drama studio, for Claude Code.' },
      plugins: [{ name: 'open-drama', source: './plugins/open-drama', description: 'Run the Open Drama story room from Claude Code over your own server.', version }],
    },
    null,
    2,
  ) + '\n',
);

console.log(`plugin written to plugins/open-drama (${names.length} skills: ${names.join(', ')}), marketplace at .claude-plugin/marketplace.json`);

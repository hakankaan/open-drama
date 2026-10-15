import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { env } from '../../../env';
import { WORKSPACE_TEMPLATE_DIR } from '../../../lib/roots';

const MARKER = '.template-version';
/** Every version each template file shipped in, as sha-256 (scripts/template-history.mjs). */
const HISTORY = '.template-history.json';

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const readVersion = (dir: string) => {
  const file = join(dir, MARKER);
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
};

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

function readHistory(): Record<string, string[]> {
  const file = join(WORKSPACE_TEMPLATE_DIR, HISTORY);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>) : {};
}

/**
 * Copies the prompt/skill templates into the writable workspace. The first boot copies everything. A newer template
 * version adds missing files and replaces a file the creator never edited (its content is one the template shipped,
 * adr-0017); an edited file is kept as it is and reported.
 */
export function ensureWorkspace(): { copied: number; updated: number; kept: string[]; version: string | null } {
  mkdirSync(env.workspaceDir, { recursive: true });
  if (!existsSync(WORKSPACE_TEMPLATE_DIR)) return { copied: 0, updated: 0, kept: [], version: null };
  const templateVersion = readVersion(WORKSPACE_TEMPLATE_DIR);
  if (templateVersion !== null && readVersion(env.workspaceDir) === templateVersion) {
    return { copied: 0, updated: 0, kept: [], version: templateVersion };
  }
  const history = readHistory();
  let copied = 0;
  let updated = 0;
  const kept: string[] = [];
  for (const src of walk(WORKSPACE_TEMPLATE_DIR)) {
    const rel = relative(WORKSPACE_TEMPLATE_DIR, src);
    if (rel === MARKER || rel === HISTORY) continue;
    const dest = join(env.workspaceDir, rel);
    const stat = lstatSync(dest, { throwIfNoEntry: false });
    if (!stat) {
      cpSync(src, dest);
      copied++;
      continue;
    }
    // A link the creator put in place is theirs: never written through.
    if (stat.isSymbolicLink()) {
      kept.push(rel);
      continue;
    }
    const current = sha256(dest);
    if (current === sha256(src)) continue;
    if (history[rel.split(sep).join('/')]?.includes(current)) {
      cpSync(src, dest);
      updated++;
    } else kept.push(rel);
  }
  if (templateVersion !== null) writeFileSync(join(env.workspaceDir, MARKER), templateVersion + '\n');
  return { copied, updated, kept, version: templateVersion };
}

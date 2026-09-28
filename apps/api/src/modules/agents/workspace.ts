import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { env } from '../../env';
import { WORKSPACE_TEMPLATE_DIR } from '../../lib/roots';

const MARKER = '.template-version';

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

/**
 * Copy-once of the prompt/skill templates into the writable workspace. The first boot copies everything;
 * a newer template version only adds files that are missing, so the creator's edits are never overwritten.
 */
export function ensureWorkspace(): { copied: number; version: string | null } {
  mkdirSync(env.workspaceDir, { recursive: true });
  if (!existsSync(WORKSPACE_TEMPLATE_DIR)) return { copied: 0, version: null };
  const templateVersion = readVersion(WORKSPACE_TEMPLATE_DIR);
  if (templateVersion !== null && readVersion(env.workspaceDir) === templateVersion) {
    return { copied: 0, version: templateVersion };
  }
  let copied = 0;
  for (const src of walk(WORKSPACE_TEMPLATE_DIR)) {
    const rel = relative(WORKSPACE_TEMPLATE_DIR, src);
    if (rel === MARKER) continue;
    const dest = join(env.workspaceDir, rel);
    if (existsSync(dest)) continue;
    cpSync(src, dest);
    copied++;
  }
  if (templateVersion !== null) writeFileSync(join(env.workspaceDir, MARKER), templateVersion + '\n');
  return { copied, version: templateVersion };
}

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walks up from this module to the directory whose package.json is the API package (works from src/ and dist/). */
function findApiRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg) && (JSON.parse(readFileSync(pkg, 'utf8')) as { name?: string }).name === '@open-drama/api') {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Cannot locate the @open-drama/api package root');
    dir = parent;
  }
}

export const API_ROOT = findApiRoot();
export const REPO_ROOT = join(API_ROOT, '..', '..');
export const MIGRATIONS_DIR = join(API_ROOT, 'drizzle');
export const WORKSPACE_TEMPLATE_DIR = join(REPO_ROOT, 'workspace');

export const API_VERSION = (JSON.parse(readFileSync(join(API_ROOT, 'package.json'), 'utf8')) as { version: string })
  .version;

#!/usr/bin/env node
// Writes workspace/.template-history.json: the sha-256 of every version each agent-workspace template file has
// shipped in, read from git history plus the working tree. On a template version bump the API replaces a creator's
// copy whose hash is listed (never edited) and keeps an edited one (adr-0017). Run after changing a file under
// workspace/: `node scripts/template-history.mjs`; `--check` (part of `pnpm lint`) fails when a current file is missing.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'workspace');
const OUT = join(DIR, '.template-history.json');
const SKIP = new Set(['.template-version', '.template-history.json']);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const files = [...walk(DIR)].map((full) => ({ full, rel: relative(DIR, full).split(sep).join('/') })).filter((f) => !SKIP.has(f.rel));
const known = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

if (process.argv.includes('--check')) {
  const missing = files.filter((f) => !known[f.rel]?.includes(hash(readFileSync(f.full)))).map((f) => f.rel);
  if (missing.length > 0) {
    console.error(`Template files changed without their hash recorded: ${missing.join(', ')}\nRun: node scripts/template-history.mjs`);
    process.exit(1);
  }
  process.exit(0);
}

const history = {};
for (const { full, rel } of files) {
  // Hashes already listed stay, so a shallow clone never drops a version that shipped.
  const hashes = new Set([...(known[rel] ?? []), hash(readFileSync(full))]);
  for (const commit of git('log', '--format=%H', '--', `workspace/${rel}`).toString().split('\n').filter(Boolean)) {
    try {
      hashes.add(hash(git('show', `${commit}:workspace/${rel}`)));
    } catch {
      // The commit deleted the file.
    }
  }
  history[rel] = [...hashes].sort();
}
writeFileSync(OUT, JSON.stringify(history, null, 2) + '\n');
console.log(`Recorded ${Object.values(history).flat().length} versions of ${files.length} template files in ${relative(ROOT, OUT)}`);

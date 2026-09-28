import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { ContentLanguage, SkillId } from '@open-drama/contracts';
import { env } from '../../../env';
import { invalid } from '../../../http/errors';

/**
 * Every workspace read and write goes through here: paths are resolved against WORKSPACE_PATH and anything that
 * escapes it is refused, so agent-facing and UI-facing file operations are jailed.
 */
export function workspacePath(rel: string): string {
  const abs = resolve(env.workspaceDir, rel);
  const r = relative(env.workspaceDir, abs);
  if (r === '' || r.startsWith('..') || isAbsolute(r)) throw invalid('Path is outside the workspace');
  return abs;
}

export const readText = (rel: string): string | null => {
  const abs = workspacePath(rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
};

export function writeText(rel: string, content: string): void {
  const abs = workspacePath(rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

export const removeFile = (rel: string) => rmSync(workspacePath(rel), { force: true });
export const removeDir = (rel: string) => rmSync(workspacePath(rel), { recursive: true, force: true });

/** `?lang` is validated before it ever becomes part of a file name. */
export function checkedLang(lang: string): ContentLanguage {
  const parsed = ContentLanguage.safeParse(lang);
  if (!parsed.success) throw invalid(`Unknown language: ${lang}`);
  return parsed.data;
}

export function checkedSkillId(id: string): string {
  const parsed = SkillId.safeParse(id);
  if (!parsed.success) throw invalid(`Invalid skill id: ${id}`);
  return parsed.data;
}

/** `file.md` for English, `file.<lang>.md` for a variant. */
export const variantName = (base: string, lang: ContentLanguage) =>
  lang === 'en' ? `${base}.md` : `${base}.${lang}.md`;

// Frontmatter documents (prompt files and skills)

export interface Doc {
  meta: Record<string, unknown>;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseDoc(text: string): Doc {
  const match = FRONTMATTER.exec(text);
  if (!match) return { meta: {}, body: text.trim() };
  let meta: Record<string, unknown> = {};
  try {
    const parsed: unknown = parse(match[1] ?? '');
    if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>;
  } catch {
    // A broken frontmatter is treated as none; the body still loads.
  }
  return { meta, body: text.slice(match[0].length).trim() };
}

export function serializeDoc({ meta, body }: Doc): string {
  const entries = Object.entries(meta).filter(([, v]) => v !== undefined && v !== null && v !== '');
  const head = entries.length > 0 ? `---\n${stringify(Object.fromEntries(entries)).trimEnd()}\n---\n\n` : '';
  return `${head}${body.trim()}\n`;
}

export const metaString = (meta: Record<string, unknown>, key: string) => {
  const v = meta[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/** Relative paths of every directory under `rel` that contains a SKILL.md. */
export function findSkillDirs(rel: string): string[] {
  const root = workspacePath(rel);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = join(dir, entry.name);
      if (existsSync(join(full, 'SKILL.md'))) out.push(relative(root, full).split(/[\\/]/).join('/'));
      walk(full);
    }
  };
  walk(root);
  return out.sort();
}

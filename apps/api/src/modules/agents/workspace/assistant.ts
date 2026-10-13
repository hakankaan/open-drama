import { AssistantSkillMeta, type AssistantSkillSummary, type ContentLanguage } from '@open-drama/contracts';
import { z } from 'zod';
import { logger } from '../../../http/logger';
import { findSkillDirs, parseDoc, readText, variantName } from './files';

// The assistant skills (adr-0016): Markdown under workspace/assistant/, written for the creator's AI assistant and
// served from this one source as MCP prompts and resources. Not the agents' skills under workspace/skills/.

const ROOT = 'assistant';
/** A skill directory name doubles as the prompt's identifier, so it is kept to a safe shape. */
const NAME = /^[a-z][a-z0-9-]{0,60}$/;

export interface AssistantSkill extends AssistantSkillSummary {
  /** The body with `{{argument}}` placeholders still in place. */
  body: string;
}

export interface SkippedSkill {
  name: string;
  reason: string;
}

const skillFile = (name: string, lang: ContentLanguage) => `${ROOT}/${name}/${variantName('SKILL', lang)}`;

/** The directories directly under assistant/ that hold a SKILL.md; nested ones are a skill's own material. */
const skillNames = () => findSkillDirs(ROOT).filter((rel) => !rel.includes('/'));

const warned = new Set<string>();
/** A malformed document is reported once per reason, not on every prompts/list. */
function warnOnce(name: string, reason: string) {
  const key = `${name}:${reason}`;
  if (warned.has(key)) return;
  warned.add(key);
  logger.warn({ skill: name }, `assistant skill skipped: ${reason}`);
}

/**
 * One skill in a language: the variant file's body when it exists, else English; the frontmatter is the English
 * one with the variant's fields over it, validated as a whole. Null (and a reason) when the document is malformed.
 */
function load(name: string, lang: ContentLanguage): { skill: AssistantSkill } | { skipped: SkippedSkill } {
  if (!NAME.test(name)) return { skipped: { name, reason: 'the directory name must be lowercase letters, digits and hyphens' } };
  const baseText = readText(skillFile(name, 'en'));
  if (baseText === null) return { skipped: { name, reason: 'SKILL.md is missing' } };
  const base = parseDoc(baseText);
  const variantText = lang === 'en' ? null : readText(skillFile(name, lang));
  const variant = variantText !== null ? parseDoc(variantText) : null;
  const meta = AssistantSkillMeta.safeParse({ ...base.meta, ...(variant?.meta ?? {}) });
  if (!meta.success) return { skipped: { name, reason: `frontmatter: ${z.prettifyError(meta.error).split('\n')[0] ?? 'invalid'}` } };
  const body = (variant ?? base).body;
  if (!body.trim()) return { skipped: { name, reason: 'the body is empty' } };
  return { skill: { name, ...meta.data, body, lang, variant: variant !== null } };
}

/** Every assistant skill in the language, and the documents skipped with the reason (named by get_status). */
export function listAssistantSkills(lang: ContentLanguage): { skills: AssistantSkill[]; skipped: SkippedSkill[] } {
  const skills: AssistantSkill[] = [];
  const skipped: SkippedSkill[] = [];
  for (const name of skillNames()) {
    const loaded = load(name, lang);
    if ('skill' in loaded) skills.push(loaded.skill);
    else {
      skipped.push(loaded.skipped);
      warnOnce(name, loaded.skipped.reason);
    }
  }
  return { skills, skipped };
}

export function readAssistantSkill(name: string, lang: ContentLanguage): AssistantSkill | null {
  if (!NAME.test(name)) return null;
  const loaded = load(name, lang);
  return 'skill' in loaded ? loaded.skill : null;
}

/** The skill's body with each `{{argument}}` replaced by the value given, or a marker when none was. */
export function renderSkill(skill: AssistantSkill, args: Record<string, string | undefined>): string {
  return skill.body.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_m, key: string) => args[key]?.trim() || '(not given)');
}

/** A document beside the skills (instructions.md, guide.md) in the language, else English, else null. */
export function readAssistantDoc(base: 'instructions' | 'guide', lang: ContentLanguage): string | null {
  const text = (lang === 'en' ? null : readText(`${ROOT}/${variantName(base, lang)}`)) ?? readText(`${ROOT}/${base}.md`);
  return text === null ? null : parseDoc(text).body;
}

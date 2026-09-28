import { existsSync } from 'node:fs';
import type { ContentLanguage, Skill, SkillSummary } from '@open-drama/contracts';
import { conflict, notFound } from '../../../http/errors';
import { agentOfSkill } from '../agents/definitions';
import {
  checkedSkillId,
  findSkillDirs,
  metaString,
  parseDoc,
  readText,
  removeDir,
  removeFile,
  serializeDoc,
  workspacePath,
  writeText,
} from './files';

const skillFile = (id: string, lang: ContentLanguage) => `skills/${id}/${lang === 'en' ? 'SKILL.md' : `SKILL.${lang}.md`}`;

/** SkillCatalog. Scanned on every call, so skill directories created or deleted take effect on the next run. */
export function listSkills(lang: ContentLanguage): SkillSummary[] {
  return findSkillDirs('skills').map((id) => {
    const base = parseDoc(readText(skillFile(id, 'en')) ?? '');
    const variantText = lang === 'en' ? null : readText(skillFile(id, lang));
    const doc = variantText !== null ? parseDoc(variantText) : base;
    return {
      id,
      name: metaString(doc.meta, 'name') ?? metaString(base.meta, 'name') ?? id,
      description: metaString(doc.meta, 'description') ?? metaString(base.meta, 'description') ?? '',
      agent: agentOfSkill(id),
      hasVariant: variantText !== null,
    };
  });
}

export function readSkill(rawId: string, lang: ContentLanguage): Skill {
  const id = checkedSkillId(rawId);
  const baseText = readText(skillFile(id, 'en'));
  if (baseText === null) throw notFound('Skill');
  const base = parseDoc(baseText);
  const variantText = lang === 'en' ? null : readText(skillFile(id, lang));
  const variant = variantText !== null ? parseDoc(variantText) : null;
  const doc = variant ?? base;
  return {
    id,
    lang,
    name: metaString(doc.meta, 'name') ?? metaString(base.meta, 'name') ?? id,
    description: metaString(doc.meta, 'description') ?? metaString(base.meta, 'description') ?? '',
    agent: agentOfSkill(id),
    hasVariant: variant !== null,
    body: doc.body,
    source: variant ? 'variant' : 'base',
    path: variant ? skillFile(id, lang) : skillFile(id, 'en'),
  };
}

export function createSkill(input: { id: string; name: string; description: string; body: string }): Skill {
  const id = checkedSkillId(input.id);
  if (existsSync(workspacePath(skillFile(id, 'en')))) throw conflict(`The skill ${id} already exists`);
  writeText(skillFile(id, 'en'), serializeDoc({ meta: { name: input.name, description: input.description }, body: input.body }));
  return readSkill(id, 'en');
}

/** UpdateSkill writes the language's own file; a variant keeps the English file untouched. */
export function updateSkill(
  rawId: string,
  lang: ContentLanguage,
  input: { name?: string; description?: string; body: string },
): Skill {
  const current = readSkill(rawId, lang);
  writeText(
    skillFile(current.id, lang),
    serializeDoc({
      meta: { name: input.name ?? current.name, description: input.description ?? current.description },
      body: input.body,
    }),
  );
  return readSkill(current.id, lang);
}

/** DeleteSkill: a variant deletes only that language's file; English deletes the whole skill directory. */
export function deleteSkill(rawId: string, lang: ContentLanguage): { id: string } {
  const current = readSkill(rawId, lang);
  if (lang === 'en') removeDir(`skills/${current.id}`);
  else removeFile(skillFile(current.id, lang));
  return { id: current.id };
}

/** Full text of every skill for the agent, in the language (variant body when present). */
export function skillsFor(ids: string[], lang: ContentLanguage): { id: string; name: string; body: string }[] {
  return ids.map((id) => {
    const s = readSkill(id, lang);
    return { id, name: s.name, body: s.body };
  });
}

export const allSkillIds = () => findSkillDirs('skills');

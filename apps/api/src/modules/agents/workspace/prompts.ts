import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentPrompt, AgentType, ContentLanguage, PromptSource } from '@open-drama/contracts';
import { WORKSPACE_TEMPLATE_DIR } from '../../../lib/roots';
import { AGENTS } from '../agents/definitions';
import { metaString, parseDoc, readText, removeFile, serializeDoc, variantName, writeText } from './files';

const promptPath = (type: AgentType, lang: ContentLanguage) => `prompts/${variantName(AGENTS[type].promptFile, lang)}`;

/** Prompt resolution: language variant → base file → built-in default. `model` comes from the base file only. */
export function readAgentPrompt(type: AgentType, lang: ContentLanguage): AgentPrompt {
  const def = AGENTS[type];
  const baseText = readText(promptPath(type, 'en'));
  const base = baseText !== null ? parseDoc(baseText) : null;
  const variantText = lang === 'en' ? null : readText(promptPath(type, lang));
  const variant = variantText !== null ? parseDoc(variantText) : null;
  const doc = variant ?? base;
  const source: PromptSource = variant ? 'variant' : base ? 'base' : 'default';
  return {
    type,
    lang,
    name: (doc && metaString(doc.meta, 'name')) ?? def.name,
    model: base ? metaString(base.meta, 'model') : null,
    body: doc?.body || def.defaultPrompt,
    source,
    path: variant ? promptPath(type, lang) : promptPath(type, 'en'),
  };
}

/** SaveAgentPrompt: writes the language's own file (a variant never changes the English base). */
export function saveAgentPrompt(type: AgentType, lang: ContentLanguage, body: string, model?: string | null): AgentPrompt {
  const current = readAgentPrompt(type, lang);
  const meta: Record<string, unknown> = { name: current.name };
  if (lang === 'en') meta.model = model === undefined ? current.model : model;
  writeText(promptPath(type, lang), serializeDoc({ meta, body }));
  return readAgentPrompt(type, lang);
}

/**
 * ResetAgentPrompt: a variant is removed (falling back to English); the English file is restored from the shipped
 * template, or removed when the template has none (falling back to the built-in default).
 */
export function resetAgentPrompt(type: AgentType, lang: ContentLanguage): AgentPrompt {
  const rel = promptPath(type, lang);
  const template = join(WORKSPACE_TEMPLATE_DIR, rel);
  if (lang === 'en' && existsSync(template)) writeText(rel, readFileSync(template, 'utf8'));
  else removeFile(rel);
  return readAgentPrompt(type, lang);
}

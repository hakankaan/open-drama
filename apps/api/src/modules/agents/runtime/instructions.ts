import type { AgentType, ContentLanguage } from '@open-drama/contracts';
import { AGENTS, skillBelongsTo } from '../agents/definitions';
import { readAgentPrompt } from '../workspace/prompts';
import { allSkillIds, skillsFor } from '../workspace/skills';

const LANGUAGE_NAMES: Record<ContentLanguage, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
};

/** Highest-priority block for any content language other than the canonical English (adr-0011). */
export function languageDirective(lang: ContentLanguage): string {
  if (lang === 'en') return '';
  const name = LANGUAGE_NAMES[lang];
  return [
    '## Language (highest priority)',
    '',
    `Write every piece of content you produce in ${name}: scripts, dialogue, the names of new assets, descriptions and prompts. This rule overrides every other language rule, including the language of the examples in your skills.`,
    '',
    'Never translate or respell the name of an asset that already exists, and copy names inside @[…] mentions exactly as they are. Structural markers such as [Shot N] and scene headings keep their format. The project visual style is added by the system; do not write style words yourself.',
  ].join('\n');
}

/** Instructions = prompt file (variant → base → default) + every skill under the agent's prefixes + language directive. */
export function assembleInstructions(agentType: AgentType, lang: ContentLanguage) {
  const def = AGENTS[agentType];
  const prompt = readAgentPrompt(agentType, lang);
  const skills = skillsFor(
    allSkillIds().filter((id) => skillBelongsTo(def, id)),
    lang,
  );
  const parts = [prompt.body];
  if (skills.length > 0) {
    parts.push('## Skills', ...skills.map((s) => `### ${s.name}\n\n${s.body}`));
  }
  const directive = languageDirective(lang);
  if (directive) parts.push(directive);
  return { instructions: parts.join('\n\n'), promptModel: prompt.model, skillIds: skills.map((s) => s.id) };
}

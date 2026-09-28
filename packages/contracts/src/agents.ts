import { z } from 'zod';
import { AgentType, ContentLanguage } from './common';

/** Where a prompt was read from: the language variant file, the base file, or the built-in default in code. */
export const PromptSource = z.enum(['variant', 'base', 'default']);
export type PromptSource = z.infer<typeof PromptSource>;

export const LangQuery = z.object({ lang: ContentLanguage.default('en') });

export const AgentSummary = z.object({
  type: AgentType,
  name: z.string(),
  skillCount: z.number().int(),
  model: z.string().nullable(),
  promptSource: PromptSource,
});
export type AgentSummary = z.infer<typeof AgentSummary>;

export const AgentPrompt = z.object({
  type: AgentType,
  lang: ContentLanguage,
  name: z.string(),
  model: z.string().nullable(),
  body: z.string(),
  source: PromptSource,
  path: z.string(),
});
export type AgentPrompt = z.infer<typeof AgentPrompt>;

export const SaveAgentPrompt = z.object({
  body: z.string().trim().min(1).max(100_000),
  /** Only stored in the base (English) file; ignored for variants. */
  model: z.string().trim().max(200).nullable().optional(),
});
export type SaveAgentPrompt = z.input<typeof SaveAgentPrompt>;

/** A skill id is its directory path under skills/, lowercase segments joined by '/'. */
export const SkillId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/, 'lowercase letters, digits, dashes and /');

export const SkillSummary = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  agent: AgentType.nullable(),
  hasVariant: z.boolean(),
});
export type SkillSummary = z.infer<typeof SkillSummary>;

export const Skill = SkillSummary.extend({
  lang: ContentLanguage,
  body: z.string(),
  source: PromptSource,
  path: z.string(),
});
export type Skill = z.infer<typeof Skill>;

export const CreateSkill = z.object({
  id: SkillId,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  body: z.string().max(100_000).default(''),
});
export type CreateSkill = z.input<typeof CreateSkill>;

export const UpdateSkill = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  body: z.string().max(100_000),
});
export type UpdateSkill = z.input<typeof UpdateSkill>;

export const RunAgentRequest = z.object({
  message: z.string().trim().min(1).max(20_000),
  dramaId: z.number().int().positive(),
  episodeId: z.number().int().positive(),
  model: z.string().trim().max(200).optional(),
  textServiceId: z.number().int().positive().optional(),
});
export type RunAgentRequest = z.input<typeof RunAgentRequest>;

export const AgentRunResult = z.object({
  text: z.string(),
  steps: z.number().int(),
  toolCalls: z.array(z.object({ tool: z.string(), ok: z.boolean() })),
  elapsedMs: z.number().int(),
  model: z.string(),
});
export type AgentRunResult = z.infer<typeof AgentRunResult>;

/** Model and service overrides accepted by every agent-backed endpoint. */
export const TextModelOverride = z.object({
  model: z.string().trim().max(200).optional(),
  textServiceId: z.number().int().positive().optional(),
});
export type TextModelOverride = z.input<typeof TextModelOverride>;

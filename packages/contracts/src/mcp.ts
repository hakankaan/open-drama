import { z } from 'zod';
import { TextModelOverride } from './agents';
import { AddModelService, UpdateModelService } from './configuration';
import { ContentLanguage, DesignTarget, Id, JobKind, JobStatus, RequiredServiceType, ServiceType, Timestamp } from './common';
import { AgentJob } from './jobs';
import { EpisodeView, ScriptFromContent, UpdateDrama, UpdateEpisode } from './production';

// The assistant endpoint's own schemas (adr-0016). Everything an MCP tool accepts or returns that is not already a
// contract schema lives here, composed from the existing fields and strict, so a stray field (an apiKey, a typo) is a
// schema error rather than a silent drop.

/** The episode's id as every episode tool takes it. */
const episodeId = Id.describe('The episode id');
const dramaId = Id.describe('The project (drama) id');

export const DramaIdInput = z.strictObject({ dramaId });
export const EpisodeIdInput = z.strictObject({ episodeId });

/** Which text of an episode to read or save. */
export const EpisodeTextPart = z.enum(['beats', 'script', 'recap']);
export type EpisodeTextPart = z.infer<typeof EpisodeTextPart>;

export const ReadEpisode = z.strictObject({ episodeId, part: EpisodeTextPart.describe('beats (the raw content), script or recap') });
export type ReadEpisode = z.infer<typeof ReadEpisode>;

export const EpisodeText = z.object({
  episodeId: z.number().int(),
  part: EpisodeTextPart,
  text: z.string(),
  /** The revision to pass back as ifRevision when saving this text. */
  revision: z.number().int(),
  characters: z.number().int(),
  /** For the recap: the script revision it is read against, to pass back as forScriptRevision when saving it. */
  scriptRevision: z.number().int().optional(),
});
export type EpisodeText = z.infer<typeof EpisodeText>;

/** The revision the assistant read, checked inside the write transaction; a changed text is refused with CONFLICT. */
const ifRevision = z.number().int().min(0).describe('The revision returned by the last read of this text');

export const SaveOutlineInput = z.strictObject({
  dramaId,
  outline: z.string().trim().min(1).max(20_000).describe('The complete outline, Markdown'),
  ifRevision,
});
export const SaveBeatsInput = z.strictObject({ episodeId, content: z.string().max(200_000).describe('The complete beat sheet (raw content)'), ifRevision });
export const SaveScriptInput = z.strictObject({ episodeId, scriptContent: z.string().max(400_000).describe('The complete formatted script'), ifRevision });
export const SaveRecapInput = z.strictObject({
  episodeId,
  recap: z.string().trim().max(2000).describe('The complete recap'),
  ifRevision,
  forScriptRevision: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('The scriptRevision returned by the read of the recap, so a recap written for an older script is refused (CONFLICT) once the script changed'),
});

/** What a text save returns: the new revision beside the sizes, so a second save can follow without a read. */
export const TextSaved = z.object({
  revision: z.number().int(),
  characters: z.number().int(),
  changed: z.boolean(),
  studioPath: z.string(),
});
export type TextSaved = z.infer<typeof TextSaved>;

/** A write tool that starts an agent over a saved text asks for replace once a text exists. */
const replace = z.boolean().default(false).describe('Set true only after the creator agreed to replace the existing text');

export const WriteOutlineInput = TextModelOverride.extend({ dramaId, replace }).strict();
export const StartScriptJobInput = TextModelOverride.extend({ episodeId, replace }).strict();
export const StartRecapInput = TextModelOverride.extend({ episodeId, replace }).strict();
export const UseContentAsScriptInput = z.strictObject({ episodeId, replace });
export const DeleteEpisodeInput = z.strictObject({
  episodeId,
  force: z.boolean().default(false).describe('Set true only after the creator agreed to lose the script, shots or film the episode holds'),
});

export const UpdateDramaInput = UpdateDrama.omit({ outline: true }).extend({ dramaId }).strict();
export const UpdateEpisodeInput = UpdateEpisode.omit({ content: true, scriptContent: true, recap: true }).extend({ episodeId }).strict();

/** The episode as the assistant first sees it: sizes and revisions instead of the large texts (read_episode gives one). */
export const EpisodeBrief = EpisodeView.omit({ content: true, scriptContent: true, recap: true }).extend({
  synopsis: z.string(),
  beats: z.object({ characters: z.number().int(), revision: z.number().int() }),
  script: z.object({ characters: z.number().int(), revision: z.number().int() }),
  recap: z.object({ characters: z.number().int(), revision: z.number().int(), stale: z.boolean() }),
  studioPath: z.string(),
});
export type EpisodeBrief = z.infer<typeof EpisodeBrief>;

/** use_content_as_script is a save, not a job: the episode and the recap job it started in a serial project. */
export const UseContentAsScriptResult = ScriptFromContent.extend({ studioPath: z.string() });
export type UseContentAsScriptResult = z.infer<typeof UseContentAsScriptResult>;

export const WAIT_FOR_JOB_DEFAULT_SECONDS = 30;
export const WAIT_FOR_JOB_MAX_SECONDS = 300;
export const WaitForJob = z.strictObject({
  jobId: Id.describe('The job id'),
  timeoutSeconds: z
    .number()
    .int()
    .min(0)
    .max(WAIT_FOR_JOB_MAX_SECONDS)
    .default(WAIT_FOR_JOB_DEFAULT_SECONDS)
    .describe(`How long to wait for the job to settle, 0 to ${WAIT_FOR_JOB_MAX_SECONDS}; 0 reads it at once`),
});
export type WaitForJob = z.infer<typeof WaitForJob>;

export const GetJobsInput = z.strictObject({ dramaId, episodeId: Id.optional().describe('Also return the episode-scoped jobs of this episode') });

/** What a settled job produced, per kind, derived from the row and its targets. */
export const JobOutcome = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('outline'), outlineChars: z.number().int(), outlineRevision: z.number().int() }),
  z.object({
    kind: z.literal('plan'),
    requested: z.number().int(),
    planned: z.number().int(),
    added: z.array(z.object({ id: z.number().int(), episodeNumber: z.number().int(), title: z.string(), synopsis: z.string() })),
  }),
  z.object({ kind: z.literal('write'), scriptChars: z.number().int(), scriptRevision: z.number().int(), recapJobId: z.number().int().nullable() }),
  z.object({ kind: z.literal('rewrite'), scriptChars: z.number().int(), scriptRevision: z.number().int(), recapJobId: z.number().int().nullable() }),
  z.object({ kind: z.literal('recap'), recapChars: z.number().int(), recapRevision: z.number().int() }),
  z.object({
    kind: z.literal('design'),
    target: DesignTarget,
    saved: z.number().int(),
    filled: z.number().int(),
    skipped: z.array(z.string()),
    overflow: z.array(z.string()),
    /** The outline revision the run designed from; null when it was cancelled before reading. */
    outlineRevision: z.number().int().nullable(),
  }),
  z.object({ kind: z.enum(['extraction', 'breakdown', 'videoPromptBatch']) }),
]);
export type JobOutcome = z.infer<typeof JobOutcome>;

/** wait_for_job's result: the job, and its outcome once it settled (null while running or when it failed). */
export const JobWaitResult = z.object({
  job: AgentJob,
  settled: z.boolean(),
  outcome: JobOutcome.nullable(),
});
export type JobWaitResult = z.infer<typeof JobWaitResult>;

/** An assistant skill's frontmatter (workspace/assistant/<name>/SKILL.md). */
export const AssistantSkillArgument = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'lowercase letters, digits and underscores'),
  description: z.string().trim().min(1).max(300),
  required: z.boolean().default(false),
});
export const AssistantSkillMeta = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  arguments: z.array(AssistantSkillArgument).max(8).default([]),
});
export type AssistantSkillMeta = z.infer<typeof AssistantSkillMeta>;

export const AssistantSkillSummary = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  arguments: z.array(AssistantSkillArgument),
  lang: ContentLanguage,
  /** true when the language variant file was served, false when it fell back to English. */
  variant: z.boolean(),
});
export type AssistantSkillSummary = z.infer<typeof AssistantSkillSummary>;

/** get_status: everything an assistant needs before it does anything. */
export const McpStatus = z.object({
  version: z.string(),
  readiness: z.object({
    ready: z.boolean(),
    missingTypes: z.array(RequiredServiceType),
    /** Per missing type, what it blocks (the story room needs text only). */
    blocks: z.array(z.object({ type: RequiredServiceType, stages: z.array(z.string()) })),
  }),
  /** The studio's address, or null when the web interface is off (OPEN_DRAMA_WEB_UI=0). */
  studio: z.string().nullable(),
  contentLanguage: ContentLanguage,
  projects: z.object({ total: z.number().int(), byStatus: z.array(z.object({ status: z.string(), count: z.number().int() })) }),
  skills: z.array(z.object({ name: z.string(), title: z.string() })),
  skippedSkills: z.array(z.object({ name: z.string(), reason: z.string() })),
  /** The gateways a single key sets up, with the environment variable that seeds them at boot. */
  quickSetup: z.array(z.object({ gateway: z.string(), label: z.string(), environmentVariable: z.string().nullable() })),
  /** The exact command that adds a key to a saved service without the key passing through the assistant. */
  keyCommand: z.string(),
});
export type McpStatus = z.infer<typeof McpStatus>;

// Configuration tools: the contract schemas minus the key, strict (adr-0016: secrets never travel over MCP).

export const AddModelServiceNoKey = AddModelService.omit({ apiKey: true }).strict();
export type AddModelServiceNoKey = z.infer<typeof AddModelServiceNoKey>;
export const UpdateModelServiceNoKey = UpdateModelService.omit({ apiKey: true }).extend({ id: Id }).strict();
export type UpdateModelServiceNoKey = z.infer<typeof UpdateModelServiceNoKey>;
export const TestSavedModelService = z.strictObject({ id: Id.describe('A saved service; its stored key is used'), model: z.string().trim().max(200).optional() });
export type TestSavedModelService = z.infer<typeof TestSavedModelService>;
export const CatalogBrowse = z.strictObject({
  type: ServiceType,
  query: z.string().trim().max(100).optional().describe('Substring of the model id or name'),
  limit: z.number().int().min(1).max(100).default(20),
});
export type CatalogBrowse = z.infer<typeof CatalogBrowse>;

/** A job as the assistant lists it in get_jobs, with its kind's scope spelled out. */
export const JobRef = z.object({ id: z.number().int(), kind: JobKind, status: JobStatus, startedAt: Timestamp });

import { z } from 'zod';

// The enum table (adr-0007): the vocabulary of the whole system. The domain model uses the same words.

export const ServiceType = z.enum(['text', 'image', 'video']);
export type ServiceType = z.infer<typeof ServiceType>;
export const SERVICE_TYPES = ServiceType.options;

export const Resolution = z.enum(['480p', '720p', '1080p']);
export type Resolution = z.infer<typeof Resolution>;

export const AspectRatio = z.enum(['16:9', '9:16', '1:1', 'adaptive']);
export type AspectRatio = z.infer<typeof AspectRatio>;

export const DramaStatus = z.enum(['draft', 'active', 'completed']);
export type DramaStatus = z.infer<typeof DramaStatus>;
export const EpisodeStatus = DramaStatus;
export type EpisodeStatus = DramaStatus;

export const TaskStatus = z.enum(['processing', 'completed', 'failed']);
export type TaskStatus = z.infer<typeof TaskStatus>;
export const FilmStatus = TaskStatus;
export type FilmStatus = TaskStatus;

export const TaskErrorClass = z.enum(['moderation', 'auth', 'quota', 'timeout', 'provider', 'config']);
export type TaskErrorClass = z.infer<typeof TaskErrorClass>;

/** `cancelled`: stopped by the creator; nothing it had not saved yet is kept. */
export const JobStatus = z.enum(['running', 'done', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobKind = z.enum(['rewrite', 'extraction', 'breakdown', 'videoPromptBatch', 'recap', 'write', 'outline', 'plan']);
export type JobKind = z.infer<typeof JobKind>;

export const ExtractionTarget = z.enum(['characters', 'scenes', 'props']);
export type ExtractionTarget = z.infer<typeof ExtractionTarget>;

export const AgentType = z.enum([
  'script_rewriter',
  'extractor',
  'storyboard_breaker',
  'prompt_generator',
  'recap_writer',
  'episode_writer',
  'story_writer',
  'episode_planner',
]);
export type AgentType = z.infer<typeof AgentType>;

export const ContentLanguage = z.enum(['en', 'zh', 'ja', 'ko']);
export type ContentLanguage = z.infer<typeof ContentLanguage>;
export const DEFAULT_CONTENT_LANGUAGE: ContentLanguage = 'en';

// Providers (adr-0013).
export const ProviderName = z.enum(['openai', 'gemini', 'volcengine', 'minimax', 'aliyun', 'byteplus', 'modelrunner']);
export type ProviderName = z.infer<typeof ProviderName>;

export const PROVIDERS_BY_TYPE: Record<ServiceType, readonly ProviderName[]> = {
  text: ['openai', 'gemini', 'volcengine', 'byteplus', 'modelrunner'],
  image: ['openai', 'gemini', 'volcengine', 'byteplus', 'modelrunner'],
  video: ['volcengine', 'minimax', 'aliyun', 'byteplus', 'modelrunner'],
};

/** Providers whose adapters are not available yet; the UI shows them disabled. */
export const DEFERRED_PROVIDERS: readonly ProviderName[] = [];

export const DEFAULT_RESOLUTION: Resolution = '720p';
export const DEFAULT_DURATION_SECONDS = 10;

// Envelope and errors

export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'FORBIDDEN',
  'PRECONDITION_FAILED',
  'PROVIDER_ERROR',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export const ErrorEnvelope = z.object({ error: ErrorBody });

export const envelope = <T extends z.ZodType>(data: T) => z.object({ data });

export const Id = z.coerce.number().int().positive();
export type Id = number;

export const IdParam = z.object({ id: Id });

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });

/** ISO-8601 timestamp string. */
export const Timestamp = z.string();

/** Relative media path under the storage root, e.g. `static/uploads/<uuid>.png`. */
export const MediaPath = z.string();

/** Reference to a style preset by its stable key. */
export const StylePresetValueRef = z.string().trim().min(1).max(40);

import { z } from 'zod';
import { MediaPath, PageQuery, paginated, TaskErrorClass, TaskStatus, Timestamp } from './common';
import { Film } from './compositing';

/** The latest generation task of an asset or shot, as carried by list read models (no per-task polling). */
export const TaskSummary = z.object({
  id: z.number().int(),
  status: TaskStatus,
  error: z.string().nullable(),
  errorClass: TaskErrorClass.nullable(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
});
export type TaskSummary = z.infer<typeof TaskSummary>;

export const GenerationType = z.enum(['image', 'video']);
export type GenerationType = z.infer<typeof GenerationType>;

/** GenerationTaskStatus: one task as the API shows it (the provider's result URL and task id stay internal). */
export const GenerationTask = z.object({
  id: z.number().int(),
  type: GenerationType,
  dramaId: z.number().int().nullable(),
  shotId: z.number().int().nullable(),
  characterId: z.number().int().nullable(),
  sceneId: z.number().int().nullable(),
  propId: z.number().int().nullable(),
  serviceId: z.number().int().nullable(),
  provider: z.string(),
  model: z.string(),
  prompt: z.string(),
  params: z.record(z.string(), z.unknown()),
  localPath: MediaPath.nullable(),
  durationSeconds: z.number().nullable(),
  status: TaskStatus,
  error: z.string().nullable(),
  errorClass: TaskErrorClass.nullable(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  completedAt: Timestamp.nullable(),
});
export type GenerationTask = z.infer<typeof GenerationTask>;

export const GenerationTaskListQuery = PageQuery.extend({
  type: GenerationType.optional(),
  dramaId: z.coerce.number().int().positive().optional(),
  shotId: z.coerce.number().int().positive().optional(),
  status: TaskStatus.optional(),
});

export const GenerationTaskList = paginated(GenerationTask);
export type GenerationTaskList = z.infer<typeof GenerationTaskList>;

/** What a task generates for, labelled for the task drawer (shot number, or the asset's name). */
export const TaskOwner = z.object({
  kind: z.enum(['shot', 'character', 'scene', 'prop']),
  id: z.number().int(),
  label: z.string(),
});
export type TaskOwner = z.infer<typeof TaskOwner>;

export const EpisodeTaskRow = GenerationTask.extend({ owner: TaskOwner.nullable() });
export type EpisodeTaskRow = z.infer<typeof EpisodeTaskRow>;

/** EpisodeGenerationTasks: the episode's tasks (through its shots and linked assets) and merges, newest first. */
export const EpisodeGenerationTasks = z.object({
  episodeId: z.number().int(),
  tasks: z.array(EpisodeTaskRow),
  films: z.array(Film),
});
export type EpisodeGenerationTasks = z.infer<typeof EpisodeGenerationTasks>;

export const EpisodeGenerationTasksQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

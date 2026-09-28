import { z } from 'zod';
import { TaskErrorClass, TaskStatus, Timestamp } from './common';

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

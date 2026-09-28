import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { TaskErrorClass, TaskStatus } from '@open-drama/contracts';
import { createdAt, id, json, updatedAt } from './columns';

export const generationTasks = sqliteTable(
  'generation_tasks',
  {
    id: id(),
    type: text().$type<'image' | 'video'>().notNull(),
    dramaId: integer(),
    shotId: integer(),
    characterId: integer(),
    sceneId: integer(),
    propId: integer(),
    serviceId: integer(),
    provider: text().notNull().default(''),
    model: text().notNull().default(''),
    prompt: text().notNull().default(''),
    params: json<Record<string, unknown>>().notNull().default({}),
    providerTaskId: text(),
    resultUrl: text(),
    localPath: text(),
    durationSeconds: real(),
    status: text().$type<TaskStatus>().notNull().default('processing'),
    error: text(),
    errorClass: text().$type<TaskErrorClass>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: text(),
  },
  (t) => [
    index('generation_tasks_type_idx').on(t.type),
    index('generation_tasks_drama_idx').on(t.dramaId),
    index('generation_tasks_shot_idx').on(t.shotId),
    index('generation_tasks_status_idx').on(t.status),
  ],
);

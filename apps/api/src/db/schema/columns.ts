import { integer, text } from 'drizzle-orm/sqlite-core';

export const nowIso = () => new Date().toISOString();

export const id = () => integer().primaryKey({ autoIncrement: true });
export const createdAt = () => text().notNull().$defaultFn(nowIso);
export const updatedAt = () => text().notNull().$defaultFn(nowIso).$onUpdateFn(nowIso);
export const deletedAt = () => text();
export const bool = () => integer({ mode: 'boolean' });
export const json = <T>() => text({ mode: 'json' }).$type<T>();

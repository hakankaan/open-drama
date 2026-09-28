import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '../env';
import { MIGRATIONS_DIR } from '../lib/roots';
import * as schema from './schema';

mkdirSync(dirname(env.sqlitePath), { recursive: true });

export const sqlite = new Database(env.sqlitePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle({ client: sqlite, schema, casing: 'snake_case' });
export type Db = typeof db;

/** Applies the committed drizzle-kit migrations (adr-0004). Runs at boot before anything else. */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

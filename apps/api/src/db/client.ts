import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { env } from '../env';
import { logger } from '../http/logger';
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

/** drizzle's journal of applied migrations: the same table and rows its own migrator writes. */
const JOURNAL = '__drizzle_migrations';

/**
 * Applies the committed drizzle-kit migrations (adr-0004). Runs at boot before anything else. Like drizzle's migrator,
 * every pending migration runs in one transaction; unlike it, foreign keys are switched off around that transaction
 * (inside one, SQLite ignores the pragma, so a table rebuild would cascade its deletes) and checked before the commit:
 * a migration that leaves a dangling reference rolls back and stops the boot. A database with data is first copied
 * next to itself, so a migration that goes wrong in a way no check catches can still be undone by hand.
 */
export function runMigrations(): void {
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR });
  sqlite.exec(`CREATE TABLE IF NOT EXISTS "${JOURNAL}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`);
  const last = sqlite.prepare(`SELECT created_at FROM "${JOURNAL}" ORDER BY created_at DESC LIMIT 1`).get() as
    | { created_at: number | string }
    | undefined;
  const pending = migrations.filter((m) => !last || Number(last.created_at) < m.folderMillis);
  if (pending.length === 0) return;
  const holdsTables = sqlite
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> ? LIMIT 1`)
    .get(JOURNAL);
  if (holdsTables) {
    const backup = `${env.sqlitePath}.pre-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
    sqlite.prepare('VACUUM INTO ?').run(backup);
    logger.info({ backup, pending: pending.length }, 'database backed up before migrating');
  }
  const dangling = () =>
    (sqlite.pragma('foreign_key_check') as { table: string; rowid: number; parent: string; fkid: number }[]).map((d) => ({
      ...d,
      key: `${d.table}:${d.rowid}:${d.parent}:${d.fkid}`,
    }));
  // References already dangling before this boot are reported, not blamed on the migration; any other one is.
  const before = new Set(dangling().map((d) => d.key));
  if (before.size > 0) logger.warn({ rows: before.size }, 'the database already holds rows pointing at missing rows');
  sqlite.pragma('foreign_keys = OFF');
  try {
    sqlite.transaction(() => {
      const record = sqlite.prepare(`INSERT INTO "${JOURNAL}" ("hash", "created_at") VALUES (?, ?)`);
      for (const migration of pending) {
        for (const statement of migration.sql) sqlite.exec(statement);
        record.run(migration.hash, migration.folderMillis);
      }
      const added = dangling().filter((d) => !before.has(d.key));
      if (added.length > 0) {
        const where = [...new Set(added.map((d) => `${d.table} → ${d.parent}`))].join(', ');
        throw new Error(`A migration left ${added.length} rows pointing at missing rows (${where}); nothing was changed`);
      }
    })();
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
}

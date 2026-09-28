import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from './schema.js';

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'bot.sqlite');

export function createDb(dbPath: string = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;

export function runMigrations(db: Db, migrationsFolder = path.join(process.cwd(), 'drizzle')): void {
  migrate(db, { migrationsFolder });
}

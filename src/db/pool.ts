import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '@/config.js';
import { logger } from '@/utils/logger.js';

const databasePath = config.databasePath;
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

type QueryResult<T = unknown> = {
  rowCount: number;
  rows: T[];
};

export const pool = {
  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    try {
      const statement = sqlite.prepare(sql);
      if (statement.reader) {
        const rows = statement.all(...params) as T[];
        return { rowCount: rows.length, rows };
      }
      const info = statement.run(...params);
      const rowCount = typeof info.changes === 'number' ? info.changes : 0;
      return { rowCount, rows: [] as T[] };
    } catch (error) {
      logger.error('SQLite query error', { sql, params, error });
      throw error;
    }
  }
};

function columnExists(table: string, column: string): boolean {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error('Unsafe table or column name encountered while checking schema');
  }
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((col) => col.name === column);
}

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_speakers (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      speaker_id INTEGER NOT NULL,
      pitch REAL NOT NULL DEFAULT 0,
      speed REAL NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  if (!columnExists('user_speakers', 'pitch')) {
    await pool.query('ALTER TABLE user_speakers ADD COLUMN pitch REAL NOT NULL DEFAULT 0');
  }
  if (!columnExists('user_speakers', 'speed')) {
    await pool.query('ALTER TABLE user_speakers ADD COLUMN speed REAL NOT NULL DEFAULT 1');
  }
  if (!columnExists('user_speakers', 'updated_at')) {
    await pool.query(
      'ALTER TABLE user_speakers ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      auto_join INTEGER NOT NULL DEFAULT 1,
      text_channel_id TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!columnExists('guild_settings', 'updated_at')) {
    await pool.query(
      'ALTER TABLE guild_settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS llm_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL CHECK(scope IN ('guild', 'global')),
      guild_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('gemini', 'openai')),
      key_id TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(scope, guild_id, provider, key_id)
    )
  `);

  if (!columnExists('llm_api_keys', 'updated_at')) {
    await pool.query(
      'ALTER TABLE llm_api_keys ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS llm_api_key_access (
      api_key_pk INTEGER NOT NULL,
      allowed_user_id TEXT NOT NULL,
      PRIMARY KEY (api_key_pk, allowed_user_id),
      FOREIGN KEY (api_key_pk) REFERENCES llm_api_keys(id) ON DELETE CASCADE
    )
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_llm_api_key_access_allowed_user ON llm_api_key_access(allowed_user_id)'
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_llm_settings (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      provider TEXT CHECK(provider IN ('gemini', 'openai')),
      api_key_id TEXT,
      model TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  if (!columnExists('user_llm_settings', 'updated_at')) {
    await pool.query(
      'ALTER TABLE user_llm_settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
  }

  logger.debug('Database migrations executed');
}

export async function shutdownDb(): Promise<void> {
  sqlite.close();
}

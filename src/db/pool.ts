import { Pool } from 'pg';
import { config } from '@/config.js';
import { logger } from '@/utils/logger.js';

export const pool = new Pool({
  connectionString: config.databaseUrl
});

pool.on('error', (error: Error) => {
  logger.error('Unexpected PostgreSQL error', error);
});

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_speakers (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      speaker_id INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      auto_join BOOLEAN NOT NULL DEFAULT TRUE,
      text_channel_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    ALTER TABLE guild_settings
    ALTER COLUMN auto_join SET DEFAULT TRUE
  `);
  logger.debug('Database migrations executed');
}

export async function shutdownDb(): Promise<void> {
  await pool.end();
}

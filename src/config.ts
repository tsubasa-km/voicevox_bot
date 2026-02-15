import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function parseBase64MasterKey(name: string): Buffer {
  const raw = requireEnv(name);
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) {
    throw new Error(`Environment variable ${name} must be base64-encoded 32-byte key`);
  }
  return decoded;
}

const allowedLogLevels = new Set(['error', 'warn', 'info', 'debug']);
const envLogLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const logLevel = allowedLogLevels.has(envLogLevel) ? (envLogLevel as 'error' | 'warn' | 'info' | 'debug') : 'info';

export const config = {
  discordToken: requireEnv('DISCORD_BOT_TOKEN'),
  voiceVoxApiUrl: requireEnv('VOICEVOX_API_URL'),
  databasePath: process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'db/voicevox.db'),
  defaultSpeakerId: Number(process.env.DEFAULT_SPEAKER_ID ?? '1'),
  maxUtteranceLength: Number(process.env.MAX_UTTERANCE_LENGTH ?? '140'),
  logFilePath: process.env.LOG_FILE_PATH ?? 'logs/bot.log',
  logLevel,
  api: {
    key: requireEnv('API_KEY'),
    port: Number(process.env.PORT),
    hostname: process.env.API_HOST ?? '0.0.0.0'
  },
  llm: {
    masterKey: parseBase64MasterKey('LLM_MASTER_KEY')
  }
};

import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

const allowedLogLevels = new Set(['error', 'warn', 'info', 'debug']);
const envLogLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const logLevel = allowedLogLevels.has(envLogLevel) ? (envLogLevel as 'error' | 'warn' | 'info' | 'debug') : 'info';

export const config = {
  discordToken: requireEnv('DISCORD_BOT_TOKEN'),
  voiceVoxApiUrl: requireEnv('VOICEVOX_API_URL'),
  databaseUrl: requireEnv('DATABASE_URL'),
  defaultSpeakerId: Number(process.env.DEFAULT_SPEAKER_ID ?? '1'),
  maxUtteranceLength: Number(process.env.MAX_UTTERANCE_LENGTH ?? '140'),
  logFilePath: process.env.LOG_FILE_PATH ?? 'logs/bot.log',
  logLevel
};

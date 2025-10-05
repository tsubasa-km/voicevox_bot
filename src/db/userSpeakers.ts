import { pool } from '@/db/pool.js';

export interface UserVoiceSettings {
  speakerId: number;
  pitch: number;
  speed: number;
}

export const defaultPitch = 0;
export const defaultSpeed = 1;

export async function getUserVoiceSettings(
  guildId: string,
  userId: string
): Promise<UserVoiceSettings | null> {
  const result = await pool.query<{ speaker_id: number; pitch: number; speed: number }>(
    'SELECT speaker_id, pitch, speed FROM user_speakers WHERE guild_id = $1 AND user_id = $2',
    [guildId, userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    speakerId: row.speaker_id,
    pitch: row.pitch,
    speed: row.speed
  };
}

export async function setUserSpeakerId(
  guildId: string,
  userId: string,
  speakerId: number
): Promise<void> {
  await pool.query(
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id, pitch, speed, updated_at)
     VALUES ($1, $2, $3, DEFAULT, DEFAULT, NOW())
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET speaker_id = EXCLUDED.speaker_id, updated_at = NOW()`,
    [guildId, userId, speakerId]
  );
}

export async function setUserPitch(
  guildId: string,
  userId: string,
  pitch: number,
  defaultSpeakerId: number
): Promise<void> {
  await pool.query(
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id, pitch, speed, updated_at)
     VALUES ($1, $2, $4, $3, DEFAULT, NOW())
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET pitch = EXCLUDED.pitch, updated_at = NOW()`,
    [guildId, userId, pitch, defaultSpeakerId]
  );
}

export async function setUserSpeed(
  guildId: string,
  userId: string,
  speed: number,
  defaultSpeakerId: number
): Promise<void> {
  await pool.query(
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id, pitch, speed, updated_at)
     VALUES ($1, $2, $4, DEFAULT, $3, NOW())
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET speed = EXCLUDED.speed, updated_at = NOW()`,
    [guildId, userId, speed, defaultSpeakerId]
  );
}

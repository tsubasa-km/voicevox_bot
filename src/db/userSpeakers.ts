import { pool } from '@/db/pool.js';

export interface UserVoiceSettings {
  speakerId: number | null;
  pitch: number;
  speed: number;
}

export const defaultPitch = 0;
export const defaultSpeed = 1;
export const unsetSpeakerId = -1;

type UserSpeakerRow = { speaker_id: number; pitch: number; speed: number };

export async function getUserVoiceSettings(
  guildId: string,
  userId: string
): Promise<UserVoiceSettings | null> {
  const result = await pool.query<UserSpeakerRow>(
    'SELECT speaker_id, pitch, speed FROM user_speakers WHERE guild_id = ? AND user_id = ? LIMIT 1',
    [guildId, userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    speakerId: row.speaker_id === unsetSpeakerId ? null : row.speaker_id,
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
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id)
     VALUES (?, ?, ?)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET speaker_id = excluded.speaker_id, updated_at = CURRENT_TIMESTAMP`,
    [guildId, userId, speakerId]
  );
}

export async function setUserPitch(
  guildId: string,
  userId: string,
  pitch: number,
  _defaultSpeakerId: number
): Promise<void> {
  await pool.query(
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id, pitch)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET pitch = excluded.pitch, updated_at = CURRENT_TIMESTAMP`,
    [guildId, userId, unsetSpeakerId, pitch]
  );
}

export async function setUserSpeed(
  guildId: string,
  userId: string,
  speed: number,
  _defaultSpeakerId: number
): Promise<void> {
  await pool.query(
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id, speed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET speed = excluded.speed, updated_at = CURRENT_TIMESTAMP`,
    [guildId, userId, unsetSpeakerId, speed]
  );
}

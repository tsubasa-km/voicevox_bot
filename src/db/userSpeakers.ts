import { pool } from '@/db/pool.js';

export async function getUserSpeakerId(guildId: string, userId: string): Promise<number | null> {
  const result = await pool.query<{ speaker_id: number }>(
    'SELECT speaker_id FROM user_speakers WHERE guild_id = $1 AND user_id = $2',
    [guildId, userId]
  );

  return result.rows[0]?.speaker_id ?? null;
}

export async function setUserSpeakerId(guildId: string, userId: string, speakerId: number): Promise<void> {
  await pool.query(
    `INSERT INTO user_speakers (guild_id, user_id, speaker_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET speaker_id = EXCLUDED.speaker_id, updated_at = NOW()`,
    [guildId, userId, speakerId]
  );
}

import { pool } from '@/db/pool.js';

export interface GuildSettings {
  autoJoin: boolean;
  textChannelId: string | null;
}

const defaultSettings: GuildSettings = {
  autoJoin: true,
  textChannelId: null
};

function mapRow(row: { auto_join: boolean; text_channel_id: string | null }): GuildSettings {
  return {
    autoJoin: row.auto_join,
    textChannelId: row.text_channel_id
  };
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const result = await pool.query<{ auto_join: boolean; text_channel_id: string | null }>(
    'SELECT auto_join, text_channel_id FROM guild_settings WHERE guild_id = $1',
    [guildId]
  );

  if (result.rowCount === 0) {
    return { ...defaultSettings };
  }

  return mapRow(result.rows[0]);
}

export async function setGuildAutoJoin(guildId: string, autoJoin: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO guild_settings (guild_id, auto_join, text_channel_id, updated_at)
     VALUES ($1, $2, NULL, NOW())
     ON CONFLICT (guild_id)
     DO UPDATE SET auto_join = EXCLUDED.auto_join, updated_at = NOW()`,
    [guildId, autoJoin]
  );
}

export async function setGuildPreferredTextChannel(guildId: string, textChannelId: string): Promise<void> {
  await pool.query(
    `INSERT INTO guild_settings (guild_id, auto_join, text_channel_id, updated_at)
     VALUES ($1, TRUE, $2, NOW())
     ON CONFLICT (guild_id)
     DO UPDATE SET text_channel_id = EXCLUDED.text_channel_id, updated_at = NOW()`,
    [guildId, textChannelId]
  );
}

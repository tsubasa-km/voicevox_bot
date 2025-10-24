import { pool } from '@/db/pool.js';

export interface GuildSettings {
  autoJoin: boolean;
  textChannelId: string | null;
}

const defaultSettings: GuildSettings = {
  autoJoin: true,
  textChannelId: null
};

type GuildSettingsRow = { auto_join: number; text_channel_id: string | null };

function mapRow(row: GuildSettingsRow): GuildSettings {
  return {
    autoJoin: Boolean(row.auto_join),
    textChannelId: row.text_channel_id
  };
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const result = await pool.query<GuildSettingsRow>(
    'SELECT auto_join, text_channel_id FROM guild_settings WHERE guild_id = ? LIMIT 1',
    [guildId]
  );

  if (result.rowCount === 0) {
    return { ...defaultSettings };
  }

  return mapRow(result.rows[0]);
}

export async function setGuildAutoJoin(guildId: string, autoJoin: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO guild_settings (guild_id, auto_join, text_channel_id)
     VALUES (?, ?, NULL)
     ON CONFLICT (guild_id)
     DO UPDATE SET auto_join = excluded.auto_join, updated_at = CURRENT_TIMESTAMP`,
    [guildId, autoJoin ? 1 : 0]
  );
}

export async function setGuildPreferredTextChannel(
  guildId: string,
  textChannelId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO guild_settings (guild_id, auto_join, text_channel_id)
     VALUES (?, 1, ?)
     ON CONFLICT (guild_id)
     DO UPDATE SET text_channel_id = excluded.text_channel_id, updated_at = CURRENT_TIMESTAMP`,
    [guildId, textChannelId]
  );
}

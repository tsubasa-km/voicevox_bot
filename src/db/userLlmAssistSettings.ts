import { pool } from '@/db/pool.js';
import type { LlmProvider } from '@/llm/types.js';

export interface UserLlmAssistSettings {
  enabled: boolean;
  provider: LlmProvider | null;
  apiKeyId: string | null;
  model: string | null;
}

export const defaultUserLlmAssistSettings: UserLlmAssistSettings = {
  enabled: false,
  provider: null,
  apiKeyId: null,
  model: null
};

type UserLlmAssistSettingsRow = {
  enabled: number;
  provider: LlmProvider | null;
  api_key_id: string | null;
  model: string | null;
};

function mapRow(row: UserLlmAssistSettingsRow): UserLlmAssistSettings {
  return {
    enabled: Boolean(row.enabled),
    provider: row.provider,
    apiKeyId: row.api_key_id,
    model: row.model
  };
}

export async function getUserLlmAssistSettings(
  guildId: string,
  userId: string
): Promise<UserLlmAssistSettings | null> {
  const result = await pool.query<UserLlmAssistSettingsRow>(
    `SELECT enabled, provider, api_key_id, model
     FROM user_llm_assist_settings
     WHERE guild_id = ? AND user_id = ?
     LIMIT 1`,
    [guildId, userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function setUserLlmAssistSettings(
  guildId: string,
  userId: string,
  settings: UserLlmAssistSettings
): Promise<void> {
  await pool.query(
    `INSERT INTO user_llm_assist_settings (
       guild_id,
       user_id,
       enabled,
       provider,
       api_key_id,
       model
     )
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET
       enabled = excluded.enabled,
       provider = excluded.provider,
       api_key_id = excluded.api_key_id,
       model = excluded.model,
       updated_at = CURRENT_TIMESTAMP`,
    [
      guildId,
      userId,
      settings.enabled ? 1 : 0,
      settings.provider,
      settings.apiKeyId,
      settings.model
    ]
  );
}

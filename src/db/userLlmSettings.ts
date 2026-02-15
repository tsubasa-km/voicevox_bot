import { pool } from '@/db/pool.js';
import type { LlmProvider } from '@/llm/types.js';

export interface UserLlmSettings {
  enabled: boolean;
  provider: LlmProvider | null;
  apiKeyId: string | null;
  model: string | null;
}

export interface UserLlmSettingsPatch {
  enabled?: boolean;
  provider?: LlmProvider | null;
  apiKeyId?: string | null;
  model?: string | null;
}

export const defaultUserLlmSettings: UserLlmSettings = {
  enabled: false,
  provider: null,
  apiKeyId: null,
  model: null
};

type UserLlmSettingsRow = {
  enabled: number;
  provider: LlmProvider | null;
  api_key_id: string | null;
  model: string | null;
};

function mapRow(row: UserLlmSettingsRow): UserLlmSettings {
  return {
    enabled: Boolean(row.enabled),
    provider: row.provider,
    apiKeyId: row.api_key_id,
    model: row.model
  };
}

export async function getUserLlmSettings(guildId: string, userId: string): Promise<UserLlmSettings | null> {
  const result = await pool.query<UserLlmSettingsRow>(
    `SELECT enabled, provider, api_key_id, model
     FROM user_llm_settings
     WHERE guild_id = ? AND user_id = ?
     LIMIT 1`,
    [guildId, userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function setUserLlmSettings(guildId: string, userId: string, settings: UserLlmSettings): Promise<void> {
  await pool.query(
    `INSERT INTO user_llm_settings (guild_id, user_id, enabled, provider, api_key_id, model)
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

export async function patchUserLlmSettings(
  guildId: string,
  userId: string,
  patch: UserLlmSettingsPatch
): Promise<UserLlmSettings> {
  const current = (await getUserLlmSettings(guildId, userId)) ?? defaultUserLlmSettings;
  const merged: UserLlmSettings = {
    enabled: patch.enabled ?? current.enabled,
    provider: patch.provider === undefined ? current.provider : patch.provider,
    apiKeyId: patch.apiKeyId === undefined ? current.apiKeyId : patch.apiKeyId,
    model: patch.model === undefined ? current.model : patch.model
  };

  await setUserLlmSettings(guildId, userId, merged);
  return merged;
}

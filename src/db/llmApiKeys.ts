import { pool } from '@/db/pool.js';
import { resolveScopeGuildId } from '@/llm/types.js';
import type { LlmApiKeyScope, LlmProvider } from '@/llm/types.js';
import { encryptSecret } from '@/utils/crypto.js';

interface LlmApiKeyRow {
  id: number;
  scope: LlmApiKeyScope;
  guild_id: string;
  provider: LlmProvider;
  key_id: string;
  encrypted_key: string;
  iv: string;
  auth_tag: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface LlmApiKeyRecord {
  id: number;
  scope: LlmApiKeyScope;
  guildId: string;
  provider: LlmProvider;
  keyId: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertApiKeyInput {
  scope: LlmApiKeyScope;
  guildId: string;
  provider: LlmProvider;
  keyId: string;
  plainApiKey: string;
  allowedUserIds: string[];
  actorUserId: string;
  masterKey: Buffer;
}

function mapRow(row: LlmApiKeyRow): LlmApiKeyRecord {
  return {
    id: row.id,
    scope: row.scope,
    guildId: row.guild_id,
    provider: row.provider,
    keyId: row.key_id,
    encryptedKey: row.encrypted_key,
    iv: row.iv,
    authTag: row.auth_tag,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getLlmApiKey(
  scope: LlmApiKeyScope,
  guildId: string,
  provider: LlmProvider,
  keyId: string
): Promise<LlmApiKeyRecord | null> {
  const targetGuildId = resolveScopeGuildId(scope, guildId);
  const result = await pool.query<LlmApiKeyRow>(
    `SELECT id, scope, guild_id, provider, key_id, encrypted_key, iv, auth_tag, created_by_user_id, created_at, updated_at
     FROM llm_api_keys
     WHERE scope = ? AND guild_id = ? AND provider = ? AND key_id = ?
     LIMIT 1`,
    [scope, targetGuildId, provider, keyId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

async function replaceAllowedUsers(apiKeyPk: number, allowedUserIds: string[]): Promise<void> {
  await pool.query('DELETE FROM llm_api_key_access WHERE api_key_pk = ?', [apiKeyPk]);

  const uniqueUsers = Array.from(
    new Set(
      allowedUserIds
        .map((userId) => userId.trim())
        .filter((userId) => userId.length > 0)
    )
  );

  for (const allowedUserId of uniqueUsers) {
    await pool.query(
      `INSERT INTO llm_api_key_access (api_key_pk, allowed_user_id)
       VALUES (?, ?)`,
      [apiKeyPk, allowedUserId]
    );
  }
}

export async function upsertApiKey(input: UpsertApiKeyInput): Promise<{ created: boolean; key: LlmApiKeyRecord }> {
  const scopeGuildId = resolveScopeGuildId(input.scope, input.guildId);
  const encrypted = encryptSecret(input.plainApiKey, input.masterKey);

  const existing = await getLlmApiKey(input.scope, input.guildId, input.provider, input.keyId);
  if (existing) {
    await pool.query(
      `UPDATE llm_api_keys
       SET encrypted_key = ?, iv = ?, auth_tag = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [encrypted.encryptedValue, encrypted.iv, encrypted.authTag, existing.id]
    );

    await replaceAllowedUsers(existing.id, input.allowedUserIds);

    const updated = await getLlmApiKey(input.scope, input.guildId, input.provider, input.keyId);
    if (!updated) {
      throw new Error('Failed to read updated LLM API key');
    }
    return { created: false, key: updated };
  }

  await pool.query(
    `INSERT INTO llm_api_keys (
      scope,
      guild_id,
      provider,
      key_id,
      encrypted_key,
      iv,
      auth_tag,
      created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.scope,
      scopeGuildId,
      input.provider,
      input.keyId,
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag,
      input.actorUserId
    ]
  );

  const created = await getLlmApiKey(input.scope, input.guildId, input.provider, input.keyId);
  if (!created) {
    throw new Error('Failed to read created LLM API key');
  }

  await replaceAllowedUsers(created.id, input.allowedUserIds);

  const withAccess = await getLlmApiKey(input.scope, input.guildId, input.provider, input.keyId);
  if (!withAccess) {
    throw new Error('Failed to read created LLM API key');
  }

  return { created: true, key: withAccess };
}

export async function deleteApiKey(
  scope: LlmApiKeyScope,
  guildId: string,
  provider: LlmProvider,
  keyId: string
): Promise<boolean> {
  const targetGuildId = resolveScopeGuildId(scope, guildId);
  const result = await pool.query(
    `DELETE FROM llm_api_keys
     WHERE scope = ? AND guild_id = ? AND provider = ? AND key_id = ?`,
    [scope, targetGuildId, provider, keyId]
  );

  return result.rowCount > 0;
}

export function canManageApiKey(apiKey: LlmApiKeyRecord, actorUserId: string, actorHasManageGuild: boolean): boolean {
  return actorHasManageGuild || apiKey.createdByUserId === actorUserId;
}

export async function listAccessibleApiKeys(guildId: string, userId: string): Promise<LlmApiKeyRecord[]> {
  const result = await pool.query<LlmApiKeyRow>(
    `SELECT k.id, k.scope, k.guild_id, k.provider, k.key_id, k.encrypted_key, k.iv, k.auth_tag, k.created_by_user_id, k.created_at, k.updated_at
     FROM llm_api_keys k
     INNER JOIN llm_api_key_access a ON a.api_key_pk = k.id
     WHERE a.allowed_user_id = ?
       AND (
         (k.scope = 'guild' AND k.guild_id = ?)
         OR (k.scope = 'global' AND k.guild_id = '*')
       )
     ORDER BY k.provider ASC, CASE WHEN k.scope = 'guild' THEN 0 ELSE 1 END, k.key_id ASC`,
    [userId, guildId]
  );

  return result.rows.map(mapRow);
}

export async function findAccessibleApiKey(
  guildId: string,
  userId: string,
  provider: LlmProvider,
  keyId: string
): Promise<LlmApiKeyRecord | null> {
  const result = await pool.query<LlmApiKeyRow>(
    `SELECT k.id, k.scope, k.guild_id, k.provider, k.key_id, k.encrypted_key, k.iv, k.auth_tag, k.created_by_user_id, k.created_at, k.updated_at
     FROM llm_api_keys k
     INNER JOIN llm_api_key_access a ON a.api_key_pk = k.id
     WHERE a.allowed_user_id = ?
       AND k.provider = ?
       AND k.key_id = ?
       AND (
         (k.scope = 'guild' AND k.guild_id = ?)
         OR (k.scope = 'global' AND k.guild_id = '*')
       )
     ORDER BY CASE WHEN k.scope = 'guild' THEN 0 ELSE 1 END
     LIMIT 1`,
    [userId, provider, keyId, guildId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function findAccessibleApiKeysByProvider(
  guildId: string,
  userId: string,
  provider: LlmProvider
): Promise<LlmApiKeyRecord[]> {
  const result = await pool.query<LlmApiKeyRow>(
    `SELECT k.id, k.scope, k.guild_id, k.provider, k.key_id, k.encrypted_key, k.iv, k.auth_tag, k.created_by_user_id, k.created_at, k.updated_at
     FROM llm_api_keys k
     INNER JOIN llm_api_key_access a ON a.api_key_pk = k.id
     WHERE a.allowed_user_id = ?
       AND k.provider = ?
       AND (
         (k.scope = 'guild' AND k.guild_id = ?)
         OR (k.scope = 'global' AND k.guild_id = '*')
       )
     ORDER BY CASE WHEN k.scope = 'guild' THEN 0 ELSE 1 END, k.updated_at ASC, k.key_id ASC`,
    [userId, provider, guildId]
  );

  return result.rows.map(mapRow);
}

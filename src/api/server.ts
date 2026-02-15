import type { Client, Guild } from 'discord.js';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from '@/utils/logger.js';
import type { VoiceManager } from '@/voice/voiceManager.js';
import type { VoiceVoxService } from '@/services/voicevox.js';
import type { LlmNormalizer } from '@/services/llmNormalizer.js';
import type { UserVoiceSettings } from '@/db/userSpeakers.js';
import type { UserLlmSettings } from '@/db/userLlmSettings.js';
import { defaultUserLlmSettings } from '@/db/userLlmSettings.js';
import { resolveSpeakerId } from '@/utils/speakerResolver.js';
import { isLlmProvider } from '@/llm/types.js';
import type { LlmProvider } from '@/llm/types.js';

export interface ApiServerDependencies {
  client: Client;
  voiceManager: VoiceManager;
  voiceVoxService: VoiceVoxService;
  llmNormalizer: LlmNormalizer;
  getUserVoiceSettings: (guildId: string, userId: string) => Promise<UserVoiceSettings | null>;
  setUserSpeakerId: (guildId: string, userId: string, speakerId: number) => Promise<void>;
  setUserPitch: (guildId: string, userId: string, pitch: number, defaultSpeakerId: number) => Promise<void>;
  setUserSpeed: (guildId: string, userId: string, speed: number, defaultSpeakerId: number) => Promise<void>;
  getUserLlmSettings: (guildId: string, userId: string) => Promise<UserLlmSettings | null>;
  setUserLlmSettings: (guildId: string, userId: string, settings: UserLlmSettings) => Promise<void>;
  findAccessibleLlmApiKey: (
    guildId: string,
    userId: string,
    provider: LlmProvider,
    keyId: string
  ) => Promise<unknown | null>;
  defaultSpeakerId: number;
  defaultPitch: number;
  defaultSpeed: number;
  maxUtteranceLength: number;
  apiKey: string;
  port: number;
  hostname?: string;
}

export interface ApiServerHandle {
  stop: () => Promise<void>;
}

interface UpdateUserSettingsBody {
  speakerId?: unknown;
  pitch?: unknown;
  speed?: unknown;
  llmEnabled?: unknown;
  llmProvider?: unknown;
  llmApiKeyId?: unknown;
  llmModel?: unknown;
}

interface SpeechRequestBody {
  guildId?: unknown;
  userId?: unknown;
  text?: unknown;
  textChannelId?: unknown;
  speakerId?: unknown;
  pitch?: unknown;
  speed?: unknown;
}

type ClosableServer = {
  close: (callback: (error?: Error) => void) => void;
};

function parseOptionalNonEmptyString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string or null`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
  return trimmed;
}

export function startApiServer(deps: ApiServerDependencies): ApiServerHandle {
  const app = new Hono();

  app.use('*', async (c: Context, next: Next) => {
    const providedKey = c.req.header('x-api-key');
    if (providedKey !== deps.apiKey) {
      logger.warn('API request rejected due to invalid API key');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  });

  app.patch('/settings/users/:guildId/:userId', async (c) => {
    const { guildId, userId } = c.req.param();

    let body: UpdateUserSettingsBody;
    try {
      body = (await c.req.json()) as UpdateUserSettingsBody;
    } catch (error) {
      logger.debug('Failed to parse settings update payload', error as Error);
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const tasks: Promise<void>[] = [];
    const payloadKeys: string[] = [];

    if (Object.prototype.hasOwnProperty.call(body, 'speakerId')) {
      payloadKeys.push('speakerId');
      const speakerId = Number(body.speakerId);
      if (!Number.isInteger(speakerId) || speakerId < 0) {
        return c.json({ error: 'speakerId must be a non-negative integer' }, 400);
      }

      try {
        const styles = await deps.voiceVoxService.listSpeakerStyles();
        const selected = styles.find((style) => style.styleId === speakerId);
        if (!selected) {
          return c.json({ error: `speakerId ${speakerId} was not found` }, 400);
        }
      } catch (error) {
        logger.error('Failed to validate speakerId against VoiceVox styles', error as Error);
        return c.json({ error: 'Failed to validate speakerId' }, 502);
      }

      tasks.push(deps.setUserSpeakerId(guildId, userId, speakerId));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'pitch')) {
      payloadKeys.push('pitch');
      const pitch = Number(body.pitch);
      if (!Number.isFinite(pitch)) {
        return c.json({ error: 'pitch must be a finite number' }, 400);
      }
      tasks.push(deps.setUserPitch(guildId, userId, pitch, deps.defaultSpeakerId));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'speed')) {
      payloadKeys.push('speed');
      const speed = Number(body.speed);
      if (!Number.isFinite(speed)) {
        return c.json({ error: 'speed must be a finite number' }, 400);
      }
      tasks.push(deps.setUserSpeed(guildId, userId, speed, deps.defaultSpeakerId));
    }

    let llmSettingsToApply: UserLlmSettings | null = null;
    const hasLlmField =
      Object.prototype.hasOwnProperty.call(body, 'llmEnabled') ||
      Object.prototype.hasOwnProperty.call(body, 'llmProvider') ||
      Object.prototype.hasOwnProperty.call(body, 'llmApiKeyId') ||
      Object.prototype.hasOwnProperty.call(body, 'llmModel');

    if (hasLlmField) {
      const currentLlm = (await deps.getUserLlmSettings(guildId, userId)) ?? defaultUserLlmSettings;
      const nextLlm: UserLlmSettings = { ...currentLlm };

      if (Object.prototype.hasOwnProperty.call(body, 'llmEnabled')) {
        payloadKeys.push('llmEnabled');
        if (body.llmEnabled === null) {
          nextLlm.enabled = false;
        } else if (typeof body.llmEnabled === 'boolean') {
          nextLlm.enabled = body.llmEnabled;
        } else {
          return c.json({ error: 'llmEnabled must be boolean or null' }, 400);
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, 'llmProvider')) {
        payloadKeys.push('llmProvider');
        if (body.llmProvider === null) {
          nextLlm.provider = null;
        } else if (isLlmProvider(body.llmProvider)) {
          nextLlm.provider = body.llmProvider;
        } else {
          return c.json({ error: 'llmProvider must be one of: gemini, openai, or null' }, 400);
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, 'llmApiKeyId')) {
        payloadKeys.push('llmApiKeyId');
        try {
          nextLlm.apiKeyId = parseOptionalNonEmptyString(body.llmApiKeyId, 'llmApiKeyId');
        } catch (error) {
          return c.json({ error: (error as Error).message }, 400);
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, 'llmModel')) {
        payloadKeys.push('llmModel');
        try {
          nextLlm.model = parseOptionalNonEmptyString(body.llmModel, 'llmModel');
        } catch (error) {
          return c.json({ error: (error as Error).message }, 400);
        }
      }

      if (nextLlm.apiKeyId && !nextLlm.provider) {
        return c.json({ error: 'llmApiKeyId requires llmProvider' }, 400);
      }

      if (nextLlm.provider && nextLlm.apiKeyId) {
        const key = await deps.findAccessibleLlmApiKey(guildId, userId, nextLlm.provider, nextLlm.apiKeyId);
        if (!key) {
          return c.json({ error: `LLM API key ${nextLlm.provider}/${nextLlm.apiKeyId} is not accessible` }, 400);
        }
      }

      llmSettingsToApply = nextLlm;
      tasks.push(deps.setUserLlmSettings(guildId, userId, nextLlm));
    }

    if (tasks.length === 0) {
      return c.json({ error: 'No supported fields were provided' }, 400);
    }

    try {
      await Promise.all(tasks);
    } catch (error) {
      logger.error('Failed to persist user settings update', error as Error);
      return c.json({ error: 'Failed to update settings' }, 500);
    }

    const updatedVoice = await deps.getUserVoiceSettings(guildId, userId);
    const mergedVoice = updatedVoice ?? {
      speakerId: null,
      pitch: deps.defaultPitch,
      speed: deps.defaultSpeed
    };
    const resolvedSpeakerId = await resolveSpeakerId({
      guildId,
      userId,
      configuredSpeakerId: mergedVoice.speakerId,
      defaultSpeakerId: deps.defaultSpeakerId,
      voiceVoxService: deps.voiceVoxService
    });

    const updatedLlm = llmSettingsToApply ?? (await deps.getUserLlmSettings(guildId, userId)) ?? defaultUserLlmSettings;

    return c.json({
      ok: true,
      updatedFields: payloadKeys,
      settings: {
        speakerId: resolvedSpeakerId,
        pitch: mergedVoice.pitch,
        speed: mergedVoice.speed,
        llmEnabled: updatedLlm.enabled,
        llmProvider: updatedLlm.provider,
        llmApiKeyId: updatedLlm.apiKeyId,
        llmModel: updatedLlm.model
      }
    });
  });

  app.post('/speech', async (c) => {
    let body: SpeechRequestBody;
    try {
      body = (await c.req.json()) as SpeechRequestBody;
    } catch (error) {
      logger.debug('Failed to parse speech request payload', error as Error);
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const userId = typeof body.userId === 'string' ? body.userId : null;
    const text = typeof body.text === 'string' ? body.text : null;
    const guildIdHint = typeof body.guildId === 'string' ? body.guildId : null;
    const textChannelOverride = typeof body.textChannelId === 'string' ? body.textChannelId : null;

    if (!userId || !text) {
      return c.json({ error: 'userId and text are required' }, 400);
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return c.json({ error: 'text must not be empty' }, 400);
    }

    if (trimmedText.length > deps.maxUtteranceLength) {
      return c.json({
        error: `text exceeds maximum length of ${deps.maxUtteranceLength}`
      }, 400);
    }

    let targetGuild: Guild | null = null;

    const locateGuild = async (guild: Guild): Promise<Guild | null> => {
      try {
        const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
        if (member.voice.channelId) {
          return guild;
        }
      } catch (error) {
        logger.debug(`User ${userId} not found in guild ${guild.id}`, error as Error);
      }
      return null;
    };

    if (guildIdHint) {
      const cached = deps.client.guilds.cache.get(guildIdHint);
      if (cached) {
        targetGuild = await locateGuild(cached);
      } else {
        try {
          const fetched = await deps.client.guilds.fetch(guildIdHint);
          targetGuild = await locateGuild(fetched);
        } catch (error) {
          logger.debug(`Failed to fetch guild ${guildIdHint}`, error as Error);
        }
      }
    } else {
      for (const guild of deps.client.guilds.cache.values()) {
        targetGuild = await locateGuild(guild);
        if (targetGuild) {
          break;
        }
      }
    }

    if (!targetGuild) {
      return c.json({ error: 'User is not in a voice channel accessible to the bot' }, 404);
    }

    const guildId = targetGuild.id;
    let member;
    try {
      member = targetGuild.members.cache.get(userId) ?? (await targetGuild.members.fetch(userId));
    } catch (error) {
      logger.debug(`Failed to fetch member ${userId} in guild ${guildId}`, error as Error);
      return c.json({ error: 'Failed to resolve user in guild' }, 404);
    }

    const userVoiceChannelId = member.voice.channelId;
    if (!userVoiceChannelId) {
      return c.json({ error: 'User is not connected to a voice channel' }, 409);
    }

    const botVoiceChannelId = deps.voiceManager.getVoiceChannelId(guildId);
    if (!botVoiceChannelId) {
      return c.json({ error: 'Bot is not connected to any voice channel in this guild' }, 409);
    }

    if (userVoiceChannelId !== botVoiceChannelId) {
      return c.json({ error: 'User is not in the same voice channel as the bot' }, 409);
    }

    const textChannelId = textChannelOverride ?? deps.voiceManager.getTextChannelId(guildId);
    if (!textChannelId) {
      return c.json({ error: 'No text channel is currently associated with the voice session' }, 409);
    }

    const userSettings = await deps.getUserVoiceSettings(guildId, userId);

    const speakerId = body.speakerId !== undefined ? Number(body.speakerId) : undefined;
    if (speakerId !== undefined && (!Number.isInteger(speakerId) || speakerId < 0)) {
      return c.json({ error: 'speakerId must be a non-negative integer' }, 400);
    }

    const pitchOverride = body.pitch !== undefined ? Number(body.pitch) : undefined;
    if (pitchOverride !== undefined && !Number.isFinite(pitchOverride)) {
      return c.json({ error: 'pitch must be a finite number' }, 400);
    }

    const speedOverride = body.speed !== undefined ? Number(body.speed) : undefined;
    if (speedOverride !== undefined && !Number.isFinite(speedOverride)) {
      return c.json({ error: 'speed must be a finite number' }, 400);
    }

    const resolvedSpeakerId = await resolveSpeakerId({
      guildId,
      userId,
      configuredSpeakerId: speakerId ?? userSettings?.speakerId,
      defaultSpeakerId: deps.defaultSpeakerId,
      voiceVoxService: deps.voiceVoxService
    });
    const resolvedPitch = pitchOverride ?? userSettings?.pitch ?? deps.defaultPitch;
    const resolvedSpeed = speedOverride ?? userSettings?.speed ?? deps.defaultSpeed;

    const normalizedText = await deps.llmNormalizer.normalize({
      guildId,
      userId,
      text: trimmedText
    });

    const accepted = deps.voiceManager.dispatchSpeech(guildId, textChannelId, {
      text: normalizedText,
      speakerId: resolvedSpeakerId,
      pitch: resolvedPitch,
      speed: resolvedSpeed
    });

    if (!accepted) {
      return c.json({ error: 'Voice manager rejected the speech request' }, 409);
    }

    return c.json({
      ok: true,
      guildId,
      voiceChannelId: botVoiceChannelId,
      textChannelId,
      appliedSettings: {
        speakerId: resolvedSpeakerId,
        pitch: resolvedPitch,
        speed: resolvedSpeed
      }
    });
  });

  const server = serve({
    fetch: app.fetch,
    port: deps.port,
    hostname: deps.hostname ?? '0.0.0.0'
  });

  logger.info(`External API server listening on http://${deps.hostname ?? '0.0.0.0'}:${deps.port}`);

  return {
    stop: () =>
      new Promise<void>((resolve, reject) => {
        const closable = server as unknown as Partial<ClosableServer>;
        if (typeof closable.close !== 'function') {
          resolve();
          return;
        }
        closable.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

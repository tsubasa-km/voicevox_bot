import type { Client, Guild } from 'discord.js';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from '@/utils/logger.js';
import type { VoiceManager } from '@/voice/voiceManager.js';
import type { VoiceVoxService } from '@/services/voicevox.js';
import type { UserVoiceSettings } from '@/db/userSpeakers.js';

export interface ApiServerDependencies {
  client: Client;
  voiceManager: VoiceManager;
  voiceVoxService: VoiceVoxService;
  getUserVoiceSettings: (guildId: string, userId: string) => Promise<UserVoiceSettings | null>;
  setUserSpeakerId: (guildId: string, userId: string, speakerId: number) => Promise<void>;
  setUserPitch: (guildId: string, userId: string, pitch: number, defaultSpeakerId: number) => Promise<void>;
  setUserSpeed: (guildId: string, userId: string, speed: number, defaultSpeakerId: number) => Promise<void>;
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

    if (tasks.length === 0) {
      return c.json({ error: 'No supported fields were provided' }, 400);
    }

    try {
      await Promise.all(tasks);
    } catch (error) {
      logger.error('Failed to persist user settings update', error as Error);
      return c.json({ error: 'Failed to update settings' }, 500);
    }

    const updated = await deps.getUserVoiceSettings(guildId, userId);

    return c.json({
      ok: true,
      updatedFields: payloadKeys,
      settings: updated ?? {
        speakerId: deps.defaultSpeakerId,
        pitch: deps.defaultPitch,
        speed: deps.defaultSpeed
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

    const resolvedSpeakerId = speakerId ?? userSettings?.speakerId ?? deps.defaultSpeakerId;
    const resolvedPitch = pitchOverride ?? userSettings?.pitch ?? deps.defaultPitch;
    const resolvedSpeed = speedOverride ?? userSettings?.speed ?? deps.defaultSpeed;

    const accepted = deps.voiceManager.dispatchSpeech(guildId, textChannelId, {
      text: trimmedText,
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

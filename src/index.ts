import type { Guild, VoiceBasedChannel } from 'discord.js';
import { ChannelType, Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { config } from '@/config.js';
import { VoiceVoxService } from '@/services/voicevox.js';
import { VoiceManager } from '@/voice/voiceManager.js';
import { buildCommands } from '@/commands/index.js';
import type { Command } from '@/commands/types.js';
import { getUserSpeakerId, setUserSpeakerId } from '@/db/userSpeakers.js';
import { formatMessageContent } from '@/utils/textFormatter.js';
import { logger } from '@/utils/logger.js';
import { runMigrations, shutdownDb } from '@/db/pool.js';
import {
  getGuildSettings,
  setGuildAutoJoin,
  setGuildPreferredTextChannel
} from '@/db/guildSettings.js';

async function fetchVoiceChannel(guild: Guild, channelId: string): Promise<VoiceBasedChannel | null> {
  const cached = guild.channels.cache.get(channelId);
  if (cached?.isVoiceBased()) {
    return cached as VoiceBasedChannel;
  }

  try {
    const fetched = await guild.channels.fetch(channelId);
    if (fetched?.isVoiceBased()) {
      return fetched as VoiceBasedChannel;
    }
  } catch (error) {
    logger.warn(`Failed to fetch voice channel ${channelId} in guild ${guild.id}`, error);
  }

  return null;
}

async function resolveTextChannelId(
  guildId: string,
  preferredChannelId: string | null,
  guild: Guild
): Promise<string | null> {
  if (preferredChannelId) {
    const cached = guild.channels.cache.get(preferredChannelId);
    if (cached?.type === ChannelType.GuildText) {
      return preferredChannelId;
    }
    try {
      const fetched = await guild.channels.fetch(preferredChannelId);
      if (fetched?.type === ChannelType.GuildText) {
        return preferredChannelId;
      }
    } catch (error) {
      logger.warn(`Preferred text channel ${preferredChannelId} unavailable in guild ${guildId}`, error);
    }
  }

  if (guild.systemChannelId) {
    return guild.systemChannelId;
  }

  const fallback = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText);
  return fallback?.id ?? null;
}

async function bootstrap(): Promise<void> {
  await runMigrations();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent
    ]
  });

  const voiceVoxService = new VoiceVoxService(config.voiceVoxApiUrl);
  const voiceManager = new VoiceManager(voiceVoxService);

  const commands = buildCommands({
    voiceManager,
    voiceVoxService,
    getUserSpeakerId,
    setUserSpeakerId,
    defaultSpeakerId: config.defaultSpeakerId,
    getGuildSettings,
    setGuildAutoJoin,
    setGuildPreferredTextChannel
  });

  const commandMap = new Collection<string, Command>();
  commands.forEach((command) => {
    commandMap.set(command.data.name, command);
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Command execution failed (${interaction.commandName})`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('コマンドの実行中にエラーが発生しました。');
      } else {
        await interaction.reply({
          content: 'コマンドの実行中にエラーが発生しました。',
          ephemeral: true
        });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) {
      return;
    }

    const formatted = formatMessageContent(message);
    if (!formatted) {
      return;
    }

    const guildId = message.guild.id;
    await setGuildPreferredTextChannel(guildId, message.channelId);
    const speakerId = (await getUserSpeakerId(guildId, message.author.id)) ?? config.defaultSpeakerId;
    const accepted = voiceManager.dispatchSpeech(guildId, message.channelId, {
      text: formatted,
      speakerId
    });

    if (!accepted) {
      logger.debug(
        `Message from channel ${message.channelId} in guild ${guildId} skipped (voice session not active or different channel)`
      );
      return;
    }
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const guild = newState.guild ?? oldState.guild;
    if (!guild) {
      return;
    }

    const guildId = guild.id;

    const joinedChannelId = newState.channelId;
    const leftChannelId = oldState.channelId;
    const member = newState.member ?? oldState.member;
    const isBot = member?.user?.bot ?? false;

    if (!isBot && joinedChannelId && joinedChannelId !== leftChannelId && !voiceManager.isConnected(guildId)) {
      try {
        const settings = await getGuildSettings(guildId);
        if (settings.autoJoin) {
          const targetVoiceChannel = newState.channel;
          if (targetVoiceChannel) {
            const preferredTextChannelId = await resolveTextChannelId(guildId, settings.textChannelId, guild);
            if (preferredTextChannelId) {
              try {
                await voiceManager.join(targetVoiceChannel, preferredTextChannelId);
                await setGuildPreferredTextChannel(guildId, preferredTextChannelId);
                logger.info(
                  `Auto-joined voice channel ${targetVoiceChannel.id} in guild ${guildId} because a member joined`
                );
              } catch (error) {
                logger.error('Failed to auto-join voice channel', error);
              }
            } else {
              logger.warn(`Auto-join skipped for guild ${guildId} because no suitable text channel was found`);
            }
          }
        }
      } catch (error) {
        logger.error('Failed to process auto-join logic', error);
      }
    }

    const activeVoiceChannelId = voiceManager.getVoiceChannelId(guildId);
    if (!activeVoiceChannelId) {
      return;
    }

    if (joinedChannelId === activeVoiceChannelId || leftChannelId === activeVoiceChannelId) {
      const channel = await fetchVoiceChannel(guild, activeVoiceChannelId);
      if (!channel) {
        return;
      }

      const nonBotMembers = channel.members.filter((guildMember) => !guildMember.user.bot);
      if (nonBotMembers.size === 0) {
        voiceManager.leave(guildId);
        logger.info(`Left voice channel ${activeVoiceChannelId} in guild ${guildId} because only the bot remained`);
      }
    }
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    voiceManager.destroyAll();
    await shutdownDb();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await client.login(config.discordToken);
}

void bootstrap();

import {
  AudioPlayer,
  AudioPlayerStatus,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel
} from '@discordjs/voice';
import type { DiscordGatewayAdapterCreator } from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import { Readable } from 'node:stream';
import { VoiceVoxService } from '@/services/voicevox.js';
import { logger } from '@/utils/logger.js';

interface SpeechTask {
  text: string;
  speakerId: number;
  pitch: number;
  speed: number;
}

class VoiceSession {
  private readonly player: AudioPlayer;
  private readonly queue: SpeechTask[] = [];
  private isProcessing = false;
  private destroyed = false;
  private textChannelId: string;
  private readonly voiceChannelId: string;

  constructor(
    private readonly connection: VoiceConnection,
    private readonly voiceVoxService: VoiceVoxService,
    textChannelId: string,
    voiceChannelId: string,
    private readonly onDestroyed: () => void
  ) {
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;
    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on('error', (error) => {
      logger.error('Audio player error', error);
    });

    this.connection.on('error', (error) => {
      logger.error('Voice connection error', error);
      this.destroy();
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, () => {
      this.destroy();
    });
  }

  canHandleChannel(textChannelId: string): boolean {
    return this.textChannelId === textChannelId;
  }

  updateTextChannel(textChannelId: string): void {
    this.textChannelId = textChannelId;
  }

  getTextChannelId(): string {
    return this.textChannelId;
  }

  getVoiceChannelId(): string {
    return this.voiceChannelId;
  }

  enqueue(task: SpeechTask): void {
    if (this.destroyed) {
      return;
    }
    this.queue.push(task);
    void this.processQueue();
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task) {
          continue;
        }

        try {
          const audioBuffer = await this.voiceVoxService.synthesizeSpeech(task.text, task.speakerId, {
            pitch: task.pitch,
            speed: task.speed
          });
          const resource = createAudioResource(Readable.from([audioBuffer]), {
            inputType: StreamType.Arbitrary
          });

          this.player.play(resource);
          try {
            await entersState(this.player, AudioPlayerStatus.Playing, 5_000);
          } catch (error) {
            logger.error('Failed to start playback', error);
            continue;
          }

          await new Promise<void>((resolve) => {
            const cleanup = () => {
              this.player.removeListener(AudioPlayerStatus.Idle, onIdle);
              this.player.removeListener('error', onError);
              resolve();
            };

            const onIdle = () => {
              cleanup();
            };

            const onError = (error: Error) => {
              logger.error('Audio playback error', error);
              cleanup();
            };

            this.player.once(AudioPlayerStatus.Idle, onIdle);
            this.player.once('error', onError);
          });
        } catch (error) {
          logger.error('Failed to synthesize speech', error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    try {
      this.player.stop(true);
      this.connection.destroy();
    } catch (error) {
      logger.error('Error while destroying voice session', error);
    }
    this.destroyed = true;
    this.onDestroyed();
    logger.debug(`Destroyed voice session for channel ${this.textChannelId}`);
  }
}

export class VoiceManager {
  private readonly sessions = new Map<string, VoiceSession>();

  constructor(private readonly voiceVoxService: VoiceVoxService) {}

  async join(voiceChannel: VoiceBasedChannel, textChannelId: string): Promise<void> {
    const existing = this.sessions.get(voiceChannel.guild.id);
    if (existing) {
      existing.updateTextChannel(textChannelId);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: false
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

    const session = new VoiceSession(
      connection,
      this.voiceVoxService,
      textChannelId,
      voiceChannel.id,
      () => this.sessions.delete(voiceChannel.guild.id)
    );
    this.sessions.set(voiceChannel.guild.id, session);
    logger.info(`Joined voice channel ${voiceChannel.id} in guild ${voiceChannel.guild.id}`);
  }

  leave(guildId: string): void {
    const session = this.sessions.get(guildId);
    if (session) {
      session.destroy();
      this.sessions.delete(guildId);
      logger.info(`Left voice channel in guild ${guildId}`);
    }
  }

  isConnected(guildId: string): boolean {
    return this.sessions.has(guildId);
  }

  updateTextChannel(guildId: string, textChannelId: string): void {
    const session = this.sessions.get(guildId);
    if (session) {
      session.updateTextChannel(textChannelId);
    }
  }

  dispatchSpeech(guildId: string, textChannelId: string, task: SpeechTask): boolean {
    const session = this.sessions.get(guildId);
    if (!session) {
      logger.debug(`No active voice session for guild ${guildId}`);
      return false;
    }

    if (!session.canHandleChannel(textChannelId)) {
      logger.debug(
        `Switching tracked text channel from ${session.getTextChannelId()} to ${textChannelId} for guild ${guildId}`
      );
      session.updateTextChannel(textChannelId);
    }

    session.enqueue(task);
    return true;
  }

  destroyAll(): void {
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      session.destroy();
    }
    this.sessions.clear();
  }

  getVoiceChannelId(guildId: string): string | null {
    const session = this.sessions.get(guildId);
    return session ? session.getVoiceChannelId() : null;
  }

  getTextChannelId(guildId: string): string | null {
    const session = this.sessions.get(guildId);
    return session ? session.getTextChannelId() : null;
  }
}

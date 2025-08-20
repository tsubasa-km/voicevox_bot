import {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { Readable } from "node:stream";
import { Guild, VoiceChannel } from "discord.js";
import { voiceVoxService } from "@/services/voicevox.js";
import { db } from "@/services/database.js";
import { ErrorHandler } from "@/utils/error-handler.js";

export class VoiceService {
  async playTextToSpeech(
    text: string,
    guildId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const connection = getVoiceConnection(guildId);
      if (!connection) {
        return false;
      }

      const buffer = await voiceVoxService.textToSpeech(text, guildId, userId);
      if (!buffer) {
        return false;
      }

      const audioStream = new Readable();
      audioStream.push(buffer);
      audioStream.push(null);

      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Arbitrary,
      });

      const player = createAudioPlayer();
      player.play(resource);

      connection.subscribe(player);
      return true;
    } catch (error) {
      ErrorHandler.logError("Voice TTS Playback", error as Error);
      return false;
    }
  }

  joinVoiceChannel(channel: VoiceChannel) {
    try {
      return joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: false,
        selfDeaf: false,
      });
    } catch (error) {
      ErrorHandler.logError("Join Voice Channel", error as Error);
      throw error;
    }
  }

  leaveVoiceChannel(guild: Guild): void {
    try {
      const connection = getVoiceConnection(guild.id);
      if (connection) {
        connection.destroy();
      }
    } catch (error) {
      ErrorHandler.logError("Leave Voice Channel", error as Error);
    }
  }

  async handleAutoConnect(guild: Guild, channelId: string): Promise<void> {
    try {
      const autoconnect = await db.getGuildAutoConnect(guild.id);
      if (autoconnect) {
        joinVoiceChannel({
          channelId: channelId,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfMute: false,
          selfDeaf: false,
        });
      }
    } catch (error) {
      ErrorHandler.logError("Auto Connect", error as Error);
    }
  }

  getVoiceConnection(guildId: string) {
    return getVoiceConnection(guildId);
  }
}

export const voiceService = new VoiceService();

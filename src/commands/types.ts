import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';
import type { VoiceManager } from '@/voice/voiceManager.js';
import type { VoiceVoxService } from '@/services/voicevox.js';
import type { GuildSettings } from '@/db/guildSettings.js';
import type { UserVoiceSettings } from '@/db/userSpeakers.js';

export interface CommandDependencies {
  voiceManager: VoiceManager;
  voiceVoxService: VoiceVoxService;
  getUserVoiceSettings: (guildId: string, userId: string) => Promise<UserVoiceSettings | null>;
  setUserSpeakerId: (guildId: string, userId: string, speakerId: number) => Promise<void>;
  setUserPitch: (guildId: string, userId: string, pitch: number, defaultSpeakerId: number) => Promise<void>;
  setUserSpeed: (guildId: string, userId: string, speed: number, defaultSpeakerId: number) => Promise<void>;
  defaultSpeakerId: number;
  getGuildSettings: (guildId: string) => Promise<GuildSettings>;
  setGuildAutoJoin: (guildId: string, enabled: boolean) => Promise<void>;
  setGuildPreferredTextChannel: (guildId: string, channelId: string) => Promise<void>;
}

export type SlashCommandData = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;

export interface Command {
  data: SlashCommandData;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

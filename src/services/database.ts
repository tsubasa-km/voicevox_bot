import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { config } from "../utils/config.js";
import { UserVoiceSettings } from "../types/voicevox.js";

class DatabaseService {
  private db: Keyv;

  constructor() {
    this.db = new Keyv(new KeyvSqlite(config.database.path));
    this.db.on("error", (err: Error) => console.error("Keyv connection error:", err));
  }

  // ユーザーの音声設定
  async getUserVoiceSettings(guildId: string, userId: string): Promise<UserVoiceSettings> {
    const speakerId = (await this.db.get(`${guildId}-speaker-${userId}`)) ?? "3";
    const pitchScale = (await this.db.get(`${guildId}-pitch-${userId}`)) ?? 0.0;
    const speedScale = (await this.db.get(`${guildId}-speed-${userId}`)) ?? 1.0;

    return {
      speakerId: String(speakerId),
      pitchScale: Number(pitchScale),
      speedScale: Number(speedScale),
    };
  }

  async setUserVoiceSetting(
    guildId: string,
    userId: string,
    setting: keyof UserVoiceSettings,
    value: string | number
  ): Promise<void> {
    const key = `${guildId}-${setting === 'speakerId' ? 'speaker' : setting}-${userId}`;
    await this.db.set(key, value);
  }

  // ギルド設定
  async getGuildAutoConnect(guildId: string): Promise<boolean> {
    const value = await this.db.get(`${guildId}-autoconnect`);
    return value === "on";
  }

  async setGuildAutoConnect(guildId: string, enabled: boolean): Promise<void> {
    await this.db.set(`${guildId}-autoconnect`, enabled ? "on" : "off");
  }

  // チャンネルミュート設定
  async isChannelMuted(guildId: string, channelId: string): Promise<boolean> {
    const value = await this.db.get(`${guildId}-channel-mute-${channelId}`);
    return value === "on";
  }

  async setChannelMute(guildId: string, channelId: string, muted: boolean): Promise<void> {
    await this.db.set(`${guildId}-channel-mute-${channelId}`, muted ? "on" : "off");
  }

  // 汎用メソッド（後方互換性のため）
  async get(key: string): Promise<any> {
    return this.db.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    await this.db.set(key, value);
  }
}

export const db = new DatabaseService();

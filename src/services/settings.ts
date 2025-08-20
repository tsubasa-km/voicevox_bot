import { db } from '@/services/database.js';
import { UserVoiceSettings } from '@/types/voicevox.js';
import { voiceVoxService } from '@/services/voicevox.js';

/**
 * 設定管理の共通サービス
 * APIとDiscordコマンドの両方から利用される
 */
export class SettingsService {
  // ========== ユーザー音声設定 ==========

  /**
   * 話者IDが有効かどうかを検証
   */
  private async validateSpeakerId(speakerId: string): Promise<boolean> {
    try {
      const speakers = await voiceVoxService.getSpeakers();
      const validIds = new Set<string>();
      
      speakers.forEach(speaker => {
        speaker.styles.forEach(style => {
          validIds.add(style.id.toString());
        });
      });
      
      return validIds.has(speakerId);
    } catch (error) {
      // VoiceVoxサービスにアクセスできない場合は、基本的な数値チェックのみ
      return /^\d+$/.test(speakerId);
    }
  }

  /**
   * 利用可能な話者IDの一覧を取得
   */
  async getAvailableSpeakerIds(): Promise<number[]> {
    try {
      const speakers = await voiceVoxService.getSpeakers();
      const ids: number[] = [];
      
      speakers.forEach(speaker => {
        speaker.styles.forEach(style => {
          ids.push(style.id);
        });
      });
      
      return ids.sort((a, b) => a - b);
    } catch (error) {
      throw new Error('話者一覧の取得に失敗しました。');
    }
  }
  
  /**
   * ユーザーの音声設定を取得
   */
  async getUserVoiceSettings(guildId: string, userId: string): Promise<UserVoiceSettings> {
    return await db.getUserVoiceSettings(guildId, userId);
  }

  /**
   * ユーザーの音声設定を一括更新
   */
  async updateUserVoiceSettings(
    guildId: string, 
    userId: string, 
    settings: Partial<UserVoiceSettings>
  ): Promise<void> {
    if (settings.speakerId !== undefined) {
      await this.setSpeakerId(guildId, userId, settings.speakerId);
    }
    if (settings.pitchScale !== undefined) {
      await db.setUserVoiceSetting(guildId, userId, 'pitchScale', settings.pitchScale);
    }
    if (settings.speedScale !== undefined) {
      await db.setUserVoiceSetting(guildId, userId, 'speedScale', settings.speedScale);
    }
  }

  /**
   * 話者IDを取得
   */
  async getSpeakerId(guildId: string, userId: string): Promise<string> {
    const settings = await this.getUserVoiceSettings(guildId, userId);
    return settings.speakerId;
  }

  /**
   * 話者IDを設定
   */
  async setSpeakerId(guildId: string, userId: string, speakerId: string): Promise<void> {
    // 基本的なバリデーション
    if (!speakerId || typeof speakerId !== 'string') {
      throw new Error('話者IDが無効です。');
    }

    // 数値形式チェック
    if (!/^\d+$/.test(speakerId)) {
      throw new Error('話者IDは数値である必要があります。');
    }

    // VoiceVoxサービスで利用可能な話者IDかチェック
    const isValid = await this.validateSpeakerId(speakerId);
    if (!isValid) {
      throw new Error(`話者ID ${speakerId} は利用できません。/voice speakers コマンドで利用可能な話者を確認してください。`);
    }
    
    await db.setUserVoiceSetting(guildId, userId, 'speakerId', speakerId);
  }  /**
   * ピッチを取得
   */
  async getPitchScale(guildId: string, userId: string): Promise<number> {
    const settings = await this.getUserVoiceSettings(guildId, userId);
    return settings.pitchScale;
  }

  /**
   * ピッチを設定
   */
  async setPitchScale(guildId: string, userId: string, pitchScale: number): Promise<void> {
    await db.setUserVoiceSetting(guildId, userId, 'pitchScale', pitchScale);
  }

  /**
   * 速度を取得
   */
  async getSpeedScale(guildId: string, userId: string): Promise<number> {
    const settings = await this.getUserVoiceSettings(guildId, userId);
    return settings.speedScale;
  }

  /**
   * 速度を設定
   */
  async setSpeedScale(guildId: string, userId: string, speedScale: number): Promise<void> {
    await db.setUserVoiceSetting(guildId, userId, 'speedScale', speedScale);
  }

  // ========== サーバー設定 ==========

  /**
   * サーバーの設定を取得
   */
  async getServerSettings(guildId: string): Promise<{ autoConnect: boolean }> {
    const autoConnect = await db.getGuildAutoConnect(guildId);
    return { autoConnect };
  }

  /**
   * 自動接続設定を取得
   */
  async getAutoConnect(guildId: string): Promise<boolean> {
    return await db.getGuildAutoConnect(guildId);
  }

  /**
   * 自動接続設定を変更
   */
  async setAutoConnect(guildId: string, autoConnect: boolean): Promise<void> {
    await db.setGuildAutoConnect(guildId, autoConnect);
  }

  // ========== チャンネル設定 ==========

  /**
   * チャンネルのミュート状態を取得
   */
  async getChannelMute(guildId: string, channelId: string): Promise<boolean> {
    return await db.isChannelMuted(guildId, channelId);
  }

  /**
   * チャンネルのミュート設定を変更
   */
  async setChannelMute(guildId: string, channelId: string, muted: boolean): Promise<void> {
    await db.setChannelMute(guildId, channelId, muted);
  }

  /**
   * チャンネルのミュート状態を切り替え
   */
  async toggleChannelMute(guildId: string, channelId: string): Promise<boolean> {
    const currentState = await this.getChannelMute(guildId, channelId);
    const newState = !currentState;
    await this.setChannelMute(guildId, channelId, newState);
    return newState;
  }
}

// シングルトンインスタンス
export const settingsService = new SettingsService();

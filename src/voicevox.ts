import { config } from "./config.js";
import { db } from "./db.js";
import { ErrorHandler } from "./error-handler.js";
import { TextFilter } from "./utils/text-filter.js";
import { AudioQueryData, VoiceVoxVersion, Speaker } from "./types.js";

export class VoiceVoxService {
  private baseURL: string;

  constructor() {
    this.baseURL = config.voicevox.apiUrl;
  }

  async textToSpeech(text: string, guildId: string, userId: string): Promise<Buffer | null> {
    try {
      const settings = await db.getUserVoiceSettings(guildId, userId);
      const formattedText = this.formatText(text);
      
      const queryData = await this.createAudioQuery(formattedText, settings.speakerId);
      queryData.pitchScale = settings.pitchScale;
      queryData.speedScale = settings.speedScale;

      const audioBuffer = await this.synthesizeAudio(queryData, settings.speakerId);
      return audioBuffer;
    } catch (error) {
      ErrorHandler.logError("VoiceVox TTS", error as Error);
      return null;
    }
  }

  private async createAudioQuery(text: string, speakerId: string): Promise<AudioQueryData> {
    const response = await fetch(
      `${this.baseURL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Audio query failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async synthesizeAudio(queryData: AudioQueryData, speakerId: string): Promise<Buffer> {
    const response = await fetch(
      `${this.baseURL}/synthesis?speaker=${speakerId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "audio/wav",
        },
        body: JSON.stringify(queryData),
      }
    );

    if (!response.ok) {
      throw new Error(`Audio synthesis failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async checkVoiceVox(): Promise<VoiceVoxVersion | null> {
    try {
      const response = await fetch(`${this.baseURL}/version`);
      
      if (!response.ok) {
        throw new Error(`Version check failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      ErrorHandler.logError("VoiceVox Version Check", error as Error);
      return null;
    }
  }

  formatText(text: string): string {
    return TextFilter.filterForSpeech(text);
  }

  async getSpeakers(): Promise<Speaker[]> {
    try {
      const response = await fetch(`${this.baseURL}/speakers`);
      
      if (!response.ok) {
        throw new Error(`Speakers fetch failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      ErrorHandler.logError("VoiceVox Get Speakers", error as Error);
      return [];
    }
  }
}

// シングルトンインスタンス
export const voiceVoxService = new VoiceVoxService();

// 後方互換性のための関数エクスポート
export const textToSpeech = voiceVoxService.textToSpeech.bind(voiceVoxService);
export const checkVoiceVox = voiceVoxService.checkVoiceVox.bind(voiceVoxService);
export const formatText = voiceVoxService.formatText.bind(voiceVoxService);
export const getSpeakers = voiceVoxService.getSpeakers.bind(voiceVoxService);

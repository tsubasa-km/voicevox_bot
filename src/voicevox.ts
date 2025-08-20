import emojiRegex from "emoji-regex";
import { db } from "./db.js";

const baseURL: string = process.env.VOICEVOX_API_URL || "http://127.0.0.1:50021";

interface AudioQueryData {
  pitchScale: number;
  speedScale: number;
  [key: string]: any;
}

interface VoiceVoxVersion {
  version: string;
}

interface Speaker {
  name: string;
  speaker_uuid: string;
  styles: Array<{
    name: string;
    id: number;
    type: string;
  }>;
  version: string;
}

export async function textToSpeech(text: string, guildId: string, userId: string): Promise<Buffer | null> {
  const speakerId: string = (await db.get(`${guildId}-speaker-${userId}`)) ?? "3";

  try {
    const queryResponse = await fetch(
      `${baseURL}/audio_query?text=${formatText(text)}&speaker=${speakerId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      }
    );
    const queryData: AudioQueryData = await queryResponse.json();

    const pitchScale: number = (await db.get(`${guildId}-pitch-${userId}`)) ?? 0.0;
    const speedScale: number = (await db.get(`${guildId}-speed-${userId}`)) ?? 1.0;

    queryData.pitchScale = pitchScale;
    queryData.speedScale = speedScale;

    const synthesisResponse = await fetch(
      `${baseURL}/synthesis?speaker=${speakerId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "audio/wav",
          responseType: "stream",
        },
        body: JSON.stringify(queryData),
      }
    );

    const arrayBuffer = await synthesisResponse.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    return null;
  }
}

export async function checkVoiceVox(): Promise<VoiceVoxVersion | null> {
  try {
    const response = await fetch(`${baseURL}/version`);
    const data: VoiceVoxVersion = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

export function formatText(text: string): string {
  const emoji = emojiRegex();
  const customEmoji = /<a?:\w+:\d+>/g;
  const url = /https?:\/\/\S+/g;

  text = text.replaceAll(emoji, "絵文字");
  text = text.replaceAll(customEmoji, "絵文字");
  text = text.replaceAll(url, "URL");

  return text;
}

export async function getSpeakers(): Promise<Speaker[]> {
  const response = await fetch(`${baseURL}/speakers`);
  return await response.json();
}

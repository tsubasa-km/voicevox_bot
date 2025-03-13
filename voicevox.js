import emojiRegex from "emoji-regex";
import { db } from "./db.js";

const baseURL = "http://127.0.0.1:50021";

export async function textToSpeech(text, guildId, userId) {
  const speakerId = (await db.get(`${guildId}-speaker-${userId}`)) ?? "3";

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
    const queryData = await queryResponse.json();

    const pitchScale = (await db.get(`${guildId}-pitch-${userId}`)) ?? 0.0;
    const speedScale = (await db.get(`${guildId}-speed-${userId}`)) ?? 1.0;

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
  }
}

export async function checkVoiceVox() {
  try {
    const response = await fetch(`${baseURL}/version`);
    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * @param {string} text
 */
export function formatText(text) {
  const emoji = emojiRegex();
  const customEmoji = /<a?:\w+:\d+>/g;
  const url = /https?:\/\/\S+/g;

  text = text.replaceAll(emoji, "絵文字");
  text = text.replaceAll(customEmoji, "絵文字");
  text = text.replaceAll(url, "URL");

  return text;
}

export async function getSpeakers() {
  const response = await fetch(`${baseURL}/speakers`);
  return await response.json();
}
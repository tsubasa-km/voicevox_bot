import { db } from "./db.js";

const baseURL = "http://127.0.0.1:50021";

export async function textToSpeech(text, guildId, userId) {
  const speakerId = (await db.get(`${guildId}-speaker-${userId}`)) ?? "3";
  const core_version = JSON.stringify({
    pitchScale: (await db.get(`${guildId}-pitch-${userId}`)) ?? 1.0,
    speedScale: (await db.get(`${guildId}-speed-${userId}`)) ?? 1.0
  })
  console.log(core_version);
  try {
    const queryResponse = await fetch(
      `${baseURL}/audio_query?text=${text}&speaker=${speakerId}&speed=${core_version.speedScale}&pitch=${core_version.pitchScale}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      }
    );
    const queryData = await queryResponse.json();

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

export async function getSpeakers() {
  const response = await fetch(`${baseURL}/speakers`);
  return await response.json();
}
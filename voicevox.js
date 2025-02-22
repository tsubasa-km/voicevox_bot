const baseURL = "http://127.0.0.1:50021";

async function textToSpeech(text, speaker = 3) {
  try {
    const queryResponse = await fetch(
      `${baseURL}/audio_query?text=${text}&speaker=${speaker}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const queryData = await queryResponse.json();

    const synthesisResponse = await fetch(
      `${baseURL}/synthesis?speaker=${speaker}`,
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

async function checkVoiceVox() {
  try {
    const response = await fetch(`${baseURL}/version`);
    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

function getSpeakers() {
  return fetch(`${baseURL}/speakers`)
    .then((response) => response.json())
    .then((data) => data.speakers);
}

export { textToSpeech, checkVoiceVox, getSpeakers };

async function textToSpeech(text, speaker = 3) {
  const baseURL = "http://127.0.0.1:50021";
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

module.exports = { textToSpeech };

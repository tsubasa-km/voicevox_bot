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

const speakers = [
  { name: "四国めたん ノーマル", value: "2" },
  { name: "四国めたん あまあま", value: "0" },
  { name: "四国めたん ツンツン", value: "6" },
  { name: "四国めたん セクシー", value: "4" },
  { name: "四国めたん ささやき", value: "36" },
  { name: "四国めたん ヒソヒソ", value: "37" },
  { name: "ずんだもん ノーマル", value: "3" },
  { name: "ずんだもん あまあま", value: "1" },
  { name: "ずんだもん ツンツン", value: "7" },
  { name: "ずんだもん セクシー", value: "5" },
  { name: "ずんだもん ささやき", value: "22" },
  { name: "ずんだもん ヒソヒソ", value: "38" },
  { name: "ずんだもん ヘロヘロ", value: "75" },
  { name: "ずんだもん なみだめ", value: "76" },
  { name: "春日部つむぎ ノーマル", value: "8" },
  { name: "雨晴はう ノーマル", value: "10" },
  { name: "波音リツ ノーマル", value: "9" },
  { name: "玄野武宏 ノーマル", value: "11" },
  { name: "玄野武宏 喜び", value: "39" },
  { name: "玄野武宏 ツンギレ", value: "40" },
  { name: "玄野武宏 悲しみ", value: "41" },
  { name: "白上虎太郎 ふつう", value: "12" },
  { name: "白上虎太郎 わーい", value: "32" },
  { name: "白上虎太郎 びくびく", value: "33" },
  { name: "白上虎太郎 おこ", value: "34" },
  { name: "白上虎太郎 びえーん", value: "35" },
  { name: "青山龍星 ノーマル", value: "13" },
  { name: "冥鳴ひまり ノーマル", value: "14" },
  { name: "九州そら ノーマル", value: "16" },
  { name: "九州そら あまあま", value: "15" },
  { name: "九州そら ツンツン", value: "18" },
  { name: "九州そら セクシー", value: "17" },
  { name: "九州そら ささやき", value: "19" },
  { name: "もち子さん ノーマル", value: "20" },
  { name: "剣崎雌雄 ノーマル", value: "21" },
  { name: "WhiteCUL ノーマル", value: "23" },
  { name: "WhiteCUL たのしい", value: "24" },
  { name: "WhiteCUL かなしい", value: "25" },
  { name: "WhiteCUL びえーん", value: "26" },
  { name: "後鬼 人間ver.", value: "27" },
  { name: "後鬼 ぬいぐるみver.", value: "28" },
  { name: "No.7 ノーマル", value: "29" },
  { name: "No.7 アナウンス", value: "30" },
  { name: "No.7 読み聞かせ", value: "31" },
  { name: "ちび式じい ノーマル", value: "42" },
  { name: "櫻歌ミコ ノーマル", value: "43" },
  { name: "櫻歌ミコ 第二形態", value: "44" },
  { name: "櫻歌ミコ ロリ", value: "45" },
  { name: "小夜/SAYO ノーマル", value: "46" },
  { name: "ナースロボ＿タイプＴ ノーマル", value: "47" },
  { name: "ナースロボ＿タイプＴ 楽々", value: "48" },
  { name: "ナースロボ＿タイプＴ 恐怖", value: "49" },
  { name: "ナースロボ＿タイプＴ 内緒話", value: "50" },
];

module.exports = { textToSpeech, checkVoiceVox, speakers };

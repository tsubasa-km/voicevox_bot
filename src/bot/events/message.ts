import { Message } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { db } from "../../services/database.js";
import { voiceService } from "../../services/voice.js";
import { TextFilter } from "../../utils/text-filter.js";

export async function handleMessage(message: Message): Promise<void> {
  // ボットのメッセージまたはDMは無視
  if (message.author.bot || !message.guild) {
    return;
  }

  // ボイス接続がない場合は無視
  const connection = getVoiceConnection(message.guild.id);
  if (!connection) {
    return;
  }

  // チャンネルがミュートされている場合は無視
  const isMuted = await db.isChannelMuted(message.guild.id, message.channel.id);
  if (isMuted) {
    return;
  }

  // メッセージが読み上げに値するかチェック
  if (!TextFilter.isWorthReading(message.content)) {
    return;
  }

  // テキストを音声に変換して再生
  await voiceService.playTextToSpeech(
    message.content,
    message.guild.id,
    message.author.id
  );
}

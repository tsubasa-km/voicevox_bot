import { VoiceState } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { voiceService } from "@/services/voice.js";

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  // ボットまたは同じチャンネル内での移動は無視
  if (newState.member?.user.bot || oldState.channelId === newState.channelId) {
    return;
  }

  // チャンネルから誰かが退出した場合、ボットが一人になったら退出
  if (oldState.channel && oldState.channel.members.size === 1) {
    const connection = getVoiceConnection(oldState.guild.id);
    if (connection) {
      connection.destroy();
    }
  }

  // チャンネルに誰かが入室し、自動接続が有効な場合は接続
  if (newState.channel && (!oldState.channel || oldState.channel.members.size === 1)) {
    await voiceService.handleAutoConnect(newState.guild, newState.channelId!);
  }
}

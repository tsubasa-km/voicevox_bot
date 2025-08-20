import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { settingsService } from "@/services/settings.js";

export default {
  data: new SlashCommandBuilder()
    .setName("channel-mute")
    .setDescription(
      "このチャンネルの読み上げをミュート/ミュート解除します。"
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.channel as TextChannel;
    if (!channel || !channel.guild) {
      await interaction.reply("このコマンドはサーバー内のテキストチャンネルでのみ使用できます。");
      return;
    }
    
    const guildId = channel.guild.id;
    const channelId = channel.id;
    
    const newMuteState = await settingsService.toggleChannelMute(guildId, channelId);
    
    if (newMuteState) {
      await interaction.reply(`🔇 このチャンネル（${channel.name}）の読み上げをミュートしました。`);
    } else {
      await interaction.reply(`🔊 このチャンネル（${channel.name}）の読み上げミュートを解除しました。`);
    }
  },
};

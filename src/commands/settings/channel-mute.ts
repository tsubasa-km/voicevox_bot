import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { settingsService } from "@/services/settings.js";

export default {
  data: new SlashCommandBuilder()
    .setName("channel-mute")
    .setDescription(
      "このコマンドを実行したテキストチャンネルの読み上げを停止・再開します。"
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
      await interaction.reply("読み上げを停止します。");
    } else {
      await interaction.reply("読み上げを再開します。");
    }
  },
};

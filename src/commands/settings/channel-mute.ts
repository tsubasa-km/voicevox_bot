import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { db } from "@/services/database.js";

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
    
    const isCurrentlyMuted = await db.isChannelMuted(guildId, channelId);
    
    if (isCurrentlyMuted) {
      await db.setChannelMute(guildId, channelId, false);
      await interaction.reply("読み上げを再開します。");
    } else {
      await db.setChannelMute(guildId, channelId, true);
      await interaction.reply("読み上げを停止します。");
    }
  },
};

import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, VoiceChannel, ChannelType } from "discord.js";
import { voiceService } from "../../services/voice.js";

export default {
  data: new SlashCommandBuilder()
    .setName("vc")
    .setDescription("読み上げを開始・終了します。"),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const channel = member?.voice.channel;
    
    if (!channel) {
      await interaction.reply("ボイスチャンネルにいません。");
      return;
    }

    if (channel.type !== ChannelType.GuildVoice) {
      await interaction.reply("このチャンネルでは読み上げを開始できません。");
      return;
    }

    const connection = voiceService.getVoiceConnection(channel.guild.id);
    
    if (connection) {
      voiceService.leaveVoiceChannel(channel.guild);
      await interaction.reply("読み上げを終了します。");
      return;
    }

    try {
      voiceService.joinVoiceChannel(channel as VoiceChannel);
      await interaction.reply("読み上げを開始します。");
    } catch (error) {
      console.error("Failed to join voice channel:", error);
      await interaction.reply("ボイスチャンネルへの接続に失敗しました。");
    }
  },
};

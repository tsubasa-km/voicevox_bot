import { getVoiceConnection } from "@discordjs/voice";
import { joinVoiceChannel } from "@discordjs/voice";
import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";

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
    let connection = getVoiceConnection(channel.guild.id);
    if (connection) {
      connection.destroy();
      await interaction.reply("読み上げを終了します。");
      return;
    }
    await interaction.reply("読み上げを開始します。");
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });
  },
};

import { getVoiceConnection } from "@discordjs/voice";
import { joinVoiceChannel } from "@discordjs/voice";
import { SlashCommandBuilder, CommandInteraction } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("vc")
    .setDescription("読み上げを開始・終了します。"),
  /**
   * @param {CommandInteraction} interaction
   */
  async execute(interaction) {
    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply("ボイスチャンネルにいません。");
    }
    let connection = getVoiceConnection(channel.guild.id);
    if (connection) {
      connection.destroy();
      return interaction.reply("読み上げを終了します。");
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

import { SlashCommandBuilder } from "discord.js";
import { db } from "../../src/db.js";

export default {
  data: new SlashCommandBuilder()
    .setName("channel-mute")
    .setDescription(
      "このコマンドを実行したテキストチャンネルの読み上げを停止・再開します。"
    ),
  async execute(interaction) {
    const channel = interaction.channel;
    const guildId = channel.guild.id;
    const channelId = channel.id;
    const channelMute = await db.get(`${guildId}-channel-mute-${channelId}`);
    if (channelMute === "on") {
      await db.set(`${guildId}-channel-mute-${channelId}`, "off");
      await interaction.reply("読み上げを再開します。");
    } else {
      await db.set(`${guildId}-channel-mute-${channelId}`, "on");
      await interaction.reply("読み上げを停止します。");
    }
  },
};

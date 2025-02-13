const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel-mute")
    .setDescription(
      "このコマンドを実行したテキストチャンネルの読み上げを停止・再開します。"
    ),
  async execute(interaction) {
    const db = require("../../db");
    const channel = interaction.channel;
    const guildId = channel.guild.id;
    const channelId = channel.id;
    const channelMute = await db.get(`${guildId}-${channelId}-channel-mute`);
    if (channelMute === "on") {
      await db.set(`${guildId}-${channelId}-channel-mute`, "off");
      await interaction.reply("読み上げを再開します。");
    } else {
      await db.set(`${guildId}-${channelId}-channel-mute`, "on");
      await interaction.reply("読み上げを停止します。");
    }
  },
};

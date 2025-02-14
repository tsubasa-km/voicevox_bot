const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("コマンドのヘルプを表示します"),
  async execute(interaction) {
    const commands = interaction.client.commands;
    const helpEmbed = new EmbedBuilder()
      .setTitle("コマンド一覧")
      .setDescription("利用可能なコマンドのリストです")
      .setColor(0x00ff00);

    commands.forEach((command) => {
      let argDesc = "";
      if (command.data.options) {
        command.data.options.forEach((option) => {
          argDesc += `\n• ${option.name}: ${option.description || "説明なし"}`;
        });
      }
      helpEmbed.addFields({
        name: `/${command.data.name}`,
        value:
          (command.data.description || "説明なし") +
          (argDesc ? `\nargs:${argDesc}` : ""),
      });
    });

    await interaction.reply({ embeds: [helpEmbed] });
  },
};

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
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
      helpEmbed.addFields({
        name: `/${command.data.name}`,
        value: command.data.description || "説明なし",
      });
    });

    await interaction.reply({ embeds: [helpEmbed] });
  },
};

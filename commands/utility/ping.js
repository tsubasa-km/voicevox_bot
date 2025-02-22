import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("BOTが生きているか確認します"),
  async execute(interaction) {
    await interaction.reply("Pong!");
  },
};

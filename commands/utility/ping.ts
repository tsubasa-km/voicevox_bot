import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("BOTが生きているか確認します"),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply("Pong!");
  },
};

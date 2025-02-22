const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");

const { getSpeakers } = require("../../voicevox");

const normalSpeakers = getSpeakers()
  .filter((s) => s.name.includes("ノーマル"))
  .map((s) => ({ name: s.name.replace(" ノーマル", ""), value: s.value }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setspeaker")
    .setDescription("ボイスの話者を設定します")
    .addStringOption((option) =>
      option
        .setName("speaker")
        .setDescription("話者の名前")
        .setRequired(true)
        .addChoices(...normalSpeakers)
    ),
  async execute(interaction) {
    const speaker = interaction.options.getString("speaker");
    const speakerName = normalSpeakers.find((s) => s.value === speaker).name;

    await db.set(
      `${interaction.guildId}-speaker-${interaction.member.user.id}`,
      speaker
    );

    const userMention = interaction.member.toString();

    await interaction.reply(
      `${userMention}の話者を${speakerName}に設定しました`
    );
  },
};

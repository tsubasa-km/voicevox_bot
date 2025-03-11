import { SlashCommandBuilder } from "discord.js";
import { db } from "../../db.js";

import { getSpeakers } from "../../voicevox.js";

const speakers = (await getSpeakers())
  .map(s => ({ name: s.name, value: `${s.styles[0].id}` }))
  .slice(0, 25);

console.log(speakers);

export default {
  data: new SlashCommandBuilder()
    .setName("setspeaker")
    .setDescription("ボイスの話者を設定します")
    .addStringOption((option) =>
      option
        .setName("speaker")
        .setDescription("話者の名前")
        .setRequired(true)
        .addChoices(...speakers)
    ),
  async execute(interaction) {
    const speakerId = interaction.options.getString("speaker");
    const speakerName = speakers.find((s) => s.value === speakerId).name;

    await db.set(
      `${interaction.guildId}-speaker-${interaction.member.user.id}`,
      speakerId
    );

    const userMention = interaction.member.toString();

    await interaction.reply(
      `${userMention}の話者を${speakerName}に設定しました`
    );
  },
};

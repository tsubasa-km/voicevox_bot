import { SlashCommandBuilder } from "discord.js";
import { db } from "../../db.js";

import { getSpeakers } from "../../voicevox.js";

const speakers = await getSpeakers();

// console.log(speakers);

const normalSpeakers = speakers
  .filter((s) => s.name.includes("ノーマル"))
  .map((s) => ({ name: s.name.replace(" ノーマル", ""), value: s.value }));

export default {
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
    const speakerName = speakers.find((s) => s.value === speaker).name;

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

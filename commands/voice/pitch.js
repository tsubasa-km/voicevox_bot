import { SlashCommandBuilder } from "discord.js";
import { db } from "../../db.js";

export default {
    data: new SlashCommandBuilder()
        .setName("setpitch")
        .setDescription("ボイスのピッチを設定します")
        .addNumberOption((option) =>
            option
                .setName("pitch")
                .setDescription("ピッチの値")
                .setRequired(true)
        ),
    async execute(interaction) {
        const pitch = interaction.options.getNumber("pitch");

        await db.set(
            `${interaction.guildId}-pitch-${interaction.member.user.id}`,
            pitch
        );

        const userMention = interaction.member.toString();

        await interaction.reply({
            content: `${userMention}のピッチを${pitch}に設定しました`
        });
    },
};

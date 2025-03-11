import { SlashCommandBuilder } from "discord.js";
import { db } from "../../db.js";

export default {
    data: new SlashCommandBuilder()
        .setName("setspeed")
        .setDescription("ボイスの速さを設定します")
        .addNumberOption((option) =>
            option
                .setName("speed")
                .setDescription("速さの値")
                .setRequired(true)
        ),
    async execute(interaction) {
        const speed = interaction.options.getNumber("speed");

        await db.set(
            `${interaction.guildId}-speed-${interaction.member.user.id}`,
            speed
        );

        const userMention = interaction.member.toString();

        await interaction.reply({
            content: `${userMention}の速さを${speed}に設定しました`,
        });
    },
};

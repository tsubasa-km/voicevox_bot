import { SlashCommandBuilder } from 'discord.js';
import type { Command, CommandDependencies } from '@/commands/types.js';

export const listSpeakersCommandData = new SlashCommandBuilder()
  .setName('list')
  .setDescription('各種情報の表示')
  .addSubcommand((sub) =>
    sub
      .setName('speakers')
      .setDescription('利用可能な話者一覧を表示します')
  );

export function buildListSpeakersCommand(deps: CommandDependencies): Command {
  return {
    data: listSpeakersCommandData,
    async execute(interaction) {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
        return;
      }

      if (interaction.options.getSubcommand() !== 'speakers') {
        await interaction.reply({ content: 'このコマンドは /list speakers で使用してください。', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const styles = await deps.voiceVoxService.listSpeakerStyles();
      if (styles.length === 0) {
        await interaction.editReply('利用可能な話者が見つかりませんでした。');
        return;
      }

      const lines = styles.map((style) => `${style.styleId}: ${style.speakerName} (${style.styleName})`);

      const chunks: string[] = [];
      let current = '';
      for (const line of lines) {
        if ((current + line + '\n').length > 1900) {
          chunks.push(current);
          current = '';
        }
        current += `${line}\n`;
      }
      if (current) {
        chunks.push(current);
      }

      if (chunks.length === 1) {
        await interaction.editReply({ content: chunks[0] });
      } else {
        await interaction.editReply({ content: chunks[0] });
        for (let i = 1; i < chunks.length; i += 1) {
          await interaction.followUp({ content: chunks[i], ephemeral: true });
        }
      }
    }
  };
}

import { SlashCommandBuilder } from 'discord.js';
import type { Command, CommandDependencies } from '@/commands/types.js';
import type { LlmProvider } from '@/llm/types.js';

function splitIntoChunks(lines: string[]): string[] {
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

  return chunks;
}

async function replyChunked(interaction: Parameters<Command['execute']>[0], lines: string[]): Promise<void> {
  const chunks = splitIntoChunks(lines);
  if (chunks.length === 0) {
    await interaction.editReply({ content: '表示する内容がありません。' });
    return;
  }

  await interaction.editReply({ content: chunks[0] });
  for (let i = 1; i < chunks.length; i += 1) {
    await interaction.followUp({ content: chunks[i], ephemeral: true });
  }
}

export const listSpeakersCommandData = new SlashCommandBuilder()
  .setName('list')
  .setDescription('各種情報の表示')
  .addSubcommand((sub) =>
    sub
      .setName('speakers')
      .setDescription('利用可能な話者一覧を表示します')
  )
  .addSubcommand((sub) =>
    sub
      .setName('keys')
      .setDescription('利用可能なLLM APIキー一覧を表示します')
  );

export function buildListSpeakersCommand(deps: CommandDependencies): Command {
  return {
    data: listSpeakersCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      if (subcommand !== 'speakers' && subcommand !== 'keys') {
        await interaction.reply({ content: 'このコマンドのサブコマンドが不正です。', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      if (subcommand === 'speakers') {
        const styles = await deps.voiceVoxService.listSpeakerStyles();
        if (styles.length === 0) {
          await interaction.editReply('利用可能な話者が見つかりませんでした。');
          return;
        }

        const lines = styles.map((style) => `${style.styleId}: ${style.speakerName} (${style.styleName})`);
        await replyChunked(interaction, lines);
        return;
      }

      const keys = await deps.listAccessibleLlmApiKeys(interaction.guild.id, interaction.user.id);
      if (keys.length === 0) {
        await interaction.editReply('利用可能なLLM APIキーはありません。');
        return;
      }

      const grouped: Record<LlmProvider, string[]> = {
        gemini: [],
        openai: []
      };

      for (const key of keys) {
        grouped[key.provider].push(`- ${key.keyId} (${key.scope === 'global' ? 'global' : 'guild'})`);
      }

      const lines: string[] = [];
      if (grouped.gemini.length > 0) {
        lines.push('[Gemini]');
        lines.push(...grouped.gemini);
        lines.push('');
      }
      if (grouped.openai.length > 0) {
        lines.push('[OpenAI]');
        lines.push(...grouped.openai);
      }

      await replyChunked(interaction, lines);
    }
  };
}

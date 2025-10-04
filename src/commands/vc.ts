import { SlashCommandBuilder } from 'discord.js';
import type { Command, CommandDependencies } from '@/commands/types.js';
import { logger } from '@/utils/logger.js';

export const vcCommandData = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('読み上げBOTの入室・退室を切り替えます');

export function buildVcCommand(deps: CommandDependencies): Command {
  return {
    data: vcCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const member = guild.members.cache.get(interaction.user.id) ?? (await guild.members.fetch(interaction.user.id));
      const voiceChannel = member.voice.channel;

      if (!voiceChannel) {
        await interaction.editReply('ボイスチャンネルに参加してからコマンドを実行してください。');
        return;
      }

      if (deps.voiceManager.isConnected(guild.id)) {
        deps.voiceManager.leave(guild.id);
        await interaction.editReply('読み上げBOTを退室させました。');
        return;
      }

      try {
        await deps.voiceManager.join(voiceChannel, interaction.channelId);
        await deps.setGuildPreferredTextChannel(guild.id, interaction.channelId);
        await interaction.editReply('読み上げBOTを入室させました。');
      } catch (error) {
        logger.error('Failed to join voice channel', error);
        await interaction.editReply('ボイスチャンネルへの参加に失敗しました。');
      }
    }
  };
}

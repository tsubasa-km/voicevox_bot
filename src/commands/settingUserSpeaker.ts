import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command, CommandDependencies } from '@/commands/types.js';

export const settingUserSpeakerCommandData = new SlashCommandBuilder()
  .setName('setting')
  .setDescription('読み上げBOTの設定を行います')
  .addSubcommandGroup((group) =>
    group
      .setName('user')
      .setDescription('ユーザー向け設定')
      .addSubcommand((sub) =>
        sub
          .setName('speaker')
          .setDescription('使用する話者を設定します')
          .addIntegerOption((option) =>
            option.setName('id').setDescription('話者ID (styles id)').setRequired(true)
          )
          .addUserOption((option) =>
            option.setName('target').setDescription('設定を変更するユーザー')
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('pitch')
          .setDescription('読み上げ時のピッチを設定します')
          .addNumberOption((option) =>
            option.setName('value').setDescription('ピッチ (float)').setRequired(true)
          )
          .addUserOption((option) =>
            option.setName('target').setDescription('設定を変更するユーザー')
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('speed')
          .setDescription('読み上げ時のスピードを設定します')
          .addNumberOption((option) =>
            option.setName('value').setDescription('スピード (float)').setRequired(true)
          )
          .addUserOption((option) =>
            option.setName('target').setDescription('設定を変更するユーザー')
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName('server')
      .setDescription('サーバー全体の設定')
      .addSubcommand((sub) =>
        sub
          .setName('autojoin')
          .setDescription('メンバーがボイスチャンネルに参加したら自動で読み上げBOTが入室するか設定します')
          .addBooleanOption((option) =>
            option.setName('enabled').setDescription('true で自動入室を有効化').setRequired(true)
          )
      )
  );

export function buildSettingUserSpeakerCommand(deps: CommandDependencies): Command {
  return {
    data: settingUserSpeakerCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
        return;
      }

      const group = interaction.options.getSubcommandGroup(true);
      const subcommand = interaction.options.getSubcommand(true);

      if (group === 'user') {
        const targetUser = interaction.options.getUser('target') ?? interaction.user;
        const targetLabel =
          targetUser.id === interaction.user.id ? 'あなた' : `${targetUser.toString()}`;

        if (subcommand === 'speaker') {
          const speakerId = interaction.options.getInteger('id', true);

          const styles = await deps.voiceVoxService.listSpeakerStyles();
          const selected = styles.find((style) => style.styleId === speakerId);

          if (!selected) {
            await interaction.reply({
              content: `指定された話者ID (${speakerId}) は存在しません。`,
              ephemeral: true
            });
            return;
          }

          await deps.setUserSpeakerId(interaction.guild.id, targetUser.id, speakerId);

          await interaction.reply({
            content: `${targetLabel}の話者を「${selected.speakerName} - ${selected.styleName}」に設定しました。`,
            ephemeral: true
          });
          return;
        }

        if (subcommand === 'pitch') {
          const value = interaction.options.getNumber('value', true);

          await deps.setUserPitch(interaction.guild.id, targetUser.id, value, deps.defaultSpeakerId);

          await interaction.reply({
            content: `${targetLabel}のピッチを ${value} に設定しました。`,
            ephemeral: true
          });
          return;
        }

        if (subcommand === 'speed') {
          const value = interaction.options.getNumber('value', true);

          await deps.setUserSpeed(interaction.guild.id, targetUser.id, value, deps.defaultSpeakerId);

          await interaction.reply({
            content: `${targetLabel}のスピードを ${value} に設定しました。`,
            ephemeral: true
          });
          return;
        }
      }

      if (group === 'server' && subcommand === 'autojoin') {
        const hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
        if (!hasPermission) {
          await interaction.reply({
            content: 'サーバー設定を変更する権限がありません。`サーバー管理` 権限が必要です。',
            ephemeral: true
          });
          return;
        }

        const enabled = interaction.options.getBoolean('enabled', true);
        await deps.setGuildAutoJoin(interaction.guild.id, enabled);
        await deps.setGuildPreferredTextChannel(interaction.guild.id, interaction.channelId);

        await interaction.reply({
          content: `自動入室設定を ${enabled ? '有効' : '無効'} にしました。`,
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        content: '対応していない設定です。',
        ephemeral: true
      });
    }
  };
}

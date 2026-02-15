import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command, CommandDependencies } from '@/commands/types.js';
import { canManageApiKey } from '@/db/llmApiKeys.js';
import { isLlmApiKeyScope, isLlmProvider } from '@/llm/types.js';
import type { LlmApiKeyScope, LlmProvider } from '@/llm/types.js';

const llmProviderChoices = [
  { name: 'Gemini', value: 'gemini' as const },
  { name: 'OpenAI', value: 'openai' as const }
];

const llmScopeChoices = [
  { name: 'guild', value: 'guild' as const },
  { name: 'global', value: 'global' as const }
];

function parseOptionalText(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function providerLabel(provider: LlmProvider): string {
  return provider === 'gemini' ? 'Gemini' : 'OpenAI';
}

function scopeLabel(scope: LlmApiKeyScope): string {
  return scope === 'global' ? 'global' : 'guild';
}

function collectAllowedUserIds(interaction: ChatInputCommandInteraction): string[] {
  const optionNames = ['user1', 'user2', 'user3', 'user4', 'user5'];
  const ids = optionNames
    .map((name) => interaction.options.getUser(name)?.id)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

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
      .addSubcommand((sub) =>
        sub
          .setName('llm_assist')
          .setDescription('読み上げ前のLLMアシスト設定を更新します')
          .addBooleanOption((option) =>
            option.setName('enabled').setDescription('LLMアシストを使うかどうか').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('provider')
              .setDescription('利用プロバイダー (未指定で自動選択)')
              .addChoices(...llmProviderChoices)
          )
          .addStringOption((option) =>
            option
              .setName('key_id')
              .setDescription('利用するAPIキーID (未指定でローテーション)')
          )
          .addStringOption((option) =>
            option
              .setName('model')
              .setDescription('モデルID (未指定でproviderの既定値)')
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
  )
  .addSubcommandGroup((group) =>
    group
      .setName('key')
      .setDescription('LLM APIキー設定')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('LLM APIキーを追加または更新します')
          .addStringOption((option) =>
            option
              .setName('provider')
              .setDescription('プロバイダー')
              .setRequired(true)
              .addChoices(...llmProviderChoices)
          )
          .addStringOption((option) =>
            option.setName('id').setDescription('APIキーID').setRequired(true)
          )
          .addStringOption((option) =>
            option.setName('api_key').setDescription('APIキーの値').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('scope')
              .setDescription('適用範囲')
              .setRequired(true)
              .addChoices(...llmScopeChoices)
          )
          .addUserOption((option) => option.setName('user1').setDescription('このキーの利用を許可するユーザー1'))
          .addUserOption((option) => option.setName('user2').setDescription('このキーの利用を許可するユーザー2'))
          .addUserOption((option) => option.setName('user3').setDescription('このキーの利用を許可するユーザー3'))
          .addUserOption((option) => option.setName('user4').setDescription('このキーの利用を許可するユーザー4'))
          .addUserOption((option) => option.setName('user5').setDescription('このキーの利用を許可するユーザー5'))
      )
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('LLM APIキーを削除します')
          .addStringOption((option) =>
            option
              .setName('provider')
              .setDescription('プロバイダー')
              .setRequired(true)
              .addChoices(...llmProviderChoices)
          )
          .addStringOption((option) =>
            option.setName('id').setDescription('APIキーID').setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('scope')
              .setDescription('適用範囲')
              .setRequired(true)
              .addChoices(...llmScopeChoices)
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

        if (subcommand === 'llm_assist') {
          const enabled = interaction.options.getBoolean('enabled', true);
          const providerRaw = interaction.options.getString('provider');
          const keyId = parseOptionalText(interaction.options.getString('key_id'));
          const model = parseOptionalText(interaction.options.getString('model'));

          if (providerRaw && !isLlmProvider(providerRaw)) {
            await interaction.reply({
              content: `指定された provider (${providerRaw}) は対応していません。`,
              ephemeral: true
            });
            return;
          }

          const provider: LlmProvider | null =
            providerRaw && isLlmProvider(providerRaw) ? providerRaw : null;

          if (keyId && !provider) {
            await interaction.reply({
              content: 'key_id を指定する場合は provider も指定してください。',
              ephemeral: true
            });
            return;
          }

          if (provider && keyId) {
            const accessible = await deps.findAccessibleLlmApiKey(
              interaction.guild.id,
              targetUser.id,
              provider,
              keyId
            );
            if (!accessible) {
              await interaction.reply({
                content: `${targetLabel} が利用可能な APIキー (${providerLabel(provider)} / ${keyId}) が見つかりません。`,
                ephemeral: true
              });
              return;
            }
          }

          await deps.setUserLlmAssistSettings(interaction.guild.id, targetUser.id, {
            enabled,
            provider,
            apiKeyId: keyId,
            model
          });

          const providerText = provider ? providerLabel(provider) : '自動選択';
          const keyText = keyId ?? 'ローテーション';
          const modelText = model ?? '既定モデル';

          await interaction.reply({
            content:
              `${targetLabel} のLLMアシスト設定を更新しました。` +
              `\n- enabled: ${enabled ? 'ON' : 'OFF'}` +
              `\n- provider: ${providerText}` +
              `\n- key_id: ${keyText}` +
              `\n- model: ${modelText}`,
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

      if (group === 'key') {
        const providerRaw = interaction.options.getString('provider', true);
        const scopeRaw = interaction.options.getString('scope', true);

        if (!isLlmProvider(providerRaw) || !isLlmApiKeyScope(scopeRaw)) {
          await interaction.reply({
            content: 'provider または scope が不正です。',
            ephemeral: true
          });
          return;
        }

        const provider = providerRaw;
        const scope = scopeRaw;
        const keyId = parseOptionalText(interaction.options.getString('id', true));

        if (!keyId) {
          await interaction.reply({
            content: 'id は空文字にできません。',
            ephemeral: true
          });
          return;
        }

        const actorHasManageGuild =
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

        if (subcommand === 'add') {
          const apiKey = parseOptionalText(interaction.options.getString('api_key', true));
          if (!apiKey) {
            await interaction.reply({
              content: 'api_key は空文字にできません。',
              ephemeral: true
            });
            return;
          }

          const existing = await deps.getLlmApiKey(scope, interaction.guild.id, provider, keyId);
          if (existing && !canManageApiKey(existing, interaction.user.id, actorHasManageGuild)) {
            await interaction.reply({
              content: '既存キーを更新する権限がありません。作成者またはサーバー管理権限が必要です。',
              ephemeral: true
            });
            return;
          }

          const allowedUserIds = collectAllowedUserIds(interaction);
          if (allowedUserIds.length === 0) {
            allowedUserIds.push(interaction.user.id);
          }

          const result = await deps.upsertLlmApiKey({
            scope,
            guildId: interaction.guild.id,
            provider,
            keyId,
            plainApiKey: apiKey,
            allowedUserIds,
            actorUserId: interaction.user.id
          });

          const allowedText = allowedUserIds.map((id) => `<@${id}>`).join(', ');
          await interaction.reply({
            content:
              `${result.created ? 'APIキーを追加しました。' : 'APIキーを更新しました。'}` +
              `\n- provider: ${providerLabel(provider)}` +
              `\n- id: ${keyId}` +
              `\n- scope: ${scopeLabel(scope)}` +
              `\n- allowed users: ${allowedText}`,
            ephemeral: true
          });
          return;
        }

        if (subcommand === 'delete') {
          const existing = await deps.getLlmApiKey(scope, interaction.guild.id, provider, keyId);
          if (!existing) {
            await interaction.reply({
              content: `削除対象の APIキー (${providerLabel(provider)} / ${keyId} / ${scopeLabel(scope)}) が見つかりません。`,
              ephemeral: true
            });
            return;
          }

          if (!canManageApiKey(existing, interaction.user.id, actorHasManageGuild)) {
            await interaction.reply({
              content: 'APIキーを削除する権限がありません。作成者またはサーバー管理権限が必要です。',
              ephemeral: true
            });
            return;
          }

          const deleted = await deps.deleteLlmApiKey(scope, interaction.guild.id, provider, keyId);
          if (!deleted) {
            await interaction.reply({
              content: 'APIキーの削除に失敗しました。',
              ephemeral: true
            });
            return;
          }

          await interaction.reply({
            content: `APIキーを削除しました。\n- provider: ${providerLabel(provider)}\n- id: ${keyId}\n- scope: ${scopeLabel(scope)}`,
            ephemeral: true
          });
          return;
        }
      }

      await interaction.reply({
        content: '対応していない設定です。',
        ephemeral: true
      });
    }
  };
}

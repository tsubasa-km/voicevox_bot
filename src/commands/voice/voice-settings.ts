import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { settingsService } from "@/services/settings.js";
import { voiceVoxService } from "@/services/voicevox.js";

export default {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("音声設定を変更します")
    .addSubcommand(subcommand =>
      subcommand
        .setName("speaker")
        .setDescription("話者を変更します")
        .addStringOption(option =>
          option
            .setName("id")
            .setDescription("話者ID")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("pitch")
        .setDescription("ピッチを変更します")
        .addNumberOption(option =>
          option
            .setName("scale")
            .setDescription("ピッチスケール (0.5 - 2.0)")
            .setMinValue(0.5)
            .setMaxValue(2.0)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("speed")
        .setDescription("速度を変更します")
        .addNumberOption(option =>
          option
            .setName("scale")
            .setDescription("速度スケール (0.5 - 2.0)")
            .setMinValue(0.5)
            .setMaxValue(2.0)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("show")
        .setDescription("現在の音声設定を表示します")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("speakers")
        .setDescription("利用可能な話者一覧を表示します")
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const guildId = interaction.guild!.id;
    const userId = member.id;
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "speaker": {
          const speakerId = interaction.options.getString("id", true);
          await settingsService.setSpeakerId(guildId, userId, speakerId);
          await interaction.reply(`話者ID を ${speakerId} に設定しました。`);
          break;
        }

        case "pitch": {
          const pitchScale = interaction.options.getNumber("scale", true);
          await settingsService.setPitchScale(guildId, userId, pitchScale);
          await interaction.reply(`ピッチ を ${pitchScale} に設定しました。`);
          break;
        }

        case "speed": {
          const speedScale = interaction.options.getNumber("scale", true);
          await settingsService.setSpeedScale(guildId, userId, speedScale);
          await interaction.reply(`速度 を ${speedScale} に設定しました。`);
          break;
        }

        case "show": {
          const settings = await settingsService.getUserVoiceSettings(guildId, userId);
          await interaction.reply({
            content: `**あなたの音声設定**\n` +
              `話者ID: ${settings.speakerId}\n` +
              `ピッチ: ${settings.pitchScale}\n` +
              `速度: ${settings.speedScale}`,
            ephemeral: true
          });
          break;
        }

        case "speakers": {
          const speakers = await voiceVoxService.getSpeakers();
          if (speakers.length === 0) {
            await interaction.reply("話者一覧を取得できませんでした。");
            return;
          }

          // 話者とスタイルを平坦化してリスト作成
          const speakerItems: Array<{ id: number; name: string; style: string }> = [];
          speakers.forEach(speaker => {
            speaker.styles.forEach(style => {
              speakerItems.push({
                id: style.id,
                name: speaker.name,
                style: style.name
              });
            });
          });

          const itemsPerPage = 10;
          const totalPages = Math.ceil(speakerItems.length / itemsPerPage);
          let currentPage = 0;

          const createEmbed = (page: number) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = speakerItems.slice(start, end);

            const embed = new EmbedBuilder()
              .setTitle("🎤 利用可能な話者一覧")
              .setDescription(
                pageItems
                  .map(item => `**ID: ${item.id}** - ${item.name} (${item.style})`)
                  .join('\n')
              )
              .setFooter({ text: `ページ ${page + 1} / ${totalPages} (全 ${speakerItems.length} 話者)` })
              .setColor(0x00ff88);

            return embed;
          };

          const createButtons = (page: number) => {
            const row = new ActionRowBuilder<ButtonBuilder>();
            
            row.addComponents(
              new ButtonBuilder()
                .setCustomId('speakers_first')
                .setLabel('最初')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
              new ButtonBuilder()
                .setCustomId('speakers_prev')
                .setLabel('前へ')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
              new ButtonBuilder()
                .setCustomId('speakers_next')
                .setLabel('次へ')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages - 1),
              new ButtonBuilder()
                .setCustomId('speakers_last')
                .setLabel('最後')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
            );

            return row;
          };

          const embed = createEmbed(currentPage);
          const buttons = createButtons(currentPage);

          const response = await interaction.reply({
            embeds: [embed],
            components: totalPages > 1 ? [buttons] : [],
            ephemeral: true
          });

          if (totalPages <= 1) break;

          // ボタンインタラクションの処理
          const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5分間
          });

          collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
              await buttonInteraction.reply({
                content: 'このボタンは使用できません。',
                ephemeral: true
              });
              return;
            }

            switch (buttonInteraction.customId) {
              case 'speakers_first':
                currentPage = 0;
                break;
              case 'speakers_prev':
                currentPage = Math.max(0, currentPage - 1);
                break;
              case 'speakers_next':
                currentPage = Math.min(totalPages - 1, currentPage + 1);
                break;
              case 'speakers_last':
                currentPage = totalPages - 1;
                break;
            }

            const newEmbed = createEmbed(currentPage);
            const newButtons = createButtons(currentPage);

            await buttonInteraction.update({
              embeds: [newEmbed],
              components: [newButtons]
            });
          });

          collector.on('end', async () => {
            try {
              // タイムアウト時にボタンを無効化
              const disabledButtons = new ActionRowBuilder<ButtonBuilder>();
              disabledButtons.addComponents(
                new ButtonBuilder()
                  .setCustomId('speakers_first')
                  .setLabel('最初')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('speakers_prev')
                  .setLabel('前へ')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('speakers_next')
                  .setLabel('次へ')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('speakers_last')
                  .setLabel('最後')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              );

              await interaction.editReply({
                components: [disabledButtons]
              });
            } catch (error) {
              // エラーが発生しても無視（メッセージが削除されている可能性）
            }
          });

          break;
        }

        default:
          await interaction.reply("不明なサブコマンドです。");
      }
    } catch (error) {
      console.error("Voice command error:", error);
      await interaction.reply("設定の変更中にエラーが発生しました。");
    }
  },
};

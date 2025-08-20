import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("コマンドのヘルプを表示します"),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const helpEmbed = new EmbedBuilder()
      .setTitle("🤖 VoiceVox Bot - コマンド一覧")
      .setDescription("VoiceVoxを使ったテキスト読み上げBotです")
      .setColor(0x5865f2)
      .addFields([
        {
          name: "🎵 音声コマンド",
          value: "`/vc` - ボイスチャンネルに参加/退出\n`/voice` - 音声設定（話者選択）",
          inline: false
        },
        {
          name: "⚙️ 設定コマンド", 
          value: "`/channel-mute` - このチャンネルの読み上げをミュート/解除\n`/server-setting` - サーバーの設定を変更",
          inline: false
        },
        {
          name: "🔧 ユーティリティ",
          value: "`/ping` - Botの応答速度をテスト\n`/help` - このヘルプメッセージを表示",
          inline: false
        },
        {
          name: "📖 使い方",
          value: "1. `/vc` でボイスチャンネルに参加\n2. `/voice` で好みの話者を選択\n3. テキストチャンネルにメッセージを送信すると読み上げ",
          inline: false
        },
        {
          name: "🔗 リンク",
          value: "[VoiceVox公式](https://voicevox.hiroshiba.jp/) | [GitHub](https://github.com/tsubasa-km/voicevox_bot)",
          inline: false
        }
      ])
      .setFooter({ 
        text: "VoiceVox Bot v1.0.0 | 何か問題があれば管理者にお知らせください" 
      })
      .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed] });
  },
};

import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { db } from "../../services/database.js";

interface SettingOption {
  name: string;
  value: string;
  default: string;
}

const options: SettingOption[] = [{ name: "自動接続", value: "autoconnect", default: "off" }];

export default {
  data: new SlashCommandBuilder()
    .setName("server-setting")
    .setDescription("サーバーの設定を変更します。")
    .addStringOption((option) =>
      option
        .setName("option")
        .setDescription("設定オプションを選択してください")
        .addChoices(options.map((o) => ({ name: o.name, value: o.value })))
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("value")
        .setDescription("設定値を入力してください")
        .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const option = interaction.options.getString("option");
    const value = interaction.options.getString("value");

    if (!interaction.guild) {
      await interaction.reply("このコマンドはサーバー内でのみ使用できます。");
      return;
    }

    if (!option || !value) {
      await interaction.reply("設定オプションと値を指定してください。");
      return;
    }

    const guildId = interaction.guild.id;

    // 設定に応じた専用メソッドを使用
    if (option === "autoconnect") {
      await db.setGuildAutoConnect(guildId, value === "on");
    } else {
      await db.set(`${guildId}-${option}`, value);
    }

    await interaction.reply(
      `設定オプション: ${option} 設定値: ${value} に変更しました。`
    );
  },
};

import { ChatInputCommandInteraction, MessageFlags } from "discord.js";

export class ErrorHandler {
  static async handleInteractionError(
    interaction: ChatInputCommandInteraction,
    error: Error
  ): Promise<void> {
    console.error(`Command error for ${interaction.commandName}:`, error);

    const errorMessage = "コマンドの実行中にエラーが発生しました。";

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      console.error("Failed to send error message:", replyError);
    }
  }

  static logError(context: string, error: Error): void {
    console.error(`[${context}] ${error.message}`, error);
  }
}

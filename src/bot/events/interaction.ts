import { BaseInteraction } from "discord.js";
import { ErrorHandler } from "@/utils/error-handler.js";
import { Logger } from "@/utils/logger.js";

export async function handleInteraction(interaction: BaseInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    Logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    await ErrorHandler.handleInteractionError(interaction, error as Error);
  }
}

import { Client } from "discord.js";
import { Logger } from "@/utils/logger.js";

export async function handleClientReady(readyClient: Client<true>): Promise<void> {
  Logger.info(`Logged in as ${readyClient.user.tag}!`);
  
  // 起動時に常にコマンドを自動更新
  Logger.info("Auto-updating slash commands...");
  try {
    const deployerModule = await import("../commands/deployer.js");
    const deployer = new deployerModule.CommandDeployer();
    await deployer.deployCommands();
  } catch (error) {
    Logger.warn("Failed to auto-update commands:", error);
  }
}

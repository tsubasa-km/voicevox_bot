import { Client } from "discord.js";
import { Logger } from "@/utils/logger.js";
import { config } from "@/utils/config.js";

export async function handleClientReady(readyClient: Client<true>): Promise<void> {
  Logger.info(`Logged in as ${readyClient.user.tag}!`);
  
  // 開発環境では起動時にコマンドを自動更新
  if (config.isDevelopment) {
    Logger.info("Development mode: Auto-updating slash commands...");
    try {
      const deployerModule = await import("../commands/deployer.js");
      const deployer = new deployerModule.CommandDeployer();
      await deployer.deployCommands();
    } catch (error) {
      Logger.warn("Failed to auto-update commands:", error);
    }
  }
}

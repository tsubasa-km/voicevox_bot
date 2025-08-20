import { REST, Routes } from "discord.js";
import { config } from "@/utils/config.js";
import { CommandLoader } from "./loader.js";
import { ErrorHandler } from "@/utils/error-handler.js";
import { Logger } from "@/utils/logger.js";

class CommandDeployer {
  private rest: REST;

  constructor() {
    this.rest = new REST().setToken(config.discord.token);
  }

  async deployCommands(): Promise<void> {
    try {
      const commands = await CommandLoader.getCommandsForDeployment();
      
      Logger.info(`Started refreshing ${commands.length} application (/) commands.`);

      // グローバルコマンドとして登録
      const data = await this.rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      ) as any[];

      Logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      ErrorHandler.logError("Command deployment", error as Error);
      throw error;
    }
  }
}

// コマンドデプロイの実行
const deployer = new CommandDeployer();
deployer.deployCommands().catch((error) => {
  ErrorHandler.logError("Command deployment startup", error);
  process.exit(1);
});

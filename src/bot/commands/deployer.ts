import { REST, Routes } from "discord.js";
import { config } from "@/utils/config.js";
import { CommandLoader } from "./loader.js";
import { ErrorHandler } from "@/utils/error-handler.js";
import { Logger } from "@/utils/logger.js";

export class CommandDeployer {
  private rest: REST;

  constructor() {
    this.rest = new REST().setToken(config.discord.token);
  }

  async deployCommands(): Promise<void> {
    try {
      const commands = await CommandLoader.getCommandsForDeployment();
      
      Logger.info(`Started refreshing ${commands.length} application (/) commands.`);

      // 現在のコマンドを取得して表示
      await this.displayCurrentCommands();

      // グローバルコマンドとして登録（これにより古いコマンドは自動的に削除される）
      const data = await this.rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      ) as any[];

      Logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
      
      // 新しいコマンドリストを表示
      Logger.info("New commands:");
      commands.forEach(cmd => Logger.info(`  - ${cmd.name}: ${cmd.description}`));
    } catch (error) {
      ErrorHandler.logError("Command deployment", error as Error);
      throw error;
    }
  }

  async displayCurrentCommands(): Promise<void> {
    try {
      const currentCommands = await this.rest.get(
        Routes.applicationCommands(config.discord.clientId)
      ) as any[];

      if (currentCommands.length > 0) {
        Logger.info("Current registered commands:");
        currentCommands.forEach(cmd => Logger.info(`  - ${cmd.name}: ${cmd.description}`));
      } else {
        Logger.info("No commands currently registered.");
      }
    } catch (error) {
      Logger.warn("Failed to fetch current commands:", error);
    }
  }

  async clearAllCommands(): Promise<void> {
    try {
      Logger.info("Clearing all application commands...");
      
      const data = await this.rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: [] }
      ) as any[];

      Logger.info(`Successfully cleared all application commands.`);
    } catch (error) {
      ErrorHandler.logError("Command clearing", error as Error);
      throw error;
    }
  }
}

// コマンドデプロイの実行
const deployer = new CommandDeployer();

// コマンドライン引数をチェック
const args = process.argv.slice(2);

if (args.includes('--clear')) {
  // すべてのコマンドをクリア
  deployer.clearAllCommands().catch((error) => {
    ErrorHandler.logError("Command clearing startup", error);
    process.exit(1);
  });
} else {
  // 通常のデプロイ
  deployer.deployCommands().catch((error) => {
    ErrorHandler.logError("Command deployment startup", error);
    process.exit(1);
  });
}

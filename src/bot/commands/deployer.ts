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

  async displayCurrentCommands(specificGuildId?: string): Promise<void> {
    try {
      const currentCommands = await this.rest.get(
        Routes.applicationCommands(config.discord.clientId)
      ) as any[];

      if (currentCommands.length > 0) {
        Logger.info("Current registered global commands:");
        currentCommands.forEach(cmd => Logger.info(`  - ${cmd.name}: ${cmd.description}`));
      } else {
        Logger.info("No global commands currently registered.");
      }

      // ギルドコマンドも表示
      const guildId = specificGuildId || process.env.DISCORD_GUILD_ID;
      if (guildId) {
        try {
          const guildCommands = await this.rest.get(
            Routes.applicationGuildCommands(config.discord.clientId, guildId)
          ) as any[];

          if (guildCommands.length > 0) {
            Logger.info(`Current registered guild commands (${guildId}):`);
            guildCommands.forEach(cmd => Logger.info(`  - ${cmd.name}: ${cmd.description}`));
          } else {
            Logger.info(`No guild commands currently registered for guild ${guildId}.`);
          }
        } catch (error) {
          Logger.warn(`Failed to fetch guild commands for guild ${guildId}:`, error);
        }
      }
    } catch (error) {
      Logger.warn("Failed to fetch current commands:", error);
    }
  }

  async clearAllCommands(): Promise<void> {
    try {
      Logger.info("Clearing all global application commands...");
      
      const data = await this.rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: [] }
      ) as any[];

      Logger.info(`Successfully cleared all global application commands.`);
    } catch (error) {
      ErrorHandler.logError("Command clearing", error as Error);
      throw error;
    }
  }

  async clearGuildCommands(guildId: string): Promise<void> {
    try {
      Logger.info(`Clearing all guild commands for guild ${guildId}...`);
      
      const data = await this.rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, guildId),
        { body: [] }
      ) as any[];

      Logger.info(`Successfully cleared all guild commands for guild ${guildId}.`);
    } catch (error) {
      ErrorHandler.logError("Guild command clearing", error as Error);
      throw error;
    }
  }

  async clearAllGuildCommands(): Promise<void> {
    try {
      // 環境変数からギルドIDを取得
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        await this.clearGuildCommands(guildId);
      } else {
        Logger.warn("DISCORD_GUILD_ID not set, skipping guild command clearing");
      }
    } catch (error) {
      ErrorHandler.logError("All guild command clearing", error as Error);
      throw error;
    }
  }
}

// コマンドデプロイの実行
const deployer = new CommandDeployer();

// コマンドライン引数をチェック
const args = process.argv.slice(2);

if (args.includes('--clear')) {
  // すべてのコマンドをクリア（グローバル + ギルド）
  Promise.all([
    deployer.clearAllCommands(),
    deployer.clearAllGuildCommands()
  ]).catch((error) => {
    ErrorHandler.logError("Command clearing startup", error);
    process.exit(1);
  });
} else if (args.includes('--clear-global')) {
  // グローバルコマンドのみクリア
  deployer.clearAllCommands().catch((error) => {
    ErrorHandler.logError("Global command clearing startup", error);
    process.exit(1);
  });
} else if (args.includes('--clear-guild')) {
  // ギルドコマンドのみクリア
  const guildIdIndex = args.indexOf('--clear-guild') + 1;
  const guildId = args[guildIdIndex];
  
  if (guildId && !guildId.startsWith('--')) {
    // 引数でギルドIDが指定された場合
    deployer.clearGuildCommands(guildId).catch((error) => {
      ErrorHandler.logError("Guild command clearing startup", error);
      process.exit(1);
    });
  } else {
    // 引数が指定されていない場合は環境変数から取得
    deployer.clearAllGuildCommands().catch((error) => {
      ErrorHandler.logError("Guild command clearing startup", error);
      process.exit(1);
    });
  }
} else if (args.includes('--status')) {
  // 現在のコマンド状況を表示
  const statusIndex = args.indexOf('--status') + 1;
  const guildId = args[statusIndex];
  
  if (guildId && !guildId.startsWith('--')) {
    // 引数でギルドIDが指定された場合
    deployer.displayCurrentCommands(guildId).catch((error) => {
      ErrorHandler.logError("Command status check startup", error);
      process.exit(1);
    });
  } else {
    // 引数が指定されていない場合は環境変数から取得
    deployer.displayCurrentCommands().catch((error) => {
      ErrorHandler.logError("Command status check startup", error);
      process.exit(1);
    });
  }
} else if (args.includes('--help') || args.includes('-h')) {
  // ヘルプメッセージを表示
  console.log(`
Discord Bot Command Deployer

Usage:
  tsx src/bot/commands/deployer.ts [options]

Options:
  --clear                    Clear all commands (global + guild)
  --clear-global            Clear only global commands
  --clear-guild [guildId]   Clear guild commands (uses env DISCORD_GUILD_ID if no guildId provided)
  --status [guildId]        Show current command status (uses env DISCORD_GUILD_ID if no guildId provided)
  --help, -h               Show this help message

Examples:
  npm run deploy:commands                    # Deploy commands
  npm run clear:commands                     # Clear all commands
  npm run clear:commands:guild 123456789    # Clear commands for specific guild
  npm run status:commands 123456789         # Check status for specific guild
  `);
} else {
  // 通常のデプロイ
  deployer.deployCommands().catch((error) => {
    ErrorHandler.logError("Command deployment startup", error);
    process.exit(1);
  });
}

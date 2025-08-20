import { REST, Routes } from "discord.js";
import { config } from "../../utils/config.js";
import { CommandLoader } from "./loader.js";
import { ErrorHandler } from "../../utils/error-handler.js";

class CommandDeployer {
  private rest: REST;

  constructor() {
    this.rest = new REST().setToken(config.discord.token);
  }

  async deployCommands(): Promise<void> {
    try {
      const commands = await CommandLoader.getCommandsForDeployment();
      
      console.log(`Started refreshing ${commands.length} application (/) commands.`);

      // グローバルコマンドとして登録
      const data = await this.rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      ) as any[];

      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      ErrorHandler.logError("Command deployment", error as Error);
      throw error;
    }
  }
}

// コマンドデプロイの実行
const deployer = new CommandDeployer();
deployer.deployCommands().catch(console.error);

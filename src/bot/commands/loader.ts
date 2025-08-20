import { Collection } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import { Command } from "../../types/discord.js";
import { ErrorHandler } from "../../utils/error-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CommandLoader {
  static async loadCommands(): Promise<Collection<string, Command>> {
    const commands = new Collection<string, Command>();
    const foldersPath = path.join(__dirname, "..", "..", "commands");

    try {
      const commandFolders = fs.readdirSync(foldersPath);

      for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs
          .readdirSync(commandsPath)
          .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

        for (const file of commandFiles) {
          const filePath = path.join(commandsPath, file);
          
          try {
            const commandModule = await import(filePath);
            const command: Command = commandModule.default || commandModule;

            if ("data" in command && "execute" in command) {
              commands.set(command.data.name, command);
            } else {
              console.warn(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
              );
            }
          } catch (error) {
            ErrorHandler.logError(`Loading command ${filePath}`, error as Error);
          }
        }
      }
    } catch (error) {
      ErrorHandler.logError("Loading commands", error as Error);
    }

    return commands;
  }

  static async getCommandsForDeployment(): Promise<any[]> {
    const commands: any[] = [];
    const foldersPath = path.join(__dirname, "..", "..", "commands");

    try {
      const commandFolders = fs.readdirSync(foldersPath);

      for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs
          .readdirSync(commandsPath)
          .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

        for (const file of commandFiles) {
          const filePath = path.join(commandsPath, file);
          
          try {
            const commandModule = await import(filePath);
            const command: Command = commandModule.default || commandModule;

            if ("data" in command && "execute" in command) {
              commands.push(command.data.toJSON());
            } else {
              console.warn(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
              );
            }
          } catch (error) {
            ErrorHandler.logError(`Loading command for deployment ${filePath}`, error as Error);
          }
        }
      }
    } catch (error) {
      ErrorHandler.logError("Loading commands for deployment", error as Error);
    }

    return commands;
  }
}

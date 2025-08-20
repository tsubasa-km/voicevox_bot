import { Client } from "discord.js";
import { Logger } from "@/utils/logger.js";

export function handleClientReady(readyClient: Client<true>): void {
  Logger.info(`Logged in as ${readyClient.user.tag}!`);
}

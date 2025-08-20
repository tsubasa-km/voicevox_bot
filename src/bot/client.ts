import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";

import { config } from "@/utils/config.js";
import { ErrorHandler } from "@/utils/error-handler.js";
import { Logger } from "@/utils/logger.js";
import { CommandLoader } from "./commands/loader.js";
import { handleClientReady } from "./events/ready.js";
import { handleInteraction } from "./events/interaction.js";
import { handleVoiceStateUpdate } from "./events/voice-state.js";
import { handleMessage } from "./events/message.js";

export class VoiceVoxBot {
  private client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private async setupEventHandlers(): Promise<void> {
    // コマンド読み込み
    this.client.commands = await CommandLoader.loadCommands();

    // イベントハンドラーの設定
    this.client.on(Events.ClientReady, (client) => {
      handleClientReady(client).catch(error => {
        ErrorHandler.logError("Ready event handler", error);
      });
    });
    this.client.on(Events.InteractionCreate, handleInteraction);
    this.client.on(Events.VoiceStateUpdate, handleVoiceStateUpdate);
    this.client.on(Events.MessageCreate, handleMessage);
  }

  async start(): Promise<void> {
    try {
      await this.client.login(config.discord.token);
    } catch (error) {
      ErrorHandler.logError("Bot startup", error as Error);
      throw error;
    }
  }

  getClient(): Client {
    return this.client;
  }
}

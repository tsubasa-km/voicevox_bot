import { Collection } from "discord.js";
import { voiceVoxService } from "./src/services/voicevox.js";
import { VoiceVoxBot } from "./src/bot/client.js";
import { Logger } from "./src/utils/logger.js";
import { Command } from "./src/types/discord.js";

// VoiceVoxの準備確認
if (await voiceVoxService.checkVoiceVox()) {
  Logger.info("VoiceVox is ready.");
} else {
  throw new Error("VoiceVox is not ready.");
}

// コマンドデプロイ
import "./src/bot/commands/deployer.js";

// Discord.jsクライアントの型拡張
declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

// ボット起動
const bot = new VoiceVoxBot();
bot.start().catch(console.error);

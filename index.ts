import { Collection } from "discord.js";
import { voiceVoxService } from "@/services/voicevox.js";
import { VoiceVoxBot } from "@/bot/client.js";
import { Logger } from "@/utils/logger.js";
import { Command } from "@/types/discord.js";
import { config } from "@/utils/config.js";

// VoiceVoxの準備確認
const voiceVoxStatus = await voiceVoxService.checkVoiceVox();
if (voiceVoxStatus) {
  Logger.info("VoiceVox is ready.");
} else {
  Logger.error("VoiceVox is not ready. Please check if VOICEVOX Engine is running.");
  throw new Error("VoiceVox is not ready. Please check if VOICEVOX Engine is running at " + config.voicevox.apiUrl);
}

// コマンドデプロイ
import "@/bot/commands/deployer.js";

// Discord.jsクライアントの型拡張
declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

// ボット起動
const bot = new VoiceVoxBot();
bot.start().catch(console.error);

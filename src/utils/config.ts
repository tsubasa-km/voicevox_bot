import dotenv from "dotenv";

dotenv.config();

export interface Config {
  discord: {
    token: string;
    clientId: string;
  };
  voicevox: {
    apiUrl: string;
  };
  database: {
    path: string;
  };
  isDevelopment: boolean;
}

export const config: Config = {
  discord: {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
  },
  voicevox: {
    apiUrl: process.env.VOICEVOX_API_URL || "http://127.0.0.1:50021",
  },
  database: {
    path: process.env.DATABASE_PATH || "sqlite://database.sqlite",
  },
  isDevelopment: process.env.NODE_ENV !== "production",
};

// 必要な環境変数の検証
if (!config.discord.token) {
  throw new Error("DISCORD_TOKEN is required");
}

if (!config.discord.clientId) {
  throw new Error("DISCORD_CLIENT_ID is required");
}

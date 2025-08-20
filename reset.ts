import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID!);
  if (guild) {
    guild.commands.set([]);
  }
});

client.login(process.env.DISCORD_TOKEN);

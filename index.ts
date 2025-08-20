import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ChatInputCommandInteraction,
  VoiceState,
  Message,
  BaseInteraction,
} from "discord.js";
import {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { Readable } from "node:stream";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import { db } from "./src/db.js";
import { textToSpeech, checkVoiceVox } from "./src/voicevox.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Command {
  data: any;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

if (await checkVoiceVox()) {
  console.log("VoiceVox is ready.");
} else {
  throw new Error("VoiceVox is not ready.");
}

import "./src/deploy-commands.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = await import(filePath);
    const command: Command = commandModule.default || commandModule;
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

client.on(Events.ClientReady, (readyClient: Client<true>) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction: BaseInteraction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  if (newState.member?.user.bot || oldState.channelId === newState.channelId) return;
  if (oldState.channel && oldState.channel.members.size === 1) {
    const connection = getVoiceConnection(oldState.guild.id);
    if (connection) {
      connection.destroy();
    }
  }
  if (newState.channel && (!oldState.channel || oldState.channel.members.size === 1)) {
    const autoconnect = await db.get(`${newState.guild.id}-autoconnect`);
    if (autoconnect === "on") {
      joinVoiceChannel({
        channelId: newState.channelId!,
        guildId: newState.guild.id,
        adapterCreator: newState.guild.voiceAdapterCreator,
        selfMute: false,
        selfDeaf: false,
      });
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  const connection = getVoiceConnection(message.guild.id);
  if (!connection) return;
  const isMuted = await db.get(
    `${message.guild.id}-channel-mute-${message.channel.id}`
  );
  if (isMuted === "on") return;

  const buffer = await textToSpeech(message.content, message.guild.id, message.author.id);
  if (!buffer) return;
  
  const audioStream = new Readable();
  audioStream.push(buffer);
  audioStream.push(null);

  const resource = createAudioResource(audioStream, {
    inputType: StreamType.Arbitrary,
  });

  const player = createAudioPlayer();
  player.play(resource);

  connection.subscribe(player);
});

client.login(process.env.DISCORD_TOKEN);

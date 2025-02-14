const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
} = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  StreamType,
} = require("@discordjs/voice");
const { Readable } = require("node:stream");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config();

const db = require("./db");
const { textToSpeech, checkVoiceVox } = require("./voicevox");

(async () => {
  const isReady = await checkVoiceVox();
  console.log(isReady);
  if (isReady) {
    console.log("VoiceVox is ready.");
  } else {
    throw new Error("VoiceVox is not ready.");
  }
})();
require("./deploy-commands");

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
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
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

client.on(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
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

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.member.user.bot) return;
  if (oldState.channelId === newState.channelId) return;
  if (newState.channelId === null) {
    const connection = getVoiceConnection(oldState.guild.id);
    if (connection) {
      connection.destroy();
    }
  }
  const autoconnect = await db.get(`${newState.guild.id}-autoconnect`);
  if (autoconnect === "on") {
    joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const connection = getVoiceConnection(message.guild.id);
  if (!connection) return;
  const isMuted = await db.get(
    `${message.guild.id}-channel-mute-${message.channel.id}`
  );
  if (isMuted === "on") return;

  const speaker =
    (await db.get(`${message.guild.id}-speaker-${message.author.id}`)) ?? "3";

  const buffer = await textToSpeech(message.content, parseInt(speaker));
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

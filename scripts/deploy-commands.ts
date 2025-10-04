import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { slashCommandData } from '@/commands/index.js';
import { logger } from '@/utils/logger.js';

interface DeployOptions {
  guildIds: string[];
  registerGlobal: boolean;
}

function parseArgs(argv: string[]): DeployOptions {
  const guildIds: string[] = [];
  let registerGlobal = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--guild': {
        const next = argv[i + 1];
        if (!next) {
          throw new Error('Missing value for --guild');
        }
        guildIds.push(next);
        i += 1;
        break;
      }
      case '--no-global': {
        registerGlobal = false;
        break;
      }
      case '--help': {
        logger.info(
          'Usage: npm run deploy:commands -- [--no-global] [--guild <GUILD_ID> ...]\n' +
            ' - Without flags, global commands are registered.\n' +
            ' - Pass one or more --guild <ID> to replace commands for specific guilds (fast propagation).\n' +
            ' - Use --no-global to skip global registration when only updating guild commands.'
        );
        process.exit(0);
      }
      default: {
        throw new Error(`Unknown argument: ${arg}`);
      }
    }
  }

  return { guildIds, registerGlobal };
}

async function registerGlobalCommands(rest: REST, clientId: string, body: unknown[]): Promise<void> {
  await rest.put(Routes.applicationCommands(clientId), { body });
  logger.info(`Registered ${body.length} global command(s)`);
}

async function registerGuildCommands(rest: REST, clientId: string, guildId: string, body: unknown[]): Promise<void> {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  logger.info(`Registered ${body.length} guild command(s) for guild ${guildId}`);
}

async function main(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is required');
  }
  if (!clientId) {
    throw new Error('DISCORD_CLIENT_ID is required');
  }

  const options = parseArgs(process.argv.slice(2));
  const rest = new REST({ version: '10' }).setToken(token);
  const body = slashCommandData.map((builder) => builder.toJSON());

  if (options.registerGlobal) {
    await registerGlobalCommands(rest, clientId, body);
  }

  for (const guildId of options.guildIds) {
    await registerGuildCommands(rest, clientId, guildId, body);
  }
}

main().catch((error) => {
  logger.error('Failed to register commands', error);
  process.exit(1);
});

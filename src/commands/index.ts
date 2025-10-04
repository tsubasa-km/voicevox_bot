import type { Command, CommandDependencies, SlashCommandData } from '@/commands/types.js';
import { buildVcCommand, vcCommandData } from '@/commands/vc.js';
import {
  buildSettingUserSpeakerCommand,
  settingUserSpeakerCommandData
} from '@/commands/settingUserSpeaker.js';
import { buildListSpeakersCommand, listSpeakersCommandData } from '@/commands/listSpeakers.js';

const factories: Array<(deps: CommandDependencies) => Command> = [
  buildVcCommand,
  buildSettingUserSpeakerCommand,
  buildListSpeakersCommand
];

export function buildCommands(deps: CommandDependencies): Command[] {
  return factories.map((factory) => factory(deps));
}

export const slashCommandData: SlashCommandData[] = [
  vcCommandData,
  settingUserSpeakerCommandData,
  listSpeakersCommandData
];

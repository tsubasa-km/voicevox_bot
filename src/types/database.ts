export interface DatabaseKeys {
  userSpeaker: (guildId: string, userId: string) => string;
  userPitch: (guildId: string, userId: string) => string;
  userSpeed: (guildId: string, userId: string) => string;
  guildAutoConnect: (guildId: string) => string;
  channelMute: (guildId: string, channelId: string) => string;
}

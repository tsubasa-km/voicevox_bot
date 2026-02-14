import { createHash } from 'node:crypto';
import type { VoiceVoxService } from '@/services/voicevox.js';
import { logger } from '@/utils/logger.js';

interface ResolveSpeakerIdParams {
  guildId: string;
  userId: string;
  configuredSpeakerId?: number | null;
  defaultSpeakerId: number;
  voiceVoxService: VoiceVoxService;
}

function isNormalStyle(styleName: string): boolean {
  const normalized = styleName.trim().toLowerCase();
  return normalized === 'ノーマル' || normalized === 'normal';
}

export async function resolveSpeakerId(params: ResolveSpeakerIdParams): Promise<number> {
  const { guildId, userId, configuredSpeakerId, defaultSpeakerId, voiceVoxService } = params;

  if (typeof configuredSpeakerId === 'number' && configuredSpeakerId >= 0) {
    return configuredSpeakerId;
  }

  try {
    const styles = await voiceVoxService.listSpeakerStyles();
    if (styles.length === 0) {
      return defaultSpeakerId;
    }
    const normalStyles = styles.filter((style) => isNormalStyle(style.styleName));
    if (normalStyles.length === 0) {
      logger.warn('No normal styles found in VoiceVox speakers; falling back to default speaker');
      return defaultSpeakerId;
    }

    const digest = createHash('sha256').update(`${guildId}:${userId}`).digest();
    const hashValue = digest.readUInt32BE(0);
    return normalStyles[hashValue % normalStyles.length].styleId;
  } catch (error) {
    logger.warn(`Failed to resolve hashed speaker for guild=${guildId} user=${userId}`, error);
    return defaultSpeakerId;
  }
}

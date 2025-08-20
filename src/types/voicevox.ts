export interface AudioQueryData {
  pitchScale: number;
  speedScale: number;
  [key: string]: any;
}

export interface VoiceVoxVersion {
  version: string;
}

export interface Speaker {
  name: string;
  speaker_uuid: string;
  styles: Array<{
    name: string;
    id: number;
    type: string;
  }>;
  version: string;
}

export interface UserVoiceSettings {
  speakerId: string;
  pitchScale: number;
  speedScale: number;
}

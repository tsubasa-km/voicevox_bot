export interface VoiceVoxStyle {
  id: number;
  name: string;
}

export interface VoiceVoxSpeaker {
  speakerUuid: string;
  name: string;
  styles: VoiceVoxStyle[];
}

export interface SpeakerStyleDescriptor {
  speakerName: string;
  styleName: string;
  styleId: number;
}

export class VoiceVoxService {
  private speakersCache: VoiceVoxSpeaker[] | null = null;

  constructor(private readonly baseUrl: string) {}

  async listSpeakers(forceRefresh = false): Promise<VoiceVoxSpeaker[]> {
    if (!forceRefresh && this.speakersCache) {
      return this.speakersCache;
    }

    const url = new URL('/speakers', this.baseUrl);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`VoiceVox speakers fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as VoiceVoxSpeaker[];
    this.speakersCache = data;
    return data;
  }

  async listSpeakerStyles(forceRefresh = false): Promise<SpeakerStyleDescriptor[]> {
    const speakers = await this.listSpeakers(forceRefresh);
    return speakers.flatMap((speaker) =>
      speaker.styles.map((style) => ({
        speakerName: speaker.name,
        styleName: style.name,
        styleId: style.id
      }))
    );
  }

  async synthesizeSpeech(text: string, speakerId: number): Promise<Buffer> {
    const audioQueryUrl = new URL('/audio_query', this.baseUrl);
    audioQueryUrl.searchParams.set('speaker', speakerId.toString());
    audioQueryUrl.searchParams.set('text', text);

    const audioQueryResponse = await fetch(audioQueryUrl, { method: 'POST' });
    if (!audioQueryResponse.ok) {
      throw new Error(`VoiceVox audio_query failed: ${audioQueryResponse.status} ${audioQueryResponse.statusText}`);
    }

    const audioQuery = await audioQueryResponse.json();

    const synthesisUrl = new URL('/synthesis', this.baseUrl);
    synthesisUrl.searchParams.set('speaker', speakerId.toString());

    const synthesisResponse = await fetch(synthesisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(audioQuery)
    });

    if (!synthesisResponse.ok) {
      throw new Error(`VoiceVox synthesis failed: ${synthesisResponse.status} ${synthesisResponse.statusText}`);
    }

    const arrayBuffer = await synthesisResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

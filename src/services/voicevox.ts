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

export interface VoiceSynthesisOptions {
  pitch?: number;
  speed?: number;
}

export interface VoiceVoxAudioQuery {
  accent_phrases?: unknown;
  kana?: string;
  speedScale?: number;
  pitchScale?: number;
  [key: string]: unknown;
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

  async buildAudioQuery(text: string, speakerId: number): Promise<VoiceVoxAudioQuery> {
    const audioQueryUrl = new URL('/audio_query', this.baseUrl);
    audioQueryUrl.searchParams.set('speaker', speakerId.toString());
    audioQueryUrl.searchParams.set('text', text);

    const audioQueryResponse = await fetch(audioQueryUrl, { method: 'POST' });
    if (!audioQueryResponse.ok) {
      throw new Error(`VoiceVox audio_query failed: ${audioQueryResponse.status} ${audioQueryResponse.statusText}`);
    }

    const audioQuery = (await audioQueryResponse.json()) as VoiceVoxAudioQuery;
    if (!audioQuery || typeof audioQuery !== 'object') {
      throw new Error('VoiceVox audio_query returned invalid JSON');
    }

    return audioQuery;
  }

  async buildAccentPhrasesFromKana(kana: string, speakerId: number): Promise<unknown[]> {
    const accentPhrasesUrl = new URL('/accent_phrases', this.baseUrl);
    accentPhrasesUrl.searchParams.set('speaker', speakerId.toString());
    accentPhrasesUrl.searchParams.set('is_kana', 'true');
    accentPhrasesUrl.searchParams.set('text', kana);

    const response = await fetch(accentPhrasesUrl, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`VoiceVox accent_phrases failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new Error('VoiceVox accent_phrases returned invalid JSON');
    }

    return data;
  }

  async synthesizeFromAudioQuery(
    audioQuery: VoiceVoxAudioQuery,
    speakerId: number,
    options?: VoiceSynthesisOptions
  ): Promise<Buffer> {
    const synthesisBody: VoiceVoxAudioQuery = {
      ...audioQuery
    };

    if (Number.isFinite(options?.speed)) {
      synthesisBody.speedScale = options?.speed;
    }
    if (Number.isFinite(options?.pitch)) {
      synthesisBody.pitchScale = options?.pitch;
    }

    const synthesisUrl = new URL('/synthesis', this.baseUrl);
    synthesisUrl.searchParams.set('speaker', speakerId.toString());

    const synthesisResponse = await fetch(synthesisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(synthesisBody)
    });

    if (!synthesisResponse.ok) {
      throw new Error(`VoiceVox synthesis failed: ${synthesisResponse.status} ${synthesisResponse.statusText}`);
    }

    const arrayBuffer = await synthesisResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async synthesizeSpeech(
    text: string,
    speakerId: number,
    options?: VoiceSynthesisOptions
  ): Promise<Buffer> {
    const audioQuery = await this.buildAudioQuery(text, speakerId);
    return this.synthesizeFromAudioQuery(audioQuery, speakerId, options);
  }
}

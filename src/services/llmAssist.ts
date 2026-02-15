import { decryptSecret } from '@/utils/crypto.js';
import { logger } from '@/utils/logger.js';
import {
  defaultLlmModels,
  llmProviderPriority
} from '@/llm/types.js';
import type { LlmProvider } from '@/llm/types.js';
import type { UserLlmAssistSettings } from '@/db/userLlmAssistSettings.js';
import type { LlmApiKeyRecord } from '@/db/llmApiKeys.js';
import type { VoiceVoxAudioQuery, VoiceVoxService } from '@/services/voicevox.js';

interface AssistInput {
  guildId: string;
  userId: string;
  text: string;
  speakerId: number;
}

export interface AssistResult {
  text: string;
  audioQuery?: VoiceVoxAudioQuery;
}

interface StageSettings {
  provider: LlmProvider | null;
  apiKeyId: string | null;
  model: string | null;
}

interface LlmAssistDependencies {
  getUserLlmAssistSettings: (guildId: string, userId: string) => Promise<UserLlmAssistSettings | null>;
  findAccessibleApiKey: (
    guildId: string,
    userId: string,
    provider: LlmProvider,
    keyId: string
  ) => Promise<LlmApiKeyRecord | null>;
  findAccessibleApiKeysByProvider: (
    guildId: string,
    userId: string,
    provider: LlmProvider
  ) => Promise<LlmApiKeyRecord[]>;
  voiceVoxService: VoiceVoxService;
  masterKey: Buffer;
  maxUtteranceLength: number;
}

interface LlmCandidate {
  provider: LlmProvider;
  key: LlmApiKeyRecord;
  model: string;
}

interface OpenAiResponse {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: unknown;
    }>;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
}

const stage1Instruction = `You are a Japanese speech-text assistant.
Rewrite user input into natural Japanese for TTS while preserving the intent.
Prioritize:
- Expand abbreviations into readable Japanese words (e.g., MTG -> ミーティング).
- Normalize time/number expressions into spoken form (e.g., 10:30 -> 10時半 or 10時30分).
- Fix obvious typos only when highly confident from context.
- Keep sentence meaning and tone.
Return only the rewritten Japanese text. No explanations.

Examples:
Input: 明日10:30にMTG、場所はShibuyaです!
Output: 明日10時30分にミーティング、場所は渋谷です！

Input: APIのレスポンスが404だったのでretryした
Output: APIのレスポンスが404だったのでリトライした`;

const stage2Instruction = `You are a VOICEVOX kana accent editor.
You will receive VOICEVOX kana notation and must adjust only accent/prosody markers.
Rules:
- Keep lexical readings as-is whenever possible.
- Prefer minimal edits.
- You may adjust only punctuation/prosody markers such as ', /, 、, +, ;, _.
- Do not add explanations.
Return only the corrected kana string.`;

const requestTimeoutMs = 6000;

class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text();
      throw new HttpRequestError(`HTTP ${response.status}`, response.status, body);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function applyMaxLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)} 以下略`;
}

function softenPunctuation(text: string): string {
  let commaCountInSentence = 0;
  let result = '';

  for (const char of text) {
    if (char === '、') {
      if (commaCountInSentence < 2) {
        result += char;
        commaCountInSentence += 1;
      }
      continue;
    }

    result += char;

    if (char === '。' || char === '!' || char === '！' || char === '?' || char === '？') {
      commaCountInSentence = 0;
    }
  }

  result = result
    .replace(/、{2,}/g, '、')
    .replace(/、([。！？!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return result;
}

function summarizeError(error: unknown): string {
  if (error instanceof HttpRequestError) {
    const compactBody = error.body.replace(/\s+/g, ' ').slice(0, 240);
    return `${error.message} ${compactBody}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeKanaOutput(text: string): string {
  return text.trim().replace(/\s+/g, '');
}

export class LlmAssist {
  private readonly rotationState = new Map<string, number>();

  constructor(private readonly deps: LlmAssistDependencies) {}

  async assist(input: AssistInput): Promise<AssistResult> {
    try {
      const settings = await this.deps.getUserLlmAssistSettings(input.guildId, input.userId);
      if (!settings?.enabled) {
        return { text: input.text };
      }

      const sharedSettings: StageSettings = {
        provider: settings.provider,
        apiKeyId: settings.apiKeyId,
        model: settings.model
      };

      if (sharedSettings.apiKeyId && !sharedSettings.provider) {
        logger.warn(
          `LLM assist invalid for guild=${input.guildId} user=${input.userId}: apiKeyId requires provider`
        );
        return { text: input.text };
      }

      const stage1Candidates = await this.buildCandidates(input.guildId, input.userId, sharedSettings, 'stage1');
      if (stage1Candidates.length === 0) {
        logger.warn(`No available LLM API key for stage1 guild=${input.guildId} user=${input.userId}`);
        return { text: input.text };
      }

      const stage1Text = await this.runStage(stage1Candidates, stage1Instruction, input.text, 'stage1');
      if (!stage1Text) {
        return { text: input.text };
      }

      const shapedStage1Text = applyMaxLength(softenPunctuation(stage1Text), this.deps.maxUtteranceLength);

      let baseAudioQuery: VoiceVoxAudioQuery;
      try {
        baseAudioQuery = await this.deps.voiceVoxService.buildAudioQuery(shapedStage1Text, input.speakerId);
      } catch (error) {
        logger.warn(
          `LLM assist stage2 skipped (audio_query failed) guild=${input.guildId} user=${input.userId}: ${summarizeError(error)}`
        );
        return { text: shapedStage1Text };
      }

      const sourceKana = typeof baseAudioQuery.kana === 'string' ? baseAudioQuery.kana.trim() : '';
      if (!sourceKana) {
        return { text: shapedStage1Text };
      }

      const stage2Candidates = await this.buildCandidates(input.guildId, input.userId, sharedSettings, 'stage2');
      if (stage2Candidates.length === 0) {
        logger.warn(`No available LLM API key for stage2 guild=${input.guildId} user=${input.userId}`);
        return { text: shapedStage1Text };
      }

      const stage2Input = `Original text:\n${shapedStage1Text}\n\nKana:\n${sourceKana}`;
      const stage2KanaRaw = await this.runStage(stage2Candidates, stage2Instruction, stage2Input, 'stage2');
      if (!stage2KanaRaw) {
        return { text: shapedStage1Text };
      }

      const stage2Kana = normalizeKanaOutput(stage2KanaRaw);
      if (!stage2Kana) {
        return { text: shapedStage1Text };
      }

      try {
        const accentPhrases = await this.deps.voiceVoxService.buildAccentPhrasesFromKana(stage2Kana, input.speakerId);
        return {
          text: shapedStage1Text,
          audioQuery: {
            ...baseAudioQuery,
            kana: stage2Kana,
            accent_phrases: accentPhrases
          }
        };
      } catch (error) {
        logger.warn(
          `LLM assist stage2 skipped (accent parse failed) guild=${input.guildId} user=${input.userId}: ${summarizeError(error)}`
        );
        return { text: shapedStage1Text };
      }
    } catch (error) {
      logger.warn('LLM assist failed; fallback to original text', error);
      return { text: input.text };
    }
  }

  private async runStage(
    candidates: LlmCandidate[],
    instruction: string,
    inputText: string,
    stageLabel: 'stage1' | 'stage2'
  ): Promise<string | null> {
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const apiKey = decryptSecret(
          candidate.key.encryptedKey,
          candidate.key.iv,
          candidate.key.authTag,
          this.deps.masterKey
        );

        let output: string;
        if (candidate.provider === 'openai') {
          output = await this.generateWithOpenAi(apiKey, candidate.model, instruction, inputText);
        } else {
          output = await this.generateWithGemini(apiKey, candidate.model, instruction, inputText);
        }

        const trimmed = output.trim();
        if (!trimmed) {
          lastError = new Error('LLM returned empty text');
          continue;
        }

        return trimmed;
      } catch (error) {
        lastError = error;
        logger.warn(
          `LLM assist ${stageLabel} attempt failed provider=${candidate.provider} keyId=${candidate.key.keyId}: ${summarizeError(error)}`
        );
      }
    }

    logger.warn(
      `LLM assist ${stageLabel} failed after ${candidates.length} attempt(s): ${summarizeError(lastError)}`
    );
    return null;
  }

  private async buildCandidates(
    guildId: string,
    userId: string,
    stageSettings: StageSettings,
    stageLabel: 'stage1' | 'stage2'
  ): Promise<LlmCandidate[]> {
    if (stageSettings.provider && stageSettings.apiKeyId) {
      const key = await this.deps.findAccessibleApiKey(
        guildId,
        userId,
        stageSettings.provider,
        stageSettings.apiKeyId
      );
      if (!key) {
        logger.warn(
          `LLM assist ${stageLabel} key not accessible for guild=${guildId} user=${userId} provider=${stageSettings.provider} keyId=${stageSettings.apiKeyId}`
        );
        return [];
      }
      return [
        {
          provider: stageSettings.provider,
          key,
          model: stageSettings.model?.trim() || defaultLlmModels[stageSettings.provider]
        }
      ];
    }

    if (stageSettings.provider) {
      const keys = await this.selectByRotation(guildId, userId, stageSettings.provider, stageLabel);
      if (keys.length === 0) {
        logger.warn(
          `No LLM assist ${stageLabel} key for provider=${stageSettings.provider} guild=${guildId} user=${userId}`
        );
        return [];
      }
      return keys.map((key) => ({
        provider: stageSettings.provider!,
        key,
        model: stageSettings.model?.trim() || defaultLlmModels[stageSettings.provider!]
      }));
    }

    const result: LlmCandidate[] = [];
    for (const provider of llmProviderPriority) {
      const keys = await this.selectByRotation(guildId, userId, provider, stageLabel);
      result.push(
        ...keys.map((key) => ({
          provider,
          key,
          model: stageSettings.model?.trim() || defaultLlmModels[provider]
        }))
      );
    }

    return result;
  }

  private async selectByRotation(
    guildId: string,
    userId: string,
    provider: LlmProvider,
    stageLabel: 'stage1' | 'stage2'
  ): Promise<LlmApiKeyRecord[]> {
    const keys = await this.deps.findAccessibleApiKeysByProvider(guildId, userId, provider);
    if (keys.length === 0) {
      return [];
    }

    const stateKey = `${guildId}:${userId}:${provider}:${stageLabel}`;
    const currentIndex = this.rotationState.get(stateKey) ?? 0;
    const normalizedIndex = currentIndex % keys.length;
    this.rotationState.set(stateKey, (currentIndex + 1) % keys.length);

    return [...keys.slice(normalizedIndex), ...keys.slice(0, normalizedIndex)];
  }

  private async generateWithOpenAi(
    apiKey: string,
    model: string,
    instruction: string,
    text: string
  ): Promise<string> {
    const body = {
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: instruction }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      ],
      temperature: 0.2
    };

    const data = (await fetchJson(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      },
      requestTimeoutMs
    )) as OpenAiResponse;

    if (typeof data.output_text === 'string' && data.output_text.length > 0) {
      return data.output_text;
    }

    for (const output of data.output ?? []) {
      for (const content of output.content ?? []) {
        if (content.type === 'output_text' && typeof content.text === 'string') {
          return content.text;
        }
      }
    }

    throw new Error('OpenAI response did not contain output text');
  }

  private async generateWithGemini(
    apiKey: string,
    model: string,
    instruction: string,
    text: string
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      systemInstruction: {
        parts: [{ text: instruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text }]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    };

    const data = (await fetchJson(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      requestTimeoutMs
    )) as GeminiResponse;

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const output = parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (!output) {
      throw new Error('Gemini response did not contain output text');
    }

    return output;
  }
}

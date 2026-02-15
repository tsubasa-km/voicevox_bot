import { decryptSecret } from '@/utils/crypto.js';
import { logger } from '@/utils/logger.js';
import {
  defaultLlmModels,
  llmProviderPriority
} from '@/llm/types.js';
import type { LlmProvider } from '@/llm/types.js';
import type { UserLlmSettings } from '@/db/userLlmSettings.js';
import type { LlmApiKeyRecord } from '@/db/llmApiKeys.js';

interface NormalizeInput {
  guildId: string;
  userId: string;
  text: string;
}

interface LlmNormalizerDependencies {
  getUserLlmSettings: (guildId: string, userId: string) => Promise<UserLlmSettings | null>;
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

const normalizationInstruction =
  'あなたは日本語の読み上げ前処理器です。入力文を、意味を変えずに自然な読み上げ向けへ整形してください。' +
  ' 漢字と英数字は可能な限りひらがなにし、句読点は最小限にしてください。' +
  ' 読点（、）の多用や細かすぎる区切りは避けてください。' +
  ' 余計な説明は出力せず、整形後の本文のみを返してください。';

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

export class LlmNormalizer {
  private readonly rotationState = new Map<string, number>();

  constructor(private readonly deps: LlmNormalizerDependencies) {}

  async normalize(input: NormalizeInput): Promise<string> {
    try {
      const settings = await this.deps.getUserLlmSettings(input.guildId, input.userId);
      if (!settings?.enabled) {
        return input.text;
      }

      if (settings.apiKeyId && !settings.provider) {
        logger.warn(
          `LLM setting invalid for guild=${input.guildId} user=${input.userId}: apiKeyId requires provider`
        );
        return input.text;
      }

      const candidates = await this.buildCandidates(input.guildId, input.userId, settings);
      if (candidates.length === 0) {
        logger.warn(`No available LLM API key for guild=${input.guildId} user=${input.userId}`);
        return input.text;
      }

      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const apiKey = decryptSecret(
            candidate.key.encryptedKey,
            candidate.key.iv,
            candidate.key.authTag,
            this.deps.masterKey
          );

          let normalized: string;
          if (candidate.provider === 'openai') {
            normalized = await this.normalizeWithOpenAi(apiKey, candidate.model, input.text);
          } else {
            normalized = await this.normalizeWithGemini(apiKey, candidate.model, input.text);
          }

          const trimmed = softenPunctuation(normalized.trim());
          if (!trimmed) {
            lastError = new Error('LLM returned empty text');
            continue;
          }

          return applyMaxLength(trimmed, this.deps.maxUtteranceLength);
        } catch (error) {
          lastError = error;
          logger.warn(
            `LLM attempt failed provider=${candidate.provider} keyId=${candidate.key.keyId}: ${summarizeError(error)}`
          );
        }
      }

      logger.warn(
        `LLM normalization failed after ${candidates.length} attempt(s); fallback to original text (${summarizeError(lastError)})`
      );
      return input.text;
    } catch (error) {
      logger.warn('LLM normalization failed; fallback to original text', error);
      return input.text;
    }
  }

  private async buildCandidates(
    guildId: string,
    userId: string,
    settings: UserLlmSettings
  ): Promise<LlmCandidate[]> {
    if (settings.provider && settings.apiKeyId) {
      const key = await this.deps.findAccessibleApiKey(guildId, userId, settings.provider, settings.apiKeyId);
      if (!key) {
        logger.warn(
          `LLM key not accessible for guild=${guildId} user=${userId} provider=${settings.provider} keyId=${settings.apiKeyId}`
        );
        return [];
      }
      return [
        {
          provider: settings.provider,
          key,
          model: settings.model?.trim() || defaultLlmModels[settings.provider]
        }
      ];
    }

    if (settings.provider) {
      const keys = await this.selectByRotation(guildId, userId, settings.provider);
      if (keys.length === 0) {
        logger.warn(`No LLM key for provider=${settings.provider} guild=${guildId} user=${userId}`);
        return [];
      }
      return keys.map((key) => ({
        provider: settings.provider!,
        key,
        model: settings.model?.trim() || defaultLlmModels[settings.provider!]
      }));
    }

    const result: LlmCandidate[] = [];
    for (const provider of llmProviderPriority) {
      const keys = await this.selectByRotation(guildId, userId, provider);
      result.push(
        ...keys.map((key) => ({
          provider,
          key,
          model: settings.model?.trim() || defaultLlmModels[provider]
        }))
      );
    }
    return result;
  }

  private async selectByRotation(
    guildId: string,
    userId: string,
    provider: LlmProvider
  ): Promise<LlmApiKeyRecord[]> {
    const keys = await this.deps.findAccessibleApiKeysByProvider(guildId, userId, provider);
    if (keys.length === 0) {
      return [];
    }

    const stateKey = `${guildId}:${userId}:${provider}`;
    const currentIndex = this.rotationState.get(stateKey) ?? 0;
    const normalizedIndex = currentIndex % keys.length;
    this.rotationState.set(stateKey, (currentIndex + 1) % keys.length);

    return [...keys.slice(normalizedIndex), ...keys.slice(0, normalizedIndex)];
  }

  private async normalizeWithOpenAi(apiKey: string, model: string, text: string): Promise<string> {
    const body = {
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: normalizationInstruction }]
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

  private async normalizeWithGemini(apiKey: string, model: string, text: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      systemInstruction: {
        parts: [{ text: normalizationInstruction }]
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

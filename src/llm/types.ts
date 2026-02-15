export const llmProviders = ['gemini', 'openai'] as const;
export type LlmProvider = (typeof llmProviders)[number];

export const llmApiKeyScopes = ['guild', 'global'] as const;
export type LlmApiKeyScope = (typeof llmApiKeyScopes)[number];

export const llmProviderPriority: LlmProvider[] = ['gemini', 'openai'];

export const defaultLlmModels: Record<LlmProvider, string> = {
  gemini: 'gemini-2.5-flash-lite',
  openai: 'gpt-4o-mini'
};

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === 'string' && llmProviders.includes(value as LlmProvider);
}

export function isLlmApiKeyScope(value: unknown): value is LlmApiKeyScope {
  return typeof value === 'string' && llmApiKeyScopes.includes(value as LlmApiKeyScope);
}

export function resolveScopeGuildId(scope: LlmApiKeyScope, guildId: string): string {
  return scope === 'global' ? '*' : guildId;
}

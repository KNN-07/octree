export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'openai-compatible';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
}

export interface AITaskSettings {
  agent: AIProviderConfig;
  document: AIProviderConfig;
  summary: AIProviderConfig;
  image: AIProviderConfig;
}

export const DEFAULT_AI_SETTINGS: AITaskSettings = {
  agent: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  document: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  summary: { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  image: { provider: 'openai', model: 'gpt-4o-mini' },
};

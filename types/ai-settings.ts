export const AI_PROVIDERS = [
  'anthropic',
  'openai',
  'gemini',
  'openai-compatible',
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_TASKS = [
  'editor-assistant',
  'document-generation',
  'image-analysis',
  'conversation-summary',
] as const;

export type AiTask = (typeof AI_TASKS)[number];
export type AiCredentialMode = 'managed' | 'byok';

export interface AiProviderConfig {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  credentialMode?: AiCredentialMode;
}

export interface AiTaskSettings extends AiProviderConfig {
  credentialMode: AiCredentialMode;
}

export type AiSettingsByTask = Record<AiTask, AiTaskSettings>;

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  'openai-compatible': 'OpenAI-Compatible',
};

export const DEFAULT_MODELS: Record<AiTask, Record<AiProvider, string>> = {
  'editor-assistant': {
    anthropic: 'claude-haiku-4-5-20251001',
    openai: 'gpt-5-mini',
    gemini: 'gemini-2.5-flash',
    'openai-compatible': '',
  },
  'document-generation': {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-5.1',
    gemini: 'gemini-2.5-pro',
    'openai-compatible': '',
  },
  'image-analysis': {
    anthropic: 'claude-haiku-4-5-20251001',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.5-flash',
    'openai-compatible': '',
  },
  'conversation-summary': {
    anthropic: 'claude-haiku-4-5-20251001',
    openai: 'gpt-5-mini',
    gemini: 'gemini-2.5-flash',
    'openai-compatible': '',
  },
};

export const DEFAULT_AI_SETTINGS: AiSettingsByTask = {
  'editor-assistant': {
    provider: 'anthropic',
    model: DEFAULT_MODELS['editor-assistant'].anthropic,
    credentialMode: 'managed',
  },
  'document-generation': {
    provider: 'anthropic',
    model: DEFAULT_MODELS['document-generation'].anthropic,
    credentialMode: 'managed',
  },
  'image-analysis': {
    provider: 'openai',
    model: DEFAULT_MODELS['image-analysis'].openai,
    credentialMode: 'managed',
  },
  'conversation-summary': {
    provider: 'anthropic',
    model: DEFAULT_MODELS['conversation-summary'].anthropic,
    credentialMode: 'managed',
  },
};

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type AiProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'openai-compatible';
export type AiCredentialMode = 'managed' | 'byok';

export interface AiProviderConfig {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  credentialMode?: AiCredentialMode;
}

const SUPPORTED_PROVIDERS: Record<AiProvider, true> = {
  anthropic: true,
  openai: true,
  gemini: true,
  'openai-compatible': true,
};

export class AiConfigurationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

function normalizeBaseURL(value: string | undefined): string | undefined {
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiConfigurationError(
      'Endpoint URL must be a valid absolute URL.'
    );
  }

  const isDevelopmentHttp =
    process.env.NODE_ENV !== 'production' && url.protocol === 'http:';
  if (url.protocol !== 'https:' && !isDevelopmentHttp) {
    throw new AiConfigurationError('Endpoint URL must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new AiConfigurationError(
      'Endpoint URL cannot include credentials, a query, or a fragment.'
    );
  }

  const hostname = url.hostname.toLowerCase();
  const isPrivateIpv4 =
    /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      hostname
    );
  const isPrivateIpv6 =
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80:');
  if (
    process.env.NODE_ENV === 'production' &&
    (hostname === 'localhost' ||
      hostname === 'localhost.localdomain' ||
      isPrivateIpv4 ||
      isPrivateIpv6)
  ) {
    throw new AiConfigurationError(
      'Endpoint URL cannot target a private network address.'
    );
  }

  return url.toString().replace(/\/$/, '');
}

function providerEnvironmentKey(provider: AiProvider): string | undefined {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'gemini':
      return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case 'openai-compatible':
      return process.env.OPENAI_COMPATIBLE_API_KEY;
  }
}

export function parseAiProviderConfig(
  value: unknown,
  fallback: AiProviderConfig
): AiProviderConfig {
  if (value == null) return fallback;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AiConfigurationError('AI settings must be an object.');
  }

  const input = value as Record<string, unknown>;
  if (
    typeof input.provider !== 'string' ||
    !(input.provider in SUPPORTED_PROVIDERS)
  ) {
    throw new AiConfigurationError('Select a supported AI provider.');
  }
  if (typeof input.model !== 'string' || !input.model.trim()) {
    throw new AiConfigurationError('Model name is required.');
  }
  if (input.model.length > 200 || /[\u0000-\u001f]/.test(input.model)) {
    throw new AiConfigurationError('Model name is invalid.');
  }
  if (
    input.apiKey != null &&
    (typeof input.apiKey !== 'string' || input.apiKey.length > 4096)
  ) {
    throw new AiConfigurationError('API key is invalid.');
  }
  if (
    input.baseURL != null &&
    (typeof input.baseURL !== 'string' || input.baseURL.length > 2048)
  ) {
    throw new AiConfigurationError('Endpoint URL is invalid.');
  }
  if (
    input.credentialMode != null &&
    input.credentialMode !== 'managed' &&
    input.credentialMode !== 'byok'
  ) {
    throw new AiConfigurationError('Credential mode is invalid.');
  }

  const provider = input.provider as AiProvider;
  const baseURL = normalizeBaseURL(
    typeof input.baseURL === 'string' ? input.baseURL.trim() : undefined
  );
  if (provider === 'openai-compatible' && !baseURL) {
    throw new AiConfigurationError(
      'Endpoint URL is required for OpenAI-Compatible providers.'
    );
  }

  return {
    provider,
    model: input.model.trim(),
    apiKey:
      typeof input.apiKey === 'string' && input.apiKey.trim()
        ? input.apiKey.trim()
        : undefined,
    baseURL,
    credentialMode:
      input.credentialMode === 'managed' || input.credentialMode === 'byok'
        ? input.credentialMode
        : undefined,
  };
}

export function createAiModel(config: AiProviderConfig) {
  const credentialMode =
    config.credentialMode ?? (config.apiKey ? 'byok' : 'managed');
  const apiKey =
    credentialMode === 'byok'
      ? config.apiKey
      : (config.apiKey ?? providerEnvironmentKey(config.provider));
  if (!apiKey) {
    const providerName =
      config.provider === 'gemini' ? 'Gemini' : config.provider;
    throw new AiConfigurationError(
      credentialMode === 'byok'
        ? `Add your ${providerName} API key in AI Settings.`
        : `No API key is available for ${providerName}. Add your own key in AI Settings.`,
      credentialMode === 'byok' ? 400 : 503
    );
  }

  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL: config.baseURL })(config.model);
    case 'openai':
      return createOpenAI({ apiKey, baseURL: config.baseURL })(config.model);
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey, baseURL: config.baseURL })(
        config.model
      );
    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'custom',
        apiKey,
        baseURL: config.baseURL!,
      })(config.model);
  }
}

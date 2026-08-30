import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiConfigurationError,
  createAiModel,
  parseAiProviderConfig,
} from '@/lib/ai/provider';

const fallback = {
  provider: 'anthropic' as const,
  model: 'claude-haiku-4-5-20251001',
};

describe('AI provider configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('preserves managed defaults when a client sends no settings', () => {
    expect(parseAiProviderConfig(undefined, fallback)).toEqual(fallback);
  });

  it('accepts and normalizes a BYOK OpenAI-compatible endpoint', () => {
    expect(
      parseAiProviderConfig(
        {
          provider: 'openai-compatible',
          model: 'custom-chat-model',
          apiKey: '  secret-key  ',
          baseURL: 'https://models.example.com/v1/',
        },
        fallback
      )
    ).toEqual({
      provider: 'openai-compatible',
      model: 'custom-chat-model',
      apiKey: 'secret-key',
      baseURL: 'https://models.example.com/v1',
    });
  });

  it('requires a custom endpoint for OpenAI-compatible providers', () => {
    expect(() =>
      parseAiProviderConfig(
        { provider: 'openai-compatible', model: 'custom-chat-model' },
        fallback
      )
    ).toThrowError('Endpoint URL is required for OpenAI-Compatible providers.');
  });

  it('does not fall back to managed credentials in BYOK mode', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'managed-key');

    expect(() =>
      createAiModel({
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        credentialMode: 'byok',
      })
    ).toThrowError('Add your anthropic API key in AI Settings.');
  });

  it('rejects insecure and private production endpoints', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(() =>
      parseAiProviderConfig(
        {
          provider: 'openai',
          model: 'gpt-5-mini',
          baseURL: 'http://models.example.com/v1',
        },
        fallback
      )
    ).toThrowError(AiConfigurationError);

    expect(() =>
      parseAiProviderConfig(
        {
          provider: 'openai-compatible',
          model: 'local-model',
          baseURL: 'https://127.0.0.1/v1',
        },
        fallback
      )
    ).toThrowError('Endpoint URL cannot target a private network address.');
  });
});

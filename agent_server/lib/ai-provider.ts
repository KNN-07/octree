import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'openai-compatible';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseURL?: string;
  model: string;
}

export function getAIModel(config: AIProviderConfig) {
  if (config.provider === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    return anthropic(config.model);
  }

  if (config.provider === 'openai') {
    const openai = createOpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });
    return openai(config.model);
  }

  if (config.provider === 'gemini') {
    const google = createGoogleGenerativeAI({
      apiKey: config.apiKey || process.env.GEMINI_API_KEY,
    });
    return google(config.model);
  }

  if (config.provider === 'openai-compatible') {
    const openaiCompatible = createOpenAI({
      apiKey: config.apiKey || 'not-needed',
      baseURL: config.baseURL,
    });
    return openaiCompatible(config.model);
  }

  throw new Error(`Unsupported AI provider: ${config.provider}`);
}

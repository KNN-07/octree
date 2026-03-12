import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { AIProviderConfig, DEFAULT_AI_SETTINGS, AITaskSettings } from '@/types/ai-settings';

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

export async function getUserAISettings(supabase: any, userId: string): Promise<AITaskSettings> {
  try {
    const { data, error } = await supabase.from('user_usage')
      .select('ai_settings')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching AI settings:', error);
      return DEFAULT_AI_SETTINGS;
    }

    if (data && data.ai_settings) {
      return { ...DEFAULT_AI_SETTINGS, ...(data.ai_settings as any) };
    }
  } catch (error) {
    console.error('Failed to get user AI settings:', error);
  }
  return DEFAULT_AI_SETTINGS;
}

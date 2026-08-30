'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_MODELS,
  type AiProvider,
  type AiProviderConfig,
  type AiSettingsByTask,
  type AiTask,
  type AiTaskSettings,
} from '@/types/ai-settings';

interface AiSettingsState {
  tasks: AiSettingsByTask;
  updateTask: (task: AiTask, updates: Partial<AiTaskSettings>) => void;
  setProvider: (task: AiTask, provider: AiProvider) => void;
  resetTask: (task: AiTask) => void;
  resetAll: () => void;
}

export const useAiSettings = create<AiSettingsState>()(
  persist(
    (set) => ({
      tasks: DEFAULT_AI_SETTINGS,
      updateTask: (task, updates) =>
        set((state) => ({
          tasks: {
            ...state.tasks,
            [task]: { ...state.tasks[task], ...updates },
          },
        })),
      setProvider: (task, provider) =>
        set((state) => ({
          tasks: {
            ...state.tasks,
            [task]: {
              ...state.tasks[task],
              provider,
              model: DEFAULT_MODELS[task][provider],
              apiKey: undefined,
              baseURL: undefined,
              credentialMode:
                provider === 'openai-compatible'
                  ? 'byok'
                  : state.tasks[task].credentialMode,
            },
          },
        })),
      resetTask: (task) =>
        set((state) => ({
          tasks: { ...state.tasks, [task]: DEFAULT_AI_SETTINGS[task] },
        })),
      resetAll: () => set({ tasks: DEFAULT_AI_SETTINGS }),
    }),
    {
      name: 'octree-ai-settings',
      version: 1,
      merge: (persisted, current) => {
        const saved = persisted as Partial<AiSettingsState>;
        return {
          ...current,
          ...saved,
          tasks: {
            ...DEFAULT_AI_SETTINGS,
            ...(saved.tasks ?? {}),
          },
        };
      },
    }
  )
);

export function getAiRequestConfig(task: AiTask): AiProviderConfig {
  const settings = useAiSettings.getState().tasks[task];
  const config: AiProviderConfig = {
    provider: settings.provider,
    model: settings.model.trim(),
    credentialMode: settings.credentialMode,
  };

  const baseURL = settings.baseURL?.trim();
  if (baseURL) config.baseURL = baseURL;

  if (settings.credentialMode === 'byok') {
    const apiKey = settings.apiKey?.trim();
    if (apiKey) config.apiKey = apiKey;
  }

  return config;
}

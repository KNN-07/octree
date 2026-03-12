import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AITaskSettings, DEFAULT_AI_SETTINGS, AIProviderConfig } from '@/types/ai-settings';
import { createClient } from '@/lib/supabase/client';

interface AISettingsState {
  settings: AITaskSettings;
  isLoaded: boolean;
  setSettings: (newSettings: Partial<AITaskSettings>) => void;
  updateTaskSetting: (task: keyof AITaskSettings, config: Partial<AIProviderConfig>) => void;
  loadFromDb: () => Promise<void>;
}

export const useAISettings = create<AISettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_AI_SETTINGS,
      isLoaded: false,

      setSettings: (newSettings) => {
        const merged = { ...get().settings, ...newSettings };
        set({ settings: merged });

        // Sync to DB in background
        (async () => {
          try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await (supabase.from('user_usage') as any)
                .update({ ai_settings: merged as any })
                .eq('user_id', user.id);
            }
          } catch (err) {
            console.error('Failed to sync AI settings to DB', err);
          }
        })();
      },

      updateTaskSetting: (task, config) => {
        const currentTaskSetting = get().settings[task];
        const updatedTaskSetting = { ...currentTaskSetting, ...config } as AIProviderConfig;

        const newSettings = {
          ...get().settings,
          [task]: updatedTaskSetting
        };

        get().setSettings(newSettings);
      },

      loadFromDb: async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data } = await (supabase.from('user_usage') as any)
              .select('ai_settings')
              .eq('user_id', user.id)
              .single();

            if (data?.ai_settings) {
              set({ settings: { ...DEFAULT_AI_SETTINGS, ...(data.ai_settings as any) }, isLoaded: true });
              return;
            }
          }
        } catch (err) {
          console.error('Failed to load AI settings from DB', err);
        }
        set({ isLoaded: true });
      }
    }),
    {
      name: 'ai-settings',
    }
  )
);

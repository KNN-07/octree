'use client';

import { useEffect, useState } from 'react';
import { useAISettings } from '@/stores/ai-config';
import { AITaskSettings, AIProvider } from '@/types/ai-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const TASKS: { key: keyof AITaskSettings; label: string; desc: string }[] = [
  { key: 'agent', label: 'Agent Chat & Edits', desc: 'Used when chatting with the AI or applying intelligent edits.' },
  { key: 'document', label: 'Document Generation', desc: 'Used for creating new LaTeX documents from prompts.' },
  { key: 'summary', label: 'Conversation Summary', desc: 'Used internally to summarize chat history context.' },
  { key: 'image', label: 'Image to LaTeX', desc: 'Used when uploading images to convert them to LaTeX.' },
];

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
];

const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-6', 'claude-sonnet-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  'openai-compatible': [],
};

export function AISettingsForm() {
  const { settings, updateTaskSetting, loadFromDb } = useAISettings();
  const [fetchingModels, setFetchingModels] = useState<Partial<Record<keyof AITaskSettings, boolean>>>({});
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const handleFetchModels = async (task: keyof AITaskSettings) => {
    const config = settings[task];
    if (!config.baseURL && config.provider === 'openai-compatible') {
      alert('Please set a Base URL to fetch models.');
      return;
    }

    setFetchingModels(prev => ({ ...prev, [task]: true }));
    try {
      let endpoint = config.provider === 'openai-compatible' ? `${config.baseURL}/models` : 'https://api.openai.com/v1/models';
      // Normalize base URL if it ends with /v1
      if (config.provider === 'openai-compatible' && config.baseURL && !config.baseURL.endsWith('/v1')) {
          if (config.baseURL.endsWith('/')) {
             endpoint = `${config.baseURL}v1/models`;
          } else {
             endpoint = `${config.baseURL}/v1/models`;
          }
      }

      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${config.apiKey || ''}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      const modelIds = data.data?.map((m: any) => m.id) || [];

      const cacheKey = `${config.provider}-${config.baseURL}-${config.apiKey}`;
      setFetchedModels(prev => ({ ...prev, [cacheKey]: modelIds }));

      if (modelIds.length > 0 && !modelIds.includes(config.model)) {
        updateTaskSetting(task, { model: modelIds[0] });
      }
    } catch (err) {
      alert('Error fetching models. Check your API key and base URL.');
      console.error(err);
    } finally {
      setFetchingModels(prev => ({ ...prev, [task]: false }));
    }
  };

  return (
    <div className="space-y-10">
      {TASKS.map((taskInfo) => {
        const config = settings[taskInfo.key];
        const cacheKey = `${config.provider}-${config.baseURL}-${config.apiKey}`;
        const availableModels = fetchedModels[cacheKey] || DEFAULT_MODELS[config.provider] || [];
        const showFetchButton = config.provider === 'openai' || config.provider === 'openai-compatible';

        return (
          <div key={taskInfo.key} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">{taskInfo.label}</h3>
              <p className="text-sm text-neutral-500">{taskInfo.desc}</p>
            </div>

            <div className="grid gap-4 rounded-xl border border-neutral-200 p-5 bg-neutral-50/50">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-neutral-700">Provider</label>
                <Select
                  value={config.provider}
                  onValueChange={(val: AIProvider) => updateTaskSetting(taskInfo.key, { provider: val, model: DEFAULT_MODELS[val]?.[0] || '' })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.provider === 'openai-compatible' && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-neutral-700">Base URL</label>
                  <Input
                    placeholder="https://api.your-provider.com/v1"
                    value={config.baseURL || ''}
                    onChange={(e) => updateTaskSetting(taskInfo.key, { baseURL: e.target.value })}
                    className="bg-white"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium text-neutral-700">
                  API Key (Optional override)
                </label>
                <Input
                  type="password"
                  placeholder="Leave empty to use server default"
                  value={config.apiKey || ''}
                  onChange={(e) => updateTaskSetting(taskInfo.key, { apiKey: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700">Model</label>
                  {showFetchButton && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFetchModels(taskInfo.key)}
                      disabled={fetchingModels[taskInfo.key]}
                      className="h-7 text-xs"
                    >
                      {fetchingModels[taskInfo.key] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Fetch Models
                    </Button>
                  )}
                </div>

                {availableModels.length > 0 ? (
                  <Select
                    value={config.model}
                    onValueChange={(val) => updateTaskSetting(taskInfo.key, { model: val })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Enter model name (e.g. gpt-4)"
                    value={config.model || ''}
                    onChange={(e) => updateTaskSetting(taskInfo.key, { model: e.target.value })}
                    className="bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

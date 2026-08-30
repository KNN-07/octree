'use client';

import { useState } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAiSettings } from '@/stores/ai-settings';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiProvider,
  type AiTask,
} from '@/types/ai-settings';

interface AiTaskSettingsPanelProps {
  task: AiTask;
  title: string;
  description: string;
}

const ENDPOINT_PLACEHOLDERS: Record<AiProvider, string> = {
  anthropic: 'https://api.anthropic.com/v1',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  'openai-compatible': 'https://api.example.com/v1',
};

export function AiTaskSettingsPanel({
  task,
  title,
  description,
}: AiTaskSettingsPanelProps) {
  const [showKey, setShowKey] = useState(false);
  const settings = useAiSettings((state) => state.tasks[task]);
  const updateTask = useAiSettings((state) => state.updateTask);
  const setProvider = useAiSettings((state) => state.setProvider);
  const resetTask = useAiSettings((state) => state.resetTask);

  const usesOwnKey = settings.credentialMode === 'byok';
  const requiresEndpoint = settings.provider === 'openai-compatible';
  const modelId = `${task}-model`;
  const endpointId = `${task}-endpoint`;
  const apiKeyId = `${task}-api-key`;

  return (
    <section
      className="py-7 first:pt-0 last:pb-0"
      aria-labelledby={`${task}-title`}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="max-w-xl">
          <h2
            id={`${task}-title`}
            className="text-base font-semibold text-neutral-900"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            {description}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-neutral-500 hover:text-neutral-900"
          onClick={() => resetTask(task)}
        >
          <RotateCcw aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${task}-provider`}>Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(value) => setProvider(task, value as AiProvider)}
          >
            <SelectTrigger id={`${task}-provider`} className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {AI_PROVIDER_LABELS[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={modelId}>Model</Label>
          <Input
            id={modelId}
            value={settings.model}
            onChange={(event) =>
              updateTask(task, { model: event.target.value })
            }
            placeholder="Enter a model ID"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!settings.model.trim()}
          />
          {!settings.model.trim() && (
            <p className="text-xs text-red-600">
              Enter the model ID exposed by this provider.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between gap-5 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <div>
            <Label
              htmlFor={`${task}-byok`}
              className="text-sm text-neutral-900"
            >
              Bring your own API key
            </Label>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">
              {requiresEndpoint
                ? 'Required for OpenAI-Compatible endpoints.'
                : 'Otherwise Octree uses its managed provider credentials when available.'}
            </p>
          </div>
          <Switch
            id={`${task}-byok`}
            checked={usesOwnKey}
            disabled={requiresEndpoint}
            onCheckedChange={(checked) =>
              updateTask(task, { credentialMode: checked ? 'byok' : 'managed' })
            }
            aria-label={`Bring your own API key for ${title}`}
          />
        </div>

        {usesOwnKey && (
          <div className="space-y-2 pt-3">
            <Label htmlFor={apiKeyId}>API key</Label>
            <div className="relative">
              <Input
                id={apiKeyId}
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey ?? ''}
                onChange={(event) =>
                  updateTask(task, { apiKey: event.target.value })
                }
                placeholder="Paste your provider API key"
                className="pr-10"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!settings.apiKey?.trim()}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900"
                onClick={() => setShowKey((visible) => !visible)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>
            {!settings.apiKey?.trim() && (
              <p className="text-xs text-red-600">
                Add an API key before using this task.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor={endpointId}>Custom endpoint URL</Label>
          <span className="text-xs text-neutral-400">
            {requiresEndpoint ? 'Required' : 'Optional'}
          </span>
        </div>
        <Input
          id={endpointId}
          type="url"
          value={settings.baseURL ?? ''}
          onChange={(event) =>
            updateTask(task, { baseURL: event.target.value })
          }
          placeholder={ENDPOINT_PLACEHOLDERS[settings.provider]}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={requiresEndpoint && !settings.baseURL?.trim()}
        />
        <p className="text-xs leading-5 text-neutral-500">
          Leave blank to use the provider default. Production endpoints must use
          HTTPS.
        </p>
        {requiresEndpoint && !settings.baseURL?.trim() && (
          <p className="text-xs text-red-600">
            Add the API base URL for this provider.
          </p>
        )}
      </div>
    </section>
  );
}

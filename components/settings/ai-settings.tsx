'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import { AiTaskSettingsPanel } from '@/components/settings/ai-task-settings-panel';
import type { AiTask } from '@/types/ai-settings';

interface TaskDetails {
  task: AiTask;
  title: string;
  description: string;
}

const TASKS: TaskDetails[] = [
  {
    task: 'editor-assistant',
    title: 'Editor assistant',
    description:
      'Handles chat requests, project-aware edits, and tool calls in the LaTeX editor.',
  },
  {
    task: 'document-generation',
    title: 'Document generation',
    description:
      'Creates and revises complete documents from prompts and attached reference files.',
  },
  {
    task: 'image-analysis',
    title: 'Image analysis',
    description:
      'Reads uploaded figures, handwriting, and mathematical expressions before an edit.',
  },
  {
    task: 'conversation-summary',
    title: 'Conversation summaries',
    description:
      'Compresses editing history so longer sessions retain relevant decisions and context.',
  },
];

export function AiSettings() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          AI Settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
          Choose a provider and model for each AI task. Changes save
          automatically to this browser.
        </p>
      </div>

      <div className="mb-9 flex gap-3 border-y border-neutral-200 py-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="max-w-xl">
          <p className="text-sm font-medium text-neutral-900">
            Your keys stay in this browser
          </p>
          <p className="mt-0.5 text-xs leading-5 text-neutral-500">
            BYOK credentials are stored locally and sent only with the AI
            request that needs them. They are never written to your Octree
            account.
          </p>
        </div>
      </div>

      <div className="divide-y divide-neutral-200">
        {TASKS.map((task) => (
          <AiTaskSettingsPanel key={task.task} {...task} />
        ))}
      </div>

      <div className="mt-10 flex items-start gap-2.5 border-t border-neutral-200 pt-5 text-xs leading-5 text-neutral-500">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600"
          aria-hidden="true"
        />
        <p>
          Custom endpoints receive the prompt and task context directly. Use an
          endpoint you trust; private-network URLs are blocked in production.
        </p>
      </div>
    </div>
  );
}

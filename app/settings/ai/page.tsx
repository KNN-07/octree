import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AISettingsForm } from '@/components/settings/ai-settings-form';

export default async function AISettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div>
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
          AI Settings
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Configure multiple AI providers and models for different tasks.
        </p>
      </div>

      <AISettingsForm />
    </div>
  );
}

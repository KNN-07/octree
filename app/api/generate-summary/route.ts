import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ConversationSummary } from '@/types/conversation';
import {
  AiConfigurationError,
  createAiModel,
  parseAiProviderConfig,
} from '@/lib/ai/provider';

export const runtime = 'nodejs';

const SUMMARY_PROMPT = `You are a concise summarizer. Given a conversation about a LaTeX document, produce a JSON summary.

Output ONLY valid JSON matching this schema:
{
  "original_intent": "What the user originally wanted to create",
  "modifications_made": ["List of changes made so far"],
  "current_state": "Brief description of the document's current state",
  "interaction_count": <number>
}

Keep total summary under 500 words. Be factual and concise.`;

interface SummaryRequest {
  documentId: string;
  currentSummary: ConversationSummary | null;
  lastExchanges: Array<{ userPrompt: string; assistantResponse: string }>;
  interactionCount: number;
  aiSettings?: unknown;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SummaryRequest = await request.json();
    const { documentId, currentSummary, lastExchanges, interactionCount } =
      body;

    const aiConfig = parseAiProviderConfig(body.aiSettings, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      );
    }

    const exchangesText = lastExchanges
      .map(
        (e, i) =>
          `Exchange ${i + 1}:\nUser: ${e.userPrompt}\nAssistant: ${e.assistantResponse}`
      )
      .join('\n\n');

    const prompt = currentSummary
      ? `Previous summary:\n${JSON.stringify(currentSummary, null, 2)}\n\nNew exchanges to incorporate:\n${exchangesText}\n\nUpdate the summary to include these new interactions. Set interaction_count to ${interactionCount}.`
      : `First exchange:\n${exchangesText}\n\nCreate an initial summary. Set interaction_count to ${interactionCount}.`;

    const { text: content } = await generateText({
      model: createAiModel(aiConfig),
      system: SUMMARY_PROMPT,
      prompt,
      maxOutputTokens: 1024,
    });

    let summary: ConversationSummary;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      summary = JSON.parse(jsonMatch[0]);
    } catch {
      if (currentSummary) {
        summary = {
          ...currentSummary,
          modifications_made: [
            ...currentSummary.modifications_made,
            lastExchanges.map((e) => e.userPrompt.slice(0, 100)).join('; '),
          ],
          interaction_count: interactionCount,
        };
      } else {
        summary = {
          original_intent:
            lastExchanges[0]?.userPrompt.slice(0, 200) || 'Document creation',
          modifications_made: [],
          current_state: 'Initial document created',
          interaction_count: interactionCount,
        };
      }
    }

    const { error: updateError } = await (
      supabase.from('generated_documents') as ReturnType<typeof supabase.from>
    )
      .update({ conversation_summary: summary })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to save summary:', updateError);
      return NextResponse.json(
        { error: 'Failed to save summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Summary endpoint error:', error);
    const status = error instanceof AiConfigurationError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      { error: status === 500 ? 'Internal error' : message },
      { status }
    );
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ConversationSummary } from '@/types/conversation';
import { getUserAISettings, getAIModel } from '@/lib/ai-provider';
import { generateText, LanguageModel } from 'ai';

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
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiSettings = await getUserAISettings(supabase, user.id);
    const modelInfo = aiSettings.summary;

    const body: SummaryRequest = await request.json();
    const { documentId, currentSummary, lastExchanges, interactionCount } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const exchangesText = lastExchanges
      .map((e, i) => `Exchange ${i + 1}:\nUser: ${e.userPrompt}\nAssistant: ${e.assistantResponse}`)
      .join('\n\n');

    const prompt = currentSummary
      ? `Previous summary:\n${JSON.stringify(currentSummary, null, 2)}\n\nNew exchanges to incorporate:\n${exchangesText}\n\nUpdate the summary to include these new interactions. Set interaction_count to ${interactionCount}.`
      : `First exchange:\n${exchangesText}\n\nCreate an initial summary. Set interaction_count to ${interactionCount}.`;

    let summary: ConversationSummary;

    try {
      const aiModel = getAIModel(modelInfo) as LanguageModel;
      const { text } = await generateText({
        model: aiModel,
        system: SUMMARY_PROMPT,
        prompt: prompt,
        maxTokens: 1024,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      summary = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('Summary generation failed with AI:', err);
      if (currentSummary) {
        summary = {
          ...currentSummary,
          modifications_made: [
            ...currentSummary.modifications_made,
            lastExchanges.map(e => e.userPrompt.slice(0, 100)).join('; '),
          ],
          interaction_count: interactionCount,
        };
      } else {
        summary = {
          original_intent: lastExchanges[0]?.userPrompt.slice(0, 200) || 'Document creation',
          modifications_made: [],
          current_state: 'Initial document created',
          interaction_count: interactionCount,
        };
      }
    }

    const { error: updateError } = await (supabase.from('generated_documents') as ReturnType<typeof supabase.from>)
      .update({ conversation_summary: summary })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to save summary:', updateError);
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Summary endpoint error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

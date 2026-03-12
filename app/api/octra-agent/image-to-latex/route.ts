import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAISettings, getAIModel } from '@/lib/ai-provider';
import { streamText, LanguageModel } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { image, fileName } = await request.json();

    if (!image) {
      return new Response('Image is required', { status: 400 });
    }

    const aiSettings = await getUserAISettings(supabase, user.id);
    const modelInfo = aiSettings.image;

    const aiModel = getAIModel(modelInfo) as LanguageModel;

    const result = streamText({
      model: aiModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Describe everything you see in this image. If there are mathematical expressions, equations, or formulas, transcribe them clearly. If it's handwritten, convert to readable text. Be concise but accurate.

Image: ${fileName || 'image'}`,
            },
            {
              type: 'image',
              image: image,
            },
          ],
        },
      ],
      maxTokens: 2000,
    });

    return result.toDataStreamResponse({
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
        }
    });
  } catch (error) {
    console.error('Image to LaTeX conversion error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

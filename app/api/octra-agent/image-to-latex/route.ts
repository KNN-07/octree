import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import {
  AiConfigurationError,
  createAiModel,
  parseAiProviderConfig,
} from '@/lib/ai/provider';
import { createClient } from '@/lib/supabase/server';

const MAX_IMAGE_DATA_LENGTH = 7 * 1024 * 1024;
const IMAGE_DATA_URL =
  /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;

interface ImageAnalysisRequest {
  image?: unknown;
  fileName?: unknown;
  aiSettings?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = (await request.json()) as ImageAnalysisRequest;
    if (typeof body.image !== 'string') {
      return new Response('Image is required', { status: 400 });
    }
    if (body.image.length > MAX_IMAGE_DATA_LENGTH) {
      return new Response('Image is too large', { status: 413 });
    }

    const imageMatch = body.image.match(IMAGE_DATA_URL);
    if (!imageMatch) {
      return new Response('Image must be a supported base64 data URL', {
        status: 400,
      });
    }

    const aiConfig = parseAiProviderConfig(body.aiSettings, {
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    const fileName =
      typeof body.fileName === 'string'
        ? body.fileName.replace(/[\r\n]/g, ' ').slice(0, 200)
        : 'image';

    const result = streamText({
      model: createAiModel(aiConfig),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Describe everything you see in this image. If there are mathematical expressions, equations, or formulas, transcribe them clearly. If it is handwritten, convert it to readable text. Be concise but accurate.\n\nImage: ${fileName}`,
            },
            {
              type: 'image',
              image: imageMatch[2],
              mediaType: imageMatch[1],
            },
          ],
        },
      ],
      maxOutputTokens: 2000,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of result.textStream) {
            controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    const status = error instanceof AiConfigurationError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return new Response(status === 500 ? 'Internal server error' : message, {
      status,
    });
  }
}

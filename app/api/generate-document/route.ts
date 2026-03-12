import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSSEHeaders } from '@/agent_server/lib/stream-handling';
import type { ConversationSummary } from '@/types/conversation';
import { getUserAISettings, getAIModel } from '@/lib/ai-provider';
import { streamText, LanguageModel } from 'ai';

export const runtime = 'nodejs';

// ... (PROMPT content kept out of brevity)
const DOCUMENT_GENERATION_PROMPT = `You are an expert LaTeX document generator. Your task is to output ONLY valid, compile-ready LaTeX code based on the user's request.

STRICT COMPILATION CONSTRAINTS (MUST FOLLOW):
1. **Engine**: pdflatex only. No XeTeX/LuaTeX specific packages (e.g., fontspec, polyglossia).
2. **Fonts**: Standard Type 1 fonts only (e.g., lmodern, mathptmx, helvet, courier). Do NOT use system fonts.
3. **Packages**: Only use standard, widely available packages (amsmath, amssymb, graphicx, geometry, hyperref, xcolor, fancyhdr, enumitem, booktabs, caption, listings).
4. **Encoding**: Use \\usepackage[utf8]{inputenc} and \\usepackage[T1]{fontenc}.
5. **Output**: A complete, compilable document from \\documentclass to \\end{document}.
6. **Format**: Output ONLY the raw LaTeX code. NO markdown formatting, NO code fences, NO explanations before/after.

For research papers: include abstract, sections, subsections, and a bibliography section.
For other documents: use appropriate structure.`;

const CONTINUATION_PROMPT = `You are an expert LaTeX document editor. You will receive an existing LaTeX document along with context about previous modifications, and a new user request.

Your task is to modify the existing document according to the user's new request while maintaining:
1. Document consistency and style
2. All existing content unless explicitly asked to remove it
3. Valid pdflatex-compatible LaTeX

STRICT COMPILATION CONSTRAINTS (MUST FOLLOW):
1. **Engine**: pdflatex only. No XeTeX/LuaTeX packages.
2. **Fonts**: Standard Type 1 fonts only (lmodern, mathptmx, helvet, courier).
3. **Packages**: Use standard packages (amsmath, amssymb, graphicx, geometry, hyperref, xcolor, fancyhdr, enumitem, booktabs, caption, listings).
4. **Output**: Complete, compilable document from \\documentclass to \\end{document}.
5. **Format**: Output ONLY valid LaTeX code. NO markdown, NO code fences, NO explanations.`;

interface FileData {
  mimeType: string;
  data: string;
  name: string;
}

interface GenerateRequest {
  prompt: string;
  documentType?: 'research' | 'article' | 'report' | 'letter' | 'general';
  files?: FileData[];
  documentId?: string;
  currentLatex?: string;
  conversationSummary?: ConversationSummary | null;
  lastUserPrompt?: string | null;
  lastAssistantResponse?: string | null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const aiSettings = await getUserAISettings(supabase, user.id);
    const modelInfo = aiSettings.document;

    const body: GenerateRequest = await request.json();
    const {
      prompt,
      documentType = 'general',
      files,
      documentId,
      currentLatex,
      conversationSummary,
      lastUserPrompt,
      lastAssistantResponse,
    } = body;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const isContinuation = !!(documentId && currentLatex);
    const sessionId = documentId || crypto.randomUUID();

    let systemPrompt: string;
    let userContent: string;

    if (isContinuation) {
      systemPrompt = CONTINUATION_PROMPT;

      const contextParts: string[] = [];
      contextParts.push(`CURRENT DOCUMENT:\n\`\`\`latex\n${currentLatex}\n\`\`\``);

      if (conversationSummary) {
        contextParts.push(`\nCONVERSATION CONTEXT:\n- Original intent: ${conversationSummary.original_intent}\n- Modifications made: ${conversationSummary.modifications_made.join(', ') || 'None yet'}\n- Current state: ${conversationSummary.current_state}`);
      }

      if (lastUserPrompt && lastAssistantResponse) {
        contextParts.push(`\nLAST EXCHANGE:\nUser asked: ${lastUserPrompt}\nResult: Document was updated accordingly.`);
      }

      contextParts.push(`\nNEW REQUEST:\n${prompt}`);
      userContent = contextParts.join('\n');
    } else {
      systemPrompt = DOCUMENT_GENERATION_PROMPT;

      const documentTypeHint =
        documentType === 'research'
          ? 'This should be a formal research paper with abstract, introduction, methodology, results, discussion, and conclusion sections.'
          : documentType === 'article'
            ? 'This should be a well-structured article with clear sections.'
            : documentType === 'report'
              ? 'This should be a formal report with executive summary and detailed sections.'
              : documentType === 'letter'
                ? 'This should be a formal letter with appropriate formatting.'
                : '';

      userContent = `${prompt}\n\n${documentTypeHint}`.trim();
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (event: string, data: unknown) => {
          const payload = JSON.stringify(data);
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${payload}\n\n`)
          );
        };

        try {
          write('session', { id: sessionId });
          write('status', {
            phase: 'generating',
            message: 'Starting document generation...',
          });

          const messageContent: any[] = [];

          if (files && files.length > 0) {
            for (const file of files) {
              if (file.mimeType.startsWith('image/')) {
                messageContent.push({
                  type: 'image',
                  image: `data:${file.mimeType};base64,${file.data}`,
                });
              } else if (file.mimeType === 'application/pdf') {
                messageContent.push({
                  type: 'file',
                  data: file.data,
                  mimeType: file.mimeType,
                });
              }
            }
          }

          messageContent.push({ type: 'text', text: userContent });

          const aiModel = getAIModel(modelInfo) as LanguageModel;

          const result = streamText({
            model: aiModel,
            system: systemPrompt,
            messages: [{ role: 'user', content: messageContent }],
            maxTokens: 8192,
          });

          let chunkBuffer = '';
          let accumulatedContent = '';
          const CHUNK_SIZE = 100;

          for await (const chunk of result.textStream) {
            accumulatedContent += chunk;
            chunkBuffer += chunk;

            if (chunkBuffer.length >= CHUNK_SIZE) {
              write('content', { text: chunkBuffer, partial: true });
              chunkBuffer = '';
            }
          }

          if (chunkBuffer.length > 0) {
            write('content', { text: chunkBuffer, partial: true });
          }

          write('status', { phase: 'finalizing', message: 'Finalizing document...' });

          const latex = extractLatex(accumulatedContent);

          if (!latex) {
            write('error', {
              message: 'Failed to generate valid LaTeX document',
            });
            controller.close();
            return;
          }

          let title = extractTitle(latex);
          
          if (!title) {
            const cleanPrompt = prompt.replace(/\s+/g, ' ').trim();
            title = cleanPrompt.length > 50 
              ? cleanPrompt.slice(0, 50) + '...' 
              : cleanPrompt;
              
            if (!title) title = 'Untitled Document';
          }

          write('complete', {
            latex,
            title,
            sessionId,
            isContinuation,
          });

          controller.close();
        } catch (err) {
          console.error(err);
          const message =
            err instanceof Error ? err.message : 'Generation failed';
          write('error', { message });
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: createSSEHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process request', details: message },
      { status: 500 }
    );
  }
}

function extractLatex(content: string): string | null {
  const trimmed = content.trim();

  const fenceMatch = trimmed.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const extracted = fenceMatch[1].trim();
    if (
      extracted.includes('\\documentclass') &&
      extracted.includes('\\end{document}')
    ) {
      return extracted;
    }
  }

  if (
    trimmed.includes('\\documentclass') &&
    trimmed.includes('\\end{document}')
  ) {
    const start = trimmed.indexOf('\\documentclass');
    const end = trimmed.lastIndexOf('\\end{document}') + '\\end{document}'.length;
    return trimmed.slice(start, end);
  }

  return null;
}

function extractTitle(latex: string): string | null {
  const titleMatch = latex.match(/\\title\{([^}]+)\}/);
  if (titleMatch) {
    return titleMatch[1].replace(/\\\\/g, ' ').trim();
  }
  return null;
}

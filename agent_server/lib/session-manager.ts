import { generateText } from 'ai';
import { getAIModel, AIProviderConfig } from './ai-provider.js';

export interface ChatSession {
  id: string;
  summary: string;
  lastInteraction: {
    userRequest: string;
    assistantResponse: string;
  } | null;
  lastUpdated: number;
}

const SESSION_TTL = 1000 * 60 * 60 * 24; // 24 hours

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, ChatSession>;

  private constructor() {
    this.sessions = new Map();
    setInterval(() => this.cleanupSessions(), 1000 * 60 * 60); // Clean up every hour
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public getSession(id: string): ChatSession | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastUpdated = Date.now();
    }
    return session;
  }

  public setSessionSummary(id: string, summary: string) {
    let session = this.sessions.get(id);
    if (!session) {
      session = { id, summary: '', lastInteraction: null, lastUpdated: Date.now() };
      this.sessions.set(id, session);
    }
    session.summary = summary;
    session.lastUpdated = Date.now();
  }

  public storeLastInteraction(id: string, userRequest: string, assistantResponse: string) {
    let session = this.sessions.get(id);
    if (!session) {
      session = { id, summary: '', lastInteraction: null, lastUpdated: Date.now() };
      this.sessions.set(id, session);
    }
    session.lastInteraction = { userRequest, assistantResponse };
    session.lastUpdated = Date.now();
  }

  public async generateUpdatedSummary(id: string, currentSummary: string, userRequest: string, assistantResponse: string, aiConfig?: AIProviderConfig) {
    try {
      const config = aiConfig || { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' } as AIProviderConfig;
      const aiModel = getAIModel(config);

      const { text } = await generateText({
        model: aiModel,
        system: `You are maintaining a concise summary of an ongoing LaTeX document editing session.
Your task is to update the summary with the latest interaction.
Keep the overall summary under 3 sentences. Focus on:
1. The overall goal of the document
2. What has been changed/added so far
Do NOT include details about specific formatting, minor typos, or exact tool calls.`,
        prompt: `Current summary: ${currentSummary || 'None'}\n\nLatest interaction:\nUser: ${userRequest}\nAssistant: ${assistantResponse}\n\nProvide the updated summary:`,
        maxTokens: 150,
      });

      this.setSessionSummary(id, text.trim());
    } catch (error) {
      console.error('Failed to generate session summary:', error);
    }
  }

  private cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastUpdated > SESSION_TTL) {
        this.sessions.delete(id);
      }
    }
  }
}

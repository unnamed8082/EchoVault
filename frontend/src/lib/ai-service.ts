export interface LLMProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface AIServiceConfig {
  defaultProvider: 'openai' | 'deepseek';
  fallbackProvider?: 'openai' | 'deepseek';
  openai?: Partial<LLMProviderConfig>;
  deepseek?: Partial<LLMProviderConfig>;
  proxyURL?: string;
  enableFallback?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  enableFallback?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  timestamp: number;
}

export type StreamCallback = (chunk: string, done?: boolean) => void;

interface SessionData {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  maxMessages?: number;
}

interface ContextWarning {
  isNearLimit: boolean;
  percentageUsed: number;
  remainingTokens: number;
  suggestedAction: string;
}

const DEFAULT_CONFIG = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000
  }
};

class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class AIService {
  private config: Required<AIServiceConfig> & {
    openai: LLMProviderConfig;
    deepseek: LLMProviderConfig;
  };
  private currentProvider: 'openai' | 'deepseek';
  private sessions: Map<string, SessionData> = new Map();
  private backendURL: string;

  constructor(config: AIServiceConfig) {
    this.backendURL = config.proxyURL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

    this.config = {
      defaultProvider: config.defaultProvider || 'openai',
      fallbackProvider: config.fallbackProvider || 'openai',
      proxyURL: this.backendURL,
      enableFallback: config.enableFallback || false,
      openai: {
        ...DEFAULT_CONFIG.openai,
        ...(config.openai || {})
      } as LLMProviderConfig,
      deepseek: {
        ...DEFAULT_CONFIG.deepseek,
        ...(config.deepseek || {})
      } as LLMProviderConfig
    };

    this.currentProvider = this.config.defaultProvider;
  }

  static fromEnvironment(): AIService {
    const provider = (process.env.NEXT_PUBLIC_AI_PROVIDER as 'deepseek' | 'openai') || 'deepseek';

    let storedApiKey = '';
    let storedModel = '';
    try {
      const raw = localStorage.getItem('echovault-llm-config');
      if (raw) {
        const cfg = JSON.parse(raw);
        storedApiKey = cfg.apiKey || '';
        storedModel = cfg.model || '';
      }
    } catch {}

    const providerDefaults = DEFAULT_CONFIG[provider] || DEFAULT_CONFIG.deepseek;

    return new AIService({
      defaultProvider: provider,
      fallbackProvider: (process.env.NEXT_PUBLIC_AI_FALLBACK as any) || undefined,
      proxyURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000',
      enableFallback: process.env.NEXT_PUBLIC_AI_ENABLE_FALLBACK === 'true',
      openai: {
        apiKey: provider === 'openai' ? storedApiKey : '',
        baseURL: DEFAULT_CONFIG.openai.baseURL,
        model: provider === 'openai' && storedModel ? storedModel : DEFAULT_CONFIG.openai.model
      },
      deepseek: {
        apiKey: provider === 'deepseek' ? storedApiKey : '',
        baseURL: DEFAULT_CONFIG.deepseek.baseURL,
        model: provider === 'deepseek' && storedModel ? storedModel : DEFAULT_CONFIG.deepseek.model
      }
    });
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  switchProvider(provider: 'openai' | 'deepseek'): void {
    if (!this.config[provider]?.apiKey) {
      throw new Error(`${provider} provider not configured`);
    }
    this.currentProvider = provider;
  }

  validateProviderConfig(provider: 'openai' | 'deepseek'): boolean {
    const cfg = this.config[provider];
    return !!(cfg?.apiKey && cfg?.baseURL && cfg?.model);
  }

  getConfig(): Readonly<typeof this.config> {
    return this.config;
  }

  getEnvironment(): string {
    if (typeof window !== 'undefined') return 'browser';
    if (typeof process !== 'undefined') return 'node';
    return 'unknown';
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    const provider = this.currentProvider;
    
    try {
      return await this.executeChatCompletion(provider, messages, options);
    } catch (error) {
      if (options.enableFallback !== false && this.config.enableFallback && this.config.fallbackProvider) {
        console.warn(`[${provider}] Request failed, falling back to ${this.config.fallbackProvider}`);
        try {
          const response = await this.executeChatCompletion(
            this.config.fallbackProvider,
            messages,
            options
          );
          return { ...response, provider: this.config.fallbackProvider };
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }
      throw error;
    }
  }

  private async executeChatCompletion(
    provider: 'openai' | 'deepseek',
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const cfg = this.config[provider];

    const requestBody: Record<string, unknown> = {
      provider,
      model: cfg.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
      api_key: cfg.apiKey || undefined,
    };

    if (options.topP !== undefined) {
      requestBody.top_p = options.topP;
    }
    if (options.stopSequences) {
      requestBody.stop = options.stopSequences;
    }

    let lastError: Error | null = null;
    const maxRetries = cfg.maxRetries || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), cfg.timeout);

        const response = await fetch(`${this.backendURL}/api/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 429 && attempt < maxRetries) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1000');
            await this.delay(retryAfter * Math.pow(2, attempt));
            continue;
          }

          throw new APIError(
            `API Error (${response.status}): ${errorData.detail || response.statusText}`,
            response.status,
            errorData.code
          );
        }

        const data = await response.json();
        
        return {
          id: data.id || Date.now().toString(),
          content: data.content || data.choices?.[0]?.message?.content || '',
          model: data.model || cfg.model,
          provider: data.provider || provider,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0
          },
          finishReason: data.finish_reason || data.choices?.[0]?.finish_reason || 'stop',
          timestamp: Date.now()
        };
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new APIError(`Request timeout after ${cfg.timeout}ms`, undefined, 'timeout');
        }

        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = (cfg.retryDelay || 1000) * Math.pow(2, attempt);
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  async streamChatCompletion(
    messages: ChatMessage[],
    callback: StreamCallback,
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    const cfg = this.config[this.currentProvider];

    const requestBody = {
      provider: this.currentProvider,
      model: cfg.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true
    };

    let fullContent = '';
    let responseId = '';

    try {
      const response = await fetch(`${this.backendURL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          `Stream API Error (${response.status}): ${errorData.error?.message}`,
          response.status
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              callback('', true);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              
              if (delta) {
                fullContent += delta;
                callback(delta);
              }

              if (!responseId && parsed.id) {
                responseId = parsed.id;
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      callback(fullContent, true);

      return {
        id: responseId || Date.now().toString(),
        content: fullContent,
        model: cfg.model,
        provider: this.currentProvider,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        timestamp: Date.now()
      };
    } catch (error) {
      callback('', true);
      throw error;
    }
  }

  createSession(sessionId?: string, options?: { maxMessages?: number }): string {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.sessions.set(id, {
      sessionId: id,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      maxMessages: options?.maxMessages
    });

    return id;
  }

  addMessageToSession(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();

    if (session.maxMessages && session.messages.length > session.maxMessages) {
      session.messages = session.messages.slice(-session.maxMessages);
    }
  }

  getSessionHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return [...session.messages];
  }

  clearSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
    }
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  exportSession(sessionId: string): { sessionId: string; messages: ChatMessage[] } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return {
      sessionId: session.sessionId,
      messages: [...session.messages]
    };
  }

  importSession(data: { sessionId: string; messages: ChatMessage[] }): string {
    const id = `${data.sessionId}_imported_${Date.now()}`;
    this.createSession(id);
    
    for (const msg of data.messages) {
      this.addMessageToSession(id, msg);
    }

    return id;
  }

  estimateTokens(text: string): number {
    const tokenEstimate = Math.ceil(text.length / 4);
    return Math.max(tokenEstimate, 1);
  }

  checkContextLimit(sessionId: string, contextWindow: number = 128000): ContextWarning {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const totalText = session.messages.reduce((acc, msg) => acc + msg.content.length, 0);
    const estimatedTokens = Math.ceil(totalText / 4);
    const percentageUsed = (estimatedTokens / contextWindow) * 100;
    const remainingTokens = contextWindow - estimatedTokens;

    return {
      isNearLimit: percentageUsed > 80,
      percentageUsed: Math.min(percentageUsed, 100),
      remainingTokens: Math.max(remainingTokens, 0),
      suggestedAction: percentageUsed > 90 
        ? 'Consider starting a new session or summarizing history'
        : percentageUsed > 80 
        ? 'Approaching context limit - consider truncating older messages'
        : 'Context window has sufficient space'
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof APIError) {
      return [429, 500, 502, 503, 504].includes(error.status || 0);
    }
    if (error instanceof TypeError) {
      return error.message.includes('fetch') || 
             error.message.includes('network') ||
             error.message.includes('Failed to fetch');
    }
    return false;
  }
}

export default AIService;

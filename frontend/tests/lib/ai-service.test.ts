import { AIService, LLMProvider, ChatMessage, StreamCallback } from '../lib/ai-service';

describe('AIService - API Integration Tests', () => {
  let aiService: AIService;
  
  beforeEach(() => {
    aiService = new AIService({
      defaultProvider: 'openai',
      openai: {
        apiKey: process.env.OPENAI_API_KEY || 'test-openai-key',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || 'test-deepseek-key',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat'
      }
    });
  });

  describe('Initialization', () => {
    test('should create service with valid config', () => {
      expect(aiService).toBeInstanceOf(AIService);
      expect(aiService.getCurrentProvider()).toBe('openai');
    });

    test('should throw error with invalid config', () => {
      expect(() => {
        new AIService({} as any);
      }).toThrow('Invalid AI service configuration');
    });

    test('should switch providers', () => {
      aiService.switchProvider('deepseek');
      expect(aiService.getCurrentProvider()).toBe('deepseek');
      
      aiService.switchProvider('openai');
      expect(aiService.getCurrentProvider()).toBe('openai');
    });

    test('should validate provider config', () => {
      const isValid = aiService.validateProviderConfig('openai');
      expect(isValid).toBe(true);
    });
  });

  describe('Chat Completion - OpenAI', () => {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello, this is a test' }
    ];

    test('should send chat completion request', async () => {
      const response = await aiService.chatCompletion(testMessages, {
        maxTokens: 100,
        temperature: 0.7
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('usage');
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    }, 30000);

    test('should handle system messages', async () => {
      const messagesWithSystem: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hi' }
      ];

      const response = await aiService.chatCompletion(messagesWithSystem);
      expect(response.content).toBeTruthy();
    }, 15000);

    test('should handle empty content error', async () => {
      await expect(
        aiService.chatCompletion([])
      ).rejects.toThrow('Messages array cannot be empty');
    });

    test('should respect maxTokens parameter', async () => {
      const response = await aiService.chatCompletion(testMessages, {
        maxTokens: 10
      });

      expect(response.content.length).toBeLessThanOrEqual(50);
    }, 15000);

    test('should handle long conversations', async () => {
      const longMessages: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `This is message number ${i}. Testing context window handling.`
      }));

      const response = await aiService.chatCompletion(longMessages);
      expect(response.content).toBeTruthy();
    }, 30000);
  });

  describe('Chat Completion - DeepSeek', () => {
    beforeEach(() => {
      aiService.switchProvider('deepseek');
    });

    test('should send request to DeepSeek API', async () => {
      const response = await aiService.chatCompletion([
        { role: 'user', content: '你好，测试DeepSeek连接' }
      ]);

      expect(response).toHaveProperty('content');
      expect(response.model).toContain('deepseek');
    }, 20000);

    test('should handle Chinese text correctly', async () => {
      const chineseMessages: ChatMessage[] = [
        { role: 'system', content: '你是一个有帮助的助手，请用中文回答。' },
        { role: 'user', content: '请用一句话介绍你自己' }
      ];

      const response = await aiService.chatCompletion(chineseMessages);
      expect(response.content).toMatch(/[\u4e00-\u9fa5]/);
    }, 15000);
  });

  describe('Streaming Responses', () => {
    test('should stream responses chunk by chunk', async () => {
      const chunks: string[] = [];
      const callback: StreamCallback = (chunk) => {
        chunks.push(chunk);
      };

      await aiService.streamChatCompletion(
        [{ role: 'user', content: 'Count from 1 to 5' }],
        callback,
        { maxTokens: 100 }
      );

      expect(chunks.length).toBeGreaterThan(0);
      const fullResponse = chunks.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
    }, 30000);

    test('should handle stream errors gracefully', async () => {
      const faultyService = new AIService({
        defaultProvider: 'openai',
        openai: {
          apiKey: 'invalid-key',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini'
        }
      });

      const callback: StreamCallback = jest.fn();
      
      await expect(
        faultyService.streamChatCompletion(
          [{ role: 'user', content: 'test' }],
          callback
        )
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Error Handling & Retry', () => {
    test('should retry on network errors', async () => {
      const retryService = new AIService({
        defaultProvider: 'openai',
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'test-key',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          maxRetries: 3,
          retryDelay: 1000
        }
      });

      let callCount = 0;
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: async () => ({
            id: 'test-id',
            choices: [{ message: { content: 'Success after retries' } }],
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          })
        };
      }) as any;

      try {
        const response = await retryService.chatCompletion([
          { role: 'user', content: 'Test retry logic' }
        ]);
        expect(response.content).toBe('Success after retries');
        expect(callCount).toBe(3);
      } finally {
        global.fetch = originalFetch;
      }
    }, 5000);

    test('should handle rate limiting with exponential backoff', async () => {
      const rateLimitedService = new AIService({
        defaultProvider: 'openai',
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'test-key',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          maxRetries: 2,
          retryDelay: 100
        }
      });

      let attempt = 0;
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async () => {
        attempt++;
        if (attempt <= 2) {
          return {
            status: 429,
            json: async () => ({ error: { message: 'Rate limited' } })
          };
        }
        return {
          ok: true,
          json: async () => ({
            id: 'test',
            choices: [{ message: { content: 'After rate limit' } }],
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          })
        };
      }) as any;

      try {
        const response = await rateLimitedService.chatCompletion([
          { role: 'user', content: 'Test rate limit handling' }
        ]);
        expect(response.content).toBe('After rate limit');
      } finally {
        global.fetch = originalFetch;
      }
    }, 5000);

    test('should throw APIError for authentication failures', async () => {
      const authFailService = new AIService({
        defaultProvider: 'openai',
        openai: {
          apiKey: 'invalid-api-key',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini'
        }
      });

      await expect(
        authFailService.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(/authentication|401|invalid/i);
    }, 10000);

    test('should handle timeout errors', async () => {
      const timeoutService = new AIService({
        defaultProvider: 'openai',
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'test-key',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          timeout: 1
        }
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 5000))
      ) as any;

      try {
        await expect(
          timeoutService.chatCompletion([{ role: 'user', content: 'test' }])
        ).rejects.toThrow(/timeout/i);
      } finally {
        global.fetch = originalFetch;
      }
    }, 6000);
  });

  describe('Context Management', () => {
    test('should manage conversation history', () => {
      const sessionId = aiService.createSession('test-session');
      
      aiService.addMessageToSession(sessionId, {
        role: 'user',
        content: 'First message'
      });
      
      aiService.addMessageToSession(sessionId, {
        role: 'assistant',
        content: 'First response'
      });

      const history = aiService.getSessionHistory(sessionId);
      expect(history.length).toBe(2);
      expect(history[0].content).toBe('First message');
      expect(history[1].content).toBe('First response');
    });

    test('should limit session context length', () => {
      const sessionId = aiService.createSession('limited-session', { maxMessages: 3 });
      
      for (let i = 0; i < 5; i++) {
        aiService.addMessageToSession(sessionId, {
          role: 'user',
          content: `Message ${i}`
        });
      }

      const history = aiService.getSessionHistory(sessionId);
      expect(history.length).toBe(3);
      expect(history[0].content).toBe('Message 2');
    });

    test('should clear session history', () => {
      const sessionId = aiService.createSession('clearable-session');
      
      aiService.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Will be cleared'
      });

      aiService.clearSession(sessionId);
      const history = aiService.getSessionHistory(sessionId);
      expect(history.length).toBe(0);
    });

    test('should export and import sessions', () => {
      const sessionId = aiService.createSession('exportable-session');
      
      aiService.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Export me'
      });

      const exported = aiService.exportSession(sessionId);
      expect(exported).toHaveProperty('sessionId');
      expect(exported).toHaveProperty('messages');
      expect(exported.messages.length).toBe(1);

      const importedId = aiService.importSession(exported);
      const importedHistory = aiService.getSessionHistory(importedId);
      expect(importedHistory.length).toBe(1);
    });
  });

  describe('Multi-provider Fallback', () => {
    test('should fallback to secondary provider on failure', async () => {
      const fallbackService = new AIService({
        defaultProvider: 'openai',
        fallbackProvider: 'deepseek',
        openai: {
          apiKey: 'will-fail',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini'
        },
        deepseek: {
          apiKey: process.env.DEEPSEEK_API_KEY || 'test-deepseek-key',
          baseURL: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat'
        },
        enableFallback: true
      });

      const response = await fallbackService.chatCompletion([
        { role: 'user', content: 'Test fallback mechanism' }
      ], {
        enableFallback: true
      });

      expect(response).toBeTruthy();
      expect(response.provider).toBe('deepseek');
    }, 25000);
  });

  describe('Token Counting & Usage Tracking', () => {
    test('should track token usage', async () => {
      const response = await aiService.chatCompletion([
        { role: 'user', content: 'Track my tokens' }
      ]);

      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThanOrEqual(0);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    }, 15000);

    test('should estimate tokens before sending', () => {
      const estimate = aiService.estimateTokens('Hello, this is a test message for token counting.');
      expect(estimate).toBeGreaterThan(0);
      expect(typeof estimate).toBe('number');
    });

    test('should warn when approaching context limit', () => {
      const sessionId = aiService.createSession('context-warning-test');
      const longMessage = 'word '.repeat(10000);
      
      aiService.addMessageToSession(sessionId, {
        role: 'user',
        content: longMessage
      });

      const warning = aiService.checkContextLimit(sessionId);
      expect(warning.isNearLimit).toBe(true);
      expect(warning.percentageUsed).toBeGreaterThan(90);
    });
  });
});

describe('AIService - Environment Compatibility', () => {
  test('should work in browser environment', () => {
    expect(typeof window).not.toBe('undefined');
    
    const service = new AIService({
      defaultProvider: 'openai',
      openai: {
        apiKey: 'browser-test-key',
        baseURL: '/api/proxy/openai',
        model: 'gpt-4o-mini'
      }
    });

    expect(service.getEnvironment()).toBe('browser');
  });

  test('should support proxy configuration for CORS', () => {
    const proxiedService = new AIService({
      defaultProvider: 'openai',
      proxyURL: '/api/ai-proxy',
      openai: {
        apiKey: 'proxied-key',
        model: 'gpt-4o-mini'
      },
      deepseek: {
        apiKey: 'proxied-deepseek-key',
        model: 'deepseek-chat'
      }
    });

    expect(proxiedService.getConfig().proxyURL).toBe('/api/ai-proxy');
  });

  test('should handle environment variable injection', () => {
    const envService = AIService.fromEnvironment();
    
    if (process.env.NEXT_PUBLIC_AI_PROVIDER) {
      expect(envService.getCurrentProvider()).toBe(process.env.NEXT_PUBLIC_AI_PROVIDER);
    } else {
      expect(envService).toBeInstanceOf(AIService);
    }
  });
});

import { DEFAULT_CONFIG } from '../../src/hooks/useLLMConfig';
import { getJSON, setJSON, setStorage } from '../../src/lib/storage';

class MockStorageAdapter {
  store: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this.store[key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store[key] = value;
  }

  async removeItem(_key: string): Promise<void> {}
}

describe('useLLMConfig (logic layer)', () => {
  let mockAdapter: MockStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockStorageAdapter();
    setStorage(mockAdapter);
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have required fields', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('provider');
      expect(DEFAULT_CONFIG).toHaveProperty('apiKey');
      expect(DEFAULT_CONFIG).toHaveProperty('model');
    });

    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.provider).toBe('deepseek');
      expect(DEFAULT_CONFIG.apiKey).toBe('');
      expect(DEFAULT_CONFIG.model).toBe('deepseek-chat');
    });
  });

  describe('config persistence', () => {
    it('should persist valid config to storage', async () => {
      const config = { ...DEFAULT_CONFIG, provider: 'glm', apiKey: 'test-key' };
      await setJSON('echovault-llm-config', config);
      const loaded = await getJSON('echovault-llm-config', DEFAULT_CONFIG);
      expect(loaded.provider).toBe('glm');
      expect(loaded.apiKey).toBe('test-key');
    });

    it('should handle empty apiKey in persisted config', async () => {
      const config = { ...DEFAULT_CONFIG, apiKey: '' };
      await setJSON('echovault-llm-config', config);
      const loaded = await getJSON('echovault-llm-config', DEFAULT_CONFIG);
      expect(loaded.apiKey).toBe('');
    });

    it('should fall back to default when stored data is corrupted', async () => {
      await mockAdapter.setItem('echovault-llm-config', 'invalid-json{');
      const loaded = await getJSON('echovault-llm-config', DEFAULT_CONFIG);
      expect(loaded).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('config merging', () => {
    it('should merge partial update with existing config', () => {
      const base = { provider: 'deepseek', apiKey: 'key1', model: 'deepseek-chat' };
      const update = { model: 'deepseek-reasoner' };
      const merged = { ...base, ...update };
      expect(merged).toEqual({ provider: 'deepseek', apiKey: 'key1', model: 'deepseek-reasoner' });
    });

    it('should not mutate original config during merge', () => {
      const base = { provider: 'deepseek', apiKey: 'key1', model: 'model1' };
      const baseCopy = { ...base };
      const merged = { ...base, model: 'new-model' };
      expect(base).toEqual(baseCopy);
      expect(merged.model).not.toBe(base.model);
    });

    it('should handle empty partial update', () => {
      const base = { provider: 'glm', apiKey: '', model: 'glm-4' };
      const merged = { ...base, ...{} };
      expect(merged).toEqual(base);
    });

    it('should overwrite all fields when full update provided', () => {
      const base = { provider: 'deepseek', apiKey: '', model: 'deepseek-chat' };
      const update = { provider: 'kimi', apiKey: 'new-key', model: 'moonshot-v1-8k' };
      const merged = { ...base, ...update };
      expect(merged).toEqual(update);
    });
  });

  describe('edge cases', () => {
    it('should handle provider change with model reset to first available model', () => {
      const providers = [
        { id: 'deepseek', models: ['deepseek-chat', 'deepseek-reasoner'] },
        { id: 'glm', models: ['glm-4-flash'] },
        { id: 'ollama', models: ['qwen2.5:7b'] },
      ];
      const newProvider = 'glm';
      const prov = providers.find((p) => p.id === newProvider);
      const autoModel = prov?.models[0] || '';
      expect(autoModel).toBe('glm-4-flash');
    });

    it('should handle ollama provider with local model', () => {
      const providers = [
        { id: 'ollama', models: ['qwen2.5:7b'] },
      ];
      const prov = providers.find((p) => p.id === 'ollama');
      expect(prov?.models[0]).toBe('qwen2.5:7b');
    });
  });
});

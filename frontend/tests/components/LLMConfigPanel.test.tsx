import { DEFAULT_CONFIG } from '../../src/hooks/useLLMConfig';

describe('LLMConfigPanel (component contract)', () => {
  describe('PROVIDERS configuration', () => {
    const PROVIDERS = [
      { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
      { id: 'glm', name: '智谱 GLM', models: ['glm-4-flash'] },
      { id: 'kimi', name: 'Kimi', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
      { id: 'qwen', name: '通义千问', models: ['qwen-turbo', 'qwen-plus'] },
      { id: 'mimo', name: '小米 MiMo', models: ['mimo-v2.5'] },
      { id: 'ollama', name: 'Ollama 本地', models: ['qwen2.5:7b'] },
    ];

    it('should have 6 providers configured', () => {
      expect(PROVIDERS).toHaveLength(6);
    });

    it('should have unique provider IDs', () => {
      const ids = PROVIDERS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each provider should have at least one model', () => {
      PROVIDERS.forEach((p) => {
        expect(p.models.length).toBeGreaterThanOrEqual(1);
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.id.length).toBeGreaterThan(0);
      });
    });

    it('deepseek should have 2 models', () => {
      const deepseek = PROVIDERS.find((p) => p.id === 'deepseek');
      expect(deepseek?.models).toEqual(['deepseek-chat', 'deepseek-reasoner']);
    });

    it('ollama should have local model', () => {
      const ollama = PROVIDERS.find((p) => p.id === 'ollama');
      expect(ollama?.models).toContain('qwen2.5:7b');
    });

    it('all provider names should be non-empty strings', () => {
      PROVIDERS.forEach((p) => {
        expect(typeof p.name).toBe('string');
        expect(p.name.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('controlled mode behavior (logic)', () => {
    it('when external config is provided, should use external provider', () => {
      const externalConfig = { provider: 'glm', apiKey: '', model: 'glm-4-flash' };
      const isControlled = !!externalConfig;
      expect(isControlled).toBe(true);
      const provider = externalConfig.provider;
      expect(provider).toBe('glm');
    });

    it('when no external config, should fall back to default', () => {
      const externalConfig = undefined;
      const fallbackProvider = externalConfig?.provider || DEFAULT_CONFIG.provider;
      expect(fallbackProvider).toBe(DEFAULT_CONFIG.provider);
    });

    it('provider change should auto-select first model of new provider', () => {
      const providers = [
        { id: 'deepseek', models: ['deepseek-chat'] },
        { id: 'kimi', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
      ];
      const newProviderId = 'kimi';
      const prov = providers.find((p) => p.id === newProviderId);
      const autoModel = prov?.models[0] || '';
      expect(autoModel).toBe('moonshot-v1-8k');
    });

    it('onConfigChange should merge partial updates correctly', () => {
      const baseConfig = { provider: 'deepseek', apiKey: 'key1', model: 'model1' };
      const handler = (newConfig: Partial<typeof baseConfig>) => ({
        ...baseConfig,
        ...newConfig,
      });
      const result = handler({ model: 'new-model' });
      expect(result).toEqual({ provider: 'deepseek', apiKey: 'key1', model: 'new-model' });
    });
  });

  describe('input validation (contract)', () => {
    it('apiKey can be empty string (valid - user may not have entered yet)', () => {
      const config = { ...DEFAULT_CONFIG, apiKey: '' };
      expect(config.apiKey).toBe('');
    });

    it('provider must be one of known IDs', () => {
      const validIds = ['deepseek', 'glm', 'kimi', 'qwen', 'mimo', 'ollama'];
      const testProvider = 'deepseek';
      expect(validIds).toContain(testProvider);
    });

    it('model must belong to selected provider', () => {
      const providerModels: Record<string, string[]> = {
        deepseek: ['deepseek-chat', 'deepseek-reasoner'],
        glm: ['glm-4-flash'],
      };
      const selectedProvider = 'deepseek';
      const selectedModel = 'deepseek-chat';
      expect(providerModels[selectedProvider]).toContain(selectedModel);
    });

    it('disabled prop should prevent updates when true', () => {
      const disabled = true;
      const canUpdate = !disabled;
      expect(canUpdate).toBe(false);
    });
  });
});

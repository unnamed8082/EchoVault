'use client';

import { useState, useEffect, useCallback } from 'react';
import { getJSON, setJSON } from '../lib/storage';

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'echovault-llm-config';

export const DEFAULT_CONFIG: LLMConfig = {
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
};

interface UseLLMConfigResult {
  config: LLMConfig;
  loaded: boolean;
  error: string | null;
  updateConfig: (newConfig: Partial<LLMConfig>) => Promise<void>;
  resetConfig: () => Promise<void>;
}

export default function useLLMConfig(): UseLLMConfigResult {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await getJSON<LLMConfig | null>(STORAGE_KEY, null);
        if (!cancelled) {
          if (stored && typeof stored.provider === 'string') {
            setConfig(stored);
          }
          setLoaded(true);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[useLLMConfig] Failed to load config:', e);
          setConfig(DEFAULT_CONFIG);
          setLoaded(true);
          setError('配置加载失败，使用默认设置');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<LLMConfig>) => {
    try {
      const merged = { ...config, ...newConfig };
      setConfig(merged);
      await setJSON(STORAGE_KEY, merged);
      setError(null);
    } catch (e) {
      console.warn('[useLLMConfig] Failed to save config:', e);
      setError('配置保存失败，请重试');
    }
  }, [config]);

  const resetConfig = useCallback(async () => {
    try {
      setConfig(DEFAULT_CONFIG);
      await setJSON(STORAGE_KEY, DEFAULT_CONFIG);
      setError(null);
    } catch (e) {
      console.warn('[useLLMConfig] Failed to reset config:', e);
      setError('重置配置失败');
    }
  }, []);

  return { config, loaded, error, updateConfig, resetConfig };
}

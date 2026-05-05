'use client';

import { useState, useEffect } from 'react';

interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'echovault-llm-config';

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-chat',
};

export default function useLLMConfig() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setConfig(JSON.parse(stored));
      } catch {
        setConfig(DEFAULT_CONFIG);
      }
    }
    setLoaded(true);
  }, []);

  const updateConfig = (newConfig: Partial<LLMConfig>) => {
    const merged = { ...config, ...newConfig };
    setConfig(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  };

  return { config, loaded, updateConfig };
}

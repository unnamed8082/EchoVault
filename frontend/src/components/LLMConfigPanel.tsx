'use client';

import { useState, useEffect } from 'react';
import { type LLMConfig, DEFAULT_CONFIG } from '../hooks/useLLMConfig';

interface LLMConfigPanelProps {
  config?: LLMConfig;
  onConfigChange?: (config: Partial<LLMConfig>) => void;
  disabled?: boolean;
}

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'glm', name: '智谱 GLM', models: ['glm-4-flash'] },
  { id: 'kimi', name: 'Kimi', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { id: 'qwen', name: '通义千问', models: ['qwen-turbo', 'qwen-plus'] },
  { id: 'mimo', name: '小米 MiMo', models: ['mimo-v2.5'] },
  { id: 'ollama', name: 'Ollama 本地', models: ['qwen2.5:7b'] },
];

export default function LLMConfigPanel({ config: externalConfig, onConfigChange, disabled }: LLMConfigPanelProps) {
  const [internalProvider, setInternalProvider] = useState(externalConfig?.provider || DEFAULT_CONFIG.provider);
  const [internalApiKey, setInternalApiKey] = useState(externalConfig?.apiKey || DEFAULT_CONFIG.apiKey);
  const [internalModel, setInternalModel] = useState(externalConfig?.model || DEFAULT_CONFIG.model);

  const isControlled = !!externalConfig;
  const provider = isControlled ? externalConfig.provider : internalProvider;
  const apiKey = isControlled ? externalConfig.apiKey : internalApiKey;
  const model = isControlled ? externalConfig.model : internalModel;

  useEffect(() => {
    if (externalConfig) {
      setInternalProvider(externalConfig.provider);
      setInternalApiKey(externalConfig.apiKey);
      setInternalModel(externalConfig.model);
    }
  }, [externalConfig]);

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const models = currentProvider?.models || [];

  const handleProviderChange = (newProvider: string) => {
    if (!isControlled) setInternalProvider(newProvider);
    const prov = PROVIDERS.find((p) => p.id === newProvider);
    const newModel = prov?.models[0] || '';
    if (!isControlled) setInternalModel(newModel);
    onConfigChange?.({ provider: newProvider, apiKey, model: newModel });
  };

  const handleApiKeyChange = (key: string) => {
    if (!isControlled) setInternalApiKey(key);
    onConfigChange?.({ provider, apiKey: key, model });
  };

  const handleModelChange = (newModel: string) => {
    if (!isControlled) setInternalModel(newModel);
    onConfigChange?.({ provider, apiKey, model: newModel });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900">LLM 模型配置</h2>

      <div>
        <label htmlFor="provider-select" className="block text-sm font-medium text-gray-700 mb-2">供应商</label>
        <select
          id="provider-select"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-2">模型</label>
        <select
          id="model-select"
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
        <input
          id="api-key-input"
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="输入 API Key"
          disabled={disabled}
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="text-xs text-gray-500 pt-1">
        API Key 保存在本地设备，不会上传到服务器
      </div>
    </div>
  );
}

export { PROVIDERS };

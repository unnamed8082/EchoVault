'use client';

import { useState } from 'react';

interface LLMConfigPanelProps {
  onConfigChange?: (config: LLMConfig) => void;
}

export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
}

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'glm', name: '智谱 GLM', models: ['glm-4-flash'] },
  { id: 'kimi', name: 'Kimi', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { id: 'qwen', name: '通义千问', models: ['qwen-turbo', 'qwen-plus'] },
  { id: 'mimo', name: '小米 MiMo', models: ['mimo-v2.5'] },
  { id: 'ollama', name: 'Ollama 本地', models: ['qwen2.5:7b'] },
];

export default function LLMConfigPanel({ onConfigChange }: LLMConfigPanelProps) {
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-chat');

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const models = currentProvider?.models || [];

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const prov = PROVIDERS.find((p) => p.id === newProvider);
    const newModel = prov?.models[0] || '';
    setModel(newModel);
    onConfigChange?.({ provider: newProvider, apiKey, model: newModel });
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    onConfigChange?.({ provider, apiKey: key, model });
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    onConfigChange?.({ provider, apiKey, model: newModel });
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">LLM 模型配置</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">供应商</label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">模型</label>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="输入 API Key"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="text-xs text-gray-500">
        API Key 保存在本地，不会上传到服务器
      </div>
    </div>
  );
}

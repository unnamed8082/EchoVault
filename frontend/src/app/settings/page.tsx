'use client';

import { useState, useCallback } from 'react';
import LLMConfigPanel from '../../components/LLMConfigPanel';
import useLLMConfig, { type LLMConfig } from '../../hooks/useLLMConfig';

export default function SettingsPage() {
  const { config, loaded, error: storageError, updateConfig, resetConfig } = useLLMConfig();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleConfigChange = useCallback(async (newConfig: Partial<LLMConfig>) => {
    setSaving(true);
    await updateConfig(newConfig);
    setSaving(false);
    if (!storageError) {
      showToast('success', '配置已保存');
    }
  }, [updateConfig, storageError, showToast]);

  const handleReset = useCallback(async () => {
    await resetConfig();
    showToast('success', '配置已重置为默认值');
  }, [resetConfig, showToast]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
          <div className="text-sm text-gray-500">加载设置...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto relative">
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-opacity duration-300 ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
            role="alert"
          >
            {toast.message}
          </div>
        )}

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
          设置
        </h1>

        {storageError && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm" role="alert">
            ⚠ {storageError}
          </div>
        )}

        <LLMConfigPanel
          config={config}
          onConfigChange={handleConfigChange}
          disabled={saving}
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors"
          >
            重置默认
          </button>
        </div>

        <div className="mt-8 text-xs text-gray-400 text-center space-y-1">
          <p>API Key 仅保存在本地设备，不会上传至任何服务器</p>
          <p>切换供应商时将自动选择该供应商的默认模型</p>
        </div>
      </div>
    </div>
  );
}

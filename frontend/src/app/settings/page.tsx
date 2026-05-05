'use client';

import LLMConfigPanel from '@/components/LLMConfigPanel';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          设置
        </h1>
        <LLMConfigPanel />
      </div>
    </div>
  );
}

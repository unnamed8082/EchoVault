'use client';

import { useParams } from 'next/navigation';

export default function SkillChatPage() {
  const params = useParams();
  const skillId = params?.skillId as string;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">
          与 {skillId || '未知'} 对话
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
            开始输入消息，与数字分身对话
          </div>
        </div>
      </main>

      <footer className="bg-white border-t px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="输入消息..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              发送
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

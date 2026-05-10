'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api-client';

export default function PrivacyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConsent = async (accepted: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/privacy/consent', {
        consent_type: 'privacy_policy',
        accepted,
      });
      router.back();
    } catch {
      setError('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center">
          EchoVault 隐私协议
        </h1>

        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">1. 数据收集说明</h2>
            <p className="text-gray-600 leading-relaxed">
              EchoVault 仅收集为您提供服务所必需的数据，包括：用户注册信息（用户名、邮箱）、聊天记录、数字分身配置数据。
              我们不会收集您的设备信息、地理位置或其他与服务无关的个人数据。
              所有敏感信息（如身份证号、手机号、银行卡号）在存储前均经过端侧脱敏处理。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">2. 数据使用方式</h2>
            <p className="text-gray-600 leading-relaxed">
              您的数据仅用于以下用途：提供 AI 对话服务、生成和维护数字分身、改善服务质量。
              我们不会将您的数据用于广告投放、数据交易或任何商业化的第三方共享。
              AI 模型处理过程中，您的对话内容不会被用于模型训练。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">3. 数据存储安全</h2>
            <p className="text-gray-600 leading-relaxed">
              所有数据均存储在本地服务器，采用 SQLite 加密存储。
              API Key 仅保存在用户本地设备，通过加密方式传输，不会在服务端持久化存储。
              我们采用行业标准的安全措施保护您的数据，包括传输加密（HTTPS）、访问控制和定期安全审计。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">4. 用户权利</h2>
            <p className="text-gray-600 leading-relaxed">
              您享有以下权利：<strong>访问权</strong> — 随时查看您的所有个人数据；
              <strong>导出权</strong> — 以标准格式导出您的数据；
              <strong>删除权</strong> — 随时要求删除您的账户及所有相关数据，删除操作不可撤销。
              如需行使上述权利，请通过下方联系方式联系我们。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">5. AI 使用声明</h2>
            <p className="text-gray-600 leading-relaxed">
              EchoVault 使用第三方大语言模型（如 DeepSeek、GLM 等）提供 AI 对话能力。
              对话内容会发送至所选 AI 服务商进行处理，但我们会在此之前进行敏感信息脱敏。
              AI 生成的内容仅供参考，不构成专业建议。
              我们内置了内容安全过滤机制，自动屏蔽有害内容。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">6. 联系方式</h2>
            <p className="text-gray-600 leading-relaxed">
              如您对本隐私协议有任何疑问，请通过以下方式联系我们：
            </p>
            <ul className="mt-2 text-gray-600 space-y-1">
              <li>邮箱：privacy@echovault.dev</li>
              <li>GitHub：https://github.com/unnamed8082/EchoVault/issues</li>
            </ul>
          </section>

          <div className="pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => handleConsent(false)}
              disabled={loading}
              className="px-6 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              不同意
            </button>
            <button
              onClick={() => handleConsent(true)}
              disabled={loading}
              className="px-6 py-2.5 text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? '提交中...' : '同意'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

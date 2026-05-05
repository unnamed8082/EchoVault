import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
            EchoVault
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            隐私至上的 AI 数字陪伴平台 - 保存情感记忆，创建专属数字分身
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-3xl mb-4">🌳</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              情感树洞
            </h3>
            <p className="text-gray-600">
              安全记录你的情感记忆，保护隐私，绝不泄露
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              人格蒸馏
            </h3>
            <p className="text-gray-600">
              基于聊天记录，智能蒸馏专属人格模型
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              多模型支持
            </h3>
            <p className="text-gray-600">
              支持 DeepSeek、GLM、Kimi 等主流大模型
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link href="/distill" className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-xl text-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl no-underline">
            开始创建你的 Skill
          </Link>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>提示：访问 /distill 进入人格蒸馏功能</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { distillAPI } from '../../lib/api-client';

export default function DistillPage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !slug) {
      setError('请填写必填项：姓名和唯一标识');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await distillAPI.createSkill({
        name,
        slug,
        description,
        persona_traits: { tags: ['已创建'] },
        memory_items: { shared_experiences: ['第一次见面'] }
      });

      if (response.success) {
        setSuccess(true);
        // 重置表单
        setName('');
        setSlug('');
        setDescription('');
      }
    } catch (err) {
      console.error('创建 Skill 失败:', err);
      setError('创建失败，请检查后端服务是否已启动');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            EchoVault - 人格蒸馏
          </h1>
          <p className="text-gray-600">
            创建数字分身，保留情感记忆
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
              Skill 创建成功！
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                姓名/代号 *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：小明"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                唯一标识 (slug) *
              </label>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：xiaoming (只允许字母、数字、下划线)"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                描述
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="简单介绍一下这个数字分身"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建 Skill'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>提示：确保后端服务已在 http://localhost:9000 运行</p>
        </div>
      </div>
    </div>
  );
}

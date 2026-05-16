'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { distillAPI, SkillResponse } from '../../lib/api-client';

export default function DistillPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillResponse[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const list = await distillAPI.listSkills();
      const details = await Promise.all(
        list.skills.map(s => distillAPI.getSkill(s).catch(() => null))
      );
      setSkills(details.filter((d): d is SkillResponse => d !== null));
    } catch {
      // Backend may not be available
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !slug.trim()) {
      setError('请填写必填项：名称和唯一标识');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(slug.trim())) {
      setError('唯一标识只能包含字母、数字、下划线和横线');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await distillAPI.createSkill({
        name: name.trim(),
        slug: slug.trim(),
        persona_traits: { tags: ['已创建'] },
        memory_items: { shared_experiences: ['第一次见面'] },
      });

      if (response.success) {
        setName('');
        setSlug('');
        await loadSkills();
        router.push(`/chat/${response.slug}`);
      }
    } catch (err) {
      console.error('创建 Skill 失败:', err);
      setError(err instanceof Error ? err.message : '创建失败，请检查后端服务是否已启动');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slugToDelete: string) => {
    if (!window.confirm(`确定要删除 "${slugToDelete}" 吗？此操作不可撤销。`)) return;

    try {
      await distillAPI.deleteSkill(slugToDelete);
      setSkills(prev => prev.filter(s => s.slug !== slugToDelete));
    } catch (err) {
      console.error('删除失败:', err);
      alert('删除失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            EchoVault - 人格蒸馏
          </h1>
          <p className="text-gray-600">
            创建数字分身，保留情感记忆
          </p>
        </div>

        {/* Existing Skills */}
        {skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">已创建的数字分身</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {skills.map((skill) => (
                <div
                  key={skill.slug}
                  className="bg-white rounded-xl shadow-md p-5 border border-gray-200 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg">{skill.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">ID: {skill.slug}</p>
                      {skill.lessons_content && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{skill.lessons_content}</p>
                      )}
                    </div>
                    <span className="text-3xl ml-3">🤖</span>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => router.push(`/chat/${skill.slug}`)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-indigo-600 hover:to-purple-600 transition-all"
                    >
                      开始对话
                    </button>
                    <button
                      onClick={() => handleDelete(skill.slug)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {skillsLoading && (
          <div className="mb-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2" />
            加载已有技能...
          </div>
        )}

        {/* Create New Skill */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">创建新数字分身</h2>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                名称 *
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
          <p>提示：确保后端服务已在运行</p>
        </div>
      </div>
    </div>
  );
}

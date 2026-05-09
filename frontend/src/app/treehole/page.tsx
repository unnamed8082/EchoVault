'use client';

import { useState, useCallback, useEffect } from 'react';
import { getJSON, setJSON } from '../../lib/storage';

interface TreeHoleEntry {
  id: string;
  content: string;
  timestamp: number;
  mood?: string;
}

const STORAGE_KEY = 'echovault_treehole_entries';
const MOODS = ['😢 难过', '😰 焦虑', '😡 愤怒', '😔 沮丧', '😌 平静', '😊 开心'];

export default function TreeHolePage() {
  const [entries, setEntries] = useState<TreeHoleEntry[]>([]);
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const saved = await getJSON<TreeHoleEntry[]>(STORAGE_KEY, []);
      setEntries(saved.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('加载树洞记录失败:', error);
    } finally {
      setLoaded(true);
    }
  };

  const saveEntries = async (newEntries: TreeHoleEntry[]) => {
    try {
      await setJSON(STORAGE_KEY, newEntries);
      setEntries(newEntries.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('保存树洞记录失败:', error);
      alert('保存失败，请重试');
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const newEntry: TreeHoleEntry = {
        id: Date.now().toString(),
        content: content.trim(),
        timestamp: Date.now(),
        mood: selectedMood || undefined
      };

      const updatedEntries = [...entries, newEntry];
      await saveEntries(updatedEntries);
      
      setContent('');
      setSelectedMood('');
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [content, selectedMood, entries]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const updatedEntries = entries.filter(entry => entry.id !== id);
      await saveEntries(updatedEntries);
      setShowConfirm(null);
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  }, [entries]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <div className="text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <span className="text-4xl">🌳</span>
            情感树洞
          </h1>
          <p className="text-gray-600">
            在这里倾诉你的心声，所有内容仅保存在本地设备
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-green-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="mood" className="block text-sm font-medium text-gray-700 mb-2">
                当前心情（可选）
              </label>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setSelectedMood(selectedMood === mood ? '' : mood)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                      selectedMood === mood
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                倾诉你的心声 *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="在这里写下你想说的话...（最多1000字）"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none transition-all"
                required
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {content.length}/1000
              </div>
            </div>

            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? '提交中...' : '投入树洞 🌳'}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>📝</span> 我的树洞记录 ({entries.length})
          </h2>

          {entries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
              <div className="text-5xl mb-4">🌿</div>
              <p className="text-gray-500">还没有记录，开始写下你的第一个树洞吧</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition-shadow duration-200 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {entry.mood && (
                      <span className="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium mb-2">
                        {entry.mood}
                      </span>
                    )}
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {entry.content}
                    </p>
                    <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
                      <span>{formatDate(entry.timestamp)}</span>
                      <span>·</span>
                      <span>{new Date(entry.timestamp).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowConfirm(showConfirm === entry.id ? null : entry.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="删除此条记录"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {showConfirm === entry.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">确定要删除这条记录吗？</span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                      >
                        确认删除
                      </button>
                      <button
                        onClick={() => setShowConfirm(null)}
                        className="px-4 py-2 text-gray-600 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-8 text-center text-xs text-gray-400 space-y-1">
          <p>💚 所有数据仅存储在您的本地设备中</p>
          <p>🔒 我们无法访问您的内容，请放心使用</p>
        </div>
      </div>
    </div>
  );
}

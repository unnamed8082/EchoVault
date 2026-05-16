'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getJSON, setJSON } from '../../../lib/storage';
import { AIService, ChatMessage as AIChatMessage } from '../../../lib/ai-service';
import { distillAPI } from '../../../lib/api-client';

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  capabilities?: string[];
  avatar?: string;
  color?: string;
  isBackend?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const STORAGE_KEY_SKILLS = 'echovault_skills';

const defaultSkills: SkillInfo[] = [
  {
    id: 'emotional-support',
    name: '情感支持',
    description: '提供温暖的倾听和情感支持，帮助你度过困难时刻',
    capabilities: ['倾听', '共情', '情绪疏导'],
    avatar: '💝',
    color: 'from-pink-500 to-rose-500'
  },
  {
    id: 'mindfulness',
    name: '正念冥想',
    description: '引导你进行正念练习，缓解压力和焦虑',
    capabilities: ['冥想引导', '呼吸练习', '放松技巧'],
    avatar: '🧘',
    color: 'from-teal-500 to-cyan-500'
  },
  {
    id: 'journal-companion',
    name: '日记伙伴',
    description: '陪你写日记，帮助你反思和记录生活',
    capabilities: ['日记引导', '情绪记录', '反思提问'],
    avatar: '📔',
    color: 'from-amber-500 to-yellow-500'
  }
];

export default function SkillChatPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params?.skillId as string;

  const [skill, setSkill] = useState<SkillInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiServiceRef = useRef<AIService | null>(null);

  const getAIService = (): AIService => {
    if (!aiServiceRef.current) {
      aiServiceRef.current = AIService.fromEnvironment();
    }
    return aiServiceRef.current;
  };

  useEffect(() => {
    loadSkillAndHistory();
  }, [skillId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSkillAndHistory = async () => {
    try {
      // Try loading from backend first
      try {
        const backendSkill = await distillAPI.getSkill(skillId);
        const traits = backendSkill.persona_traits;
        const tags = Array.isArray(traits?.tags) ? traits.tags as string[] : [];
        setSkill({
          id: backendSkill.slug,
          name: backendSkill.name,
          description: backendSkill.lessons_content || tags.join('、') || '数字分身',
          capabilities: tags,
          avatar: '🤖',
          color: 'from-indigo-500 to-purple-500',
          isBackend: true,
        });
      } catch {
        // Backend unavailable, fall back to local
        let currentSkill = defaultSkills.find(s => s.id === skillId);
        if (!currentSkill) {
          const savedSkills = await getJSON<SkillInfo[]>(STORAGE_KEY_SKILLS, []);
          currentSkill = savedSkills.find(s => s.id === skillId) || undefined;
        }
        if (currentSkill) setSkill(currentSkill);
      }

      const chatKey = `echovault_skill_chat_${skillId}`;
      const history = await getJSON<ChatMessage[]>(chatKey, []);
      setMessages(history);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoaded(true);
    }
  };

  const saveHistory = async (newMessages: ChatMessage[]) => {
    try {
      const chatKey = `echovault_skill_chat_${skillId}`;
      await setJSON(chatKey, newMessages);
    } catch (err) {
      console.error('保存聊天记录失败:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading || !skill) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      await saveHistory(updatedMessages);

      const capabilities = skill.capabilities?.join('、') || '';
      const systemPrompt = `你是"${skill.name}"技能助手。${skill.description}${capabilities ? `。你的核心能力包括：${capabilities}` : ''}。请用温暖、专业的方式与用户对话，提供有价值的帮助。`;

      const chatMessages: AIChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      const messagesWithPlaceholder = [...updatedMessages, assistantMessage];
      setMessages(messagesWithPlaceholder);

      const streamCallback = (chunk: string, done?: boolean) => {
        if (done) return;
        assistantMessage.content += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.id === assistantMessage.id) {
            updated[updated.length - 1] = { ...lastMsg, content: assistantMessage.content };
          }
          return updated;
        });
      };

      if (skill.isBackend) {
        // Use skill-aware backend endpoint
        await getAIService().streamSkillChat(
          skillId,
          updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          streamCallback,
          { temperature: 0.8, maxTokens: 2048 }
        );
      } else {
        // Use generic completions endpoint with local system prompt
        await getAIService().streamChatCompletion(
          chatMessages,
          streamCallback,
          { temperature: 0.8, maxTokens: 2048 }
        );
      }

      const finalMessages = [...updatedMessages, assistantMessage];
      saveHistory(finalMessages);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '发送消息失败';
      setError(errorMsg);
      console.error('发送消息失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, skill]);

  const handleClearHistory = useCallback(async () => {
    if (window.confirm('确定要清空与该技能的所有聊天记录吗？')) {
      try {
        const chatKey = `echovault_skill_chat_${skillId}`;
        await setJSON(chatKey, []);
        setMessages([]);
      } catch (err) {
        console.error('清空历史失败:', err);
      }
    }
  }, [skillId]);

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4" />
          <div className="text-gray-600">加载中…</div>
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">未找到技能</h2>
          <p className="text-gray-600 mb-6">请返回选择一个有效的技能</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const skillColor = skill.color || 'from-blue-500 to-purple-500';
  const skillAvatar = skill.avatar || '💬';

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <header className={`bg-gradient-to-r ${skillColor} px-6 py-4 shadow-lg`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              aria-label="返回首页"
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-3xl shadow-md">
              {skillAvatar}
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">{skill.name}</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm text-white/90">在线</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            aria-label="清空聊天记录"
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
          >
            清空记录
          </button>
        </div>

        {skill.description && (
          <div className="max-w-4xl mx-auto mt-3 pt-3 border-t border-white/20">
            <p className="text-sm text-white/80">{skill.description}</p>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4" role="log" aria-label="聊天记录">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-7xl mb-6 transform hover:scale-110 transition-transform duration-300">
                {skillAvatar}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {skill.name}
              </h2>
              <p className="text-gray-600 mb-6">{skill.description}</p>

              {skill.capabilities && skill.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-8">
                  {skill.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className={`px-4 py-2 bg-gradient-to-r ${skillColor} text-white rounded-full text-sm font-medium`}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  '你好，请介绍一下你的功能',
                  '我需要一些帮助',
                  '能给我一些建议吗？',
                  '我们开始吧'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-left hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] lg:max-w-[70%] px-5 py-3 rounded-2xl shadow-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                      <span className="text-lg">{skillAvatar}</span>
                      <span className="font-medium text-gray-700">{skill.name}</span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

                  <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-gray-300' : 'text-gray-400'} text-right`}>
                    {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-5 py-4 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{skillAvatar}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm">{skill.name} 正在思考…</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="bg-red-50 border border-red-200 px-5 py-3 rounded-2xl shadow-sm text-red-600 text-sm">
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <label htmlFor="skill-chat-input" className="sr-only">输入消息</label>
          <input
            id="skill-chat-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`与 ${skill.name} 对话…`}
            disabled={isLoading}
            className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100"
            maxLength={2000}
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="发送消息"
            className={`px-8 py-3 bg-gradient-to-r ${skillColor} text-white rounded-xl font-medium opacity-90 hover:opacity-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              '发送'
            )}
          </button>
        </form>

        <div className="max-w-4xl mx-auto mt-2 text-center text-xs text-gray-400">
          按 Enter 发送 · Shift + Enter 换行 · 最多 2000 字
        </div>
      </footer>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in {
            animation: none;
          }
          .animate-spin {
            animation: none;
          }
          .animate-bounce {
            animation: none;
          }
          .animate-pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

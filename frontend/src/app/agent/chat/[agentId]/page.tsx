'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getJSON, setJSON } from '../../../../lib/storage';
import { AIService, ChatMessage as AIChatMessage } from '../../../../lib/ai-service';
import { distillAPI } from '../../../../lib/api-client';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  description: string;
  personality: string[];
  color: string;
  isBackend?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

const STORAGE_KEY_AGENTS = 'echovault_agents';
const defaultAgents: Agent[] = [
  {
    id: 'empathetic',
    name: '温暖倾听者',
    avatar: '🤗',
    description: '善解人意的朋友，总是能理解你的感受',
    personality: ['共情能力强', '温柔体贴', '善于倾听'],
    color: 'from-pink-500 to-rose-500'
  },
  {
    id: 'wise',
    name: '智慧导师',
    avatar: '🧙',
    description: '经验丰富的人生导师，给你明智的建议',
    personality: ['理性分析', '经验丰富', '循循善诱'],
    color: 'from-purple-500 to-indigo-500'
  },
  {
    id: 'cheerful',
    name: '快乐伙伴',
    avatar: '😄',
    description: '充满正能量的朋友，总能让你开心起来',
    personality: ['乐观积极', '幽默风趣', '鼓舞人心'],
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'analytical',
    name: '理性分析师',
    avatar: '🔬',
    description: '逻辑清晰的分析师，帮你理清思路',
    personality: ['逻辑严密', '客观公正', '条理分明'],
    color: 'from-blue-500 to-cyan-500'
  }
];

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.agentId as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
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
    loadAgentAndHistory();
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAgentAndHistory = async () => {
    try {
      let currentAgent = defaultAgents.find(a => a.id === agentId);

      if (!currentAgent) {
        const savedAgents = await getJSON<Agent[]>(STORAGE_KEY_AGENTS, []);
        currentAgent = savedAgents.find(a => a.id === agentId) || undefined;
      }

      // Try loading from backend
      if (!currentAgent) {
        try {
          const backendSkill = await distillAPI.getSkill(agentId);
          const traits = backendSkill.persona_traits;
          const tags = Array.isArray(traits?.tags) ? traits.tags as string[] : [];
          currentAgent = {
            id: backendSkill.slug,
            name: backendSkill.name,
            avatar: '🤖',
            description: backendSkill.lessons_content || tags.join('、') || '数字分身',
            personality: tags.length > 0 ? tags : ['个性化', '数字分身'],
            color: 'from-indigo-500 to-purple-500',
            isBackend: true,
          };
        } catch {
          // Not a backend skill
        }
      }

      if (currentAgent) {
        setAgent(currentAgent);
        
        const chatKey = `echovault_agent_chat_${agentId}`;
        const history = await getJSON<ChatMessage[]>(chatKey, []);
        setMessages(history);
      } else {
        console.error('未找到智能体:', agentId);
      }
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoaded(true);
    }
  };

  const saveHistory = async (newMessages: ChatMessage[]) => {
    try {
      const chatKey = `echovault_agent_chat_${agentId}`;
      await setJSON(chatKey, newMessages);
    } catch (error) {
      console.error('保存聊天记录失败:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !agent) return;

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

      const systemPrompt = `你是${agent.name}。${agent.description}。你的性格特点：${agent.personality.join('、')}。请用符合你性格的方式与用户对话。`;

      const chatMessages: AIChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map(m => ({
          role: m.role === 'agent' ? 'assistant' as const : m.role as 'user',
          content: m.content
        }))
      ];

      const agentMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: '',
        timestamp: Date.now()
      };

      const messagesWithPlaceholder = [...updatedMessages, agentMessage];
      setMessages(messagesWithPlaceholder);

      const streamCallback = (chunk: string, done?: boolean) => {
        if (done) return;
        agentMessage.content += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.id === agentMessage.id) {
            updated[updated.length - 1] = { ...lastMsg, content: agentMessage.content };
          }
          return updated;
        });
      };

      if (agent.isBackend) {
        await getAIService().streamSkillChat(
          agentId,
          updatedMessages.map(m => ({
            role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
            content: m.content
          })),
          streamCallback,
          { temperature: 0.8, maxTokens: 2048 }
        );
      } else {
        await getAIService().streamChatCompletion(
          chatMessages,
          streamCallback,
          { temperature: 0.8, maxTokens: 2048 }
        );
      }

      const finalMessages = [...updatedMessages, agentMessage];
      saveHistory(finalMessages);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '发送消息失败';
      setError(errorMsg);
      console.error('发送消息失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, agent]);

  const handleClearHistory = useCallback(async () => {
    if (window.confirm('确定要清空与该智能体的所有聊天记录吗？')) {
      try {
        const chatKey = `echovault_agent_chat_${agentId}`;
        await setJSON(chatKey, []);
        setMessages([]);
      } catch (error) {
        console.error('清空历史失败:', error);
      }
    }
  }, [agentId]);

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4" />
          <div className="text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">未找到智能体</h2>
          <p className="text-gray-600 mb-6">请返回选择一个有效的智能体</p>
          <button
            onClick={() => router.push('/agent/select')}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            返回选择
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className={`bg-gradient-to-r ${agent.color} px-6 py-4 shadow-lg`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/agent/select')}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-3xl shadow-md">
              {agent.avatar}
            </div>
            
            <div>
              <h1 className="text-lg font-bold text-white">{agent.name}</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm text-white/90">在线</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
          >
            清空记录
          </button>
        </div>

        {agent.description && (
          <div className="max-w-4xl mx-auto mt-3 pt-3 border-t border-white/20">
            <p className="text-sm text-white/80">{agent.description}</p>
          </div>
        )}
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className={`text-7xl mb-6 transform hover:scale-110 transition-transform duration-300`}>
                {agent.avatar}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                与 {agent.name} 对话
              </h2>
              <p className="text-gray-600 mb-6">{agent.description}</p>
              
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {agent.personality.map((trait) => (
                  <span
                    key={trait}
                    className={`px-4 py-2 bg-gradient-to-r ${agent.color} text-white rounded-full text-sm font-medium`}
                  >
                    {trait}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  '你好，请介绍一下自己',
                  '我今天心情不太好',
                  '给我一些建议',
                  '我们聊点什么吧'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-left hover:border-purple-300 hover:shadow-md transition-all"
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
                      : `bg-white border border-gray-200`
                  }`}
                >
                  {message.role === 'agent' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                      <span className="text-lg">{agent.avatar}</span>
                      <span className="font-medium text-gray-700">{agent.name}</span>
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
                    <span className="text-2xl">{agent.avatar}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm">{agent.name} 正在思考...</span>
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

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`与 ${agent.name} 对话...`}
            disabled={isLoading}
            className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all disabled:bg-gray-100"
            maxLength={2000}
          />
          
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-8 py-3 bg-gradient-to-r ${agent.color} text-white rounded-xl font-medium opacity-90 hover:opacity-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg`}
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
      `}</style>
    </div>
  );
}

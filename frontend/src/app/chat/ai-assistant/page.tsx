'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getJSON, setJSON } from '../../../lib/storage';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const STORAGE_KEY = 'echovault_ai_chat_history';

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadHistory = async () => {
    try {
      const history = await getJSON<Message[]>(STORAGE_KEY, []);
      setMessages(history);
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    } finally {
      setLoaded(true);
    }
  };

  const saveHistory = async (newMessages: Message[]) => {
    try {
      await setJSON(STORAGE_KEY, newMessages);
    } catch (error) {
      console.error('保存聊天历史失败:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      await saveHistory(updatedMessages);

      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: generateAIResponse(userMessage.content),
          timestamp: Date.now()
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        saveHistory(finalMessages);
        setIsLoading(false);
      }, 1000 + Math.random() * 1000);
    } catch (error) {
      console.error('发送消息失败:', error);
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const generateAIResponse = (userInput: string): string => {
    const responses = [
      `我理解你的感受。关于"${userInput.slice(0, 20)}..."，我想说...`,
      `这是一个很好的问题。让我来帮你分析一下...`,
      `我听到了你的心声。作为你的 AI 陪伴，我会一直在这里支持你。`,
      `感谢你与我分享。我们可以继续深入探讨这个话题。`,
      `这是一个值得思考的角度。你觉得呢？`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleClearHistory = useCallback(async () => {
    if (window.confirm('确定要清空所有聊天记录吗？')) {
      try {
        await setJSON(STORAGE_KEY, []);
        setMessages([]);
      } catch (error) {
        console.error('清空历史失败:', error);
      }
    }
  }, []);

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <div className="text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
            AI
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">AI 智能助手</h1>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              在线
            </p>
          </div>
        </div>
        
        <button
          onClick={handleClearHistory}
          className="px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          清空记录
        </button>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                开始与 AI 对话
              </h2>
              <p className="text-gray-600 text-sm">
                我是你的智能助手，可以陪你聊天、回答问题、提供帮助
              </p>
              
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  '你好，请介绍一下自己',
                  '我今天心情不太好',
                  '帮我写一首诗',
                  '推荐一些学习方法'
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
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
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
                <div className="bg-white border border-gray-200 px-5 py-3 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm">AI 正在思考...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息... (按 Enter 发送)"
            disabled={isLoading}
            className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100"
            maxLength={2000}
          />
          
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg"
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

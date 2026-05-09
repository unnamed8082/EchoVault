'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type AppMode = 'basic' | 'ai-chat' | 'agent';

interface ModeConfig {
  id: AppMode;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const modes: ModeConfig[] = [
  {
    id: 'basic',
    name: '基础模式',
    icon: '🌳',
    description: '情感树洞 - 私密倾诉空间',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'ai-chat',
    name: 'AI 对话',
    icon: '💬',
    description: '与 AI 智能助手交流',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'agent',
    name: '智能体',
    icon: '🤖',
    description: '多人格数字分身对话',
    color: 'from-purple-500 to-pink-500'
  }
];

export default function MainAppPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentMode, setCurrentMode] = useState<AppMode>('basic');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('echovault_current_mode') as AppMode | null;
    if (savedMode && modes.some(m => m.id === savedMode)) {
      setCurrentMode(savedMode);
    }
  }, []);

  const handleModeSwitch = useCallback(async (newMode: AppMode) => {
    if (newMode === currentMode || isTransitioning) return;

    setIsTransitioning(true);
    
    try {
      localStorage.setItem('echovault_current_mode', newMode);
      setCurrentMode(newMode);
      
      setTimeout(() => {
        switch (newMode) {
          case 'basic':
            router.push('/treehole');
            break;
          case 'ai-chat':
            router.push('/chat/ai-assistant');
            break;
          case 'agent':
            router.push('/agent/select');
            break;
        }
        setIsTransitioning(false);
      }, 300);
    } catch (error) {
      console.error('模式切换失败:', error);
      setIsTransitioning(false);
    }
  }, [currentMode, isTransitioning, router]);

  const renderContent = () => {
    if (isTransitioning) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
            <p className="text-gray-600">切换中...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
          <div className="text-center max-w-md">
            <div className={`text-6xl mb-6 animate-bounce`}>
              {modes.find(m => m.id === currentMode)?.icon}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {modes.find(m => m.id === currentMode)?.name}
            </h2>
            <p className="text-gray-600 mb-6">
              {modes.find(m => m.id === currentMode)?.description}
            </p>
            <button
              onClick={() => {
                switch (currentMode) {
                  case 'basic':
                    router.push('/treehole');
                    break;
                  case 'ai-chat':
                    router.push('/chat/ai-assistant');
                    break;
                  case 'agent':
                    router.push('/agent/select');
                    break;
                }
              }}
              className={`
                px-8 py-3 rounded-xl text-white font-medium
                bg-gradient-to-r ${modes.find(m => m.id === currentMode)?.color}
                hover:shadow-lg transform hover:scale-105 active:scale-95
                transition-all duration-200
              `}
            >
              进入 {modes.find(m => m.id === currentMode)?.name}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-lg border border-gray-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-40
        w-72 bg-gradient-to-b from-gray-900 to-gray-800
        text-white transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span>🔐</span>
            <span>EchoVault</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">隐私至上的 AI 数字陪伴</p>
        </div>

        {/* Mode Switcher */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            模式选择
          </div>
          
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                handleModeSwitch(mode.id);
                setSidebarOpen(false);
              }}
              disabled={isTransitioning}
              className={`
                w-full text-left px-4 py-3 rounded-xl
                transition-all duration-200 transform
                flex items-center gap-3 group
                ${currentMode === mode.id
                  ? 'bg-white/20 text-white shadow-lg scale-105'
                  : 'hover:bg-white/10 text-gray-300 hover:text-white hover:scale-102'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <span className={`text-2xl transition-transform duration-200 ${currentMode === mode.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                {mode.icon}
              </span>
              <div className="flex-1">
                <div className="font-medium">{mode.name}</div>
                <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {mode.description}
                </div>
              </div>
              {currentMode === mode.id && (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button
            onClick={() => router.push('/settings')}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm flex items-center gap-2"
          >
            <span>⚙️</span>
            <span>设置</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm flex items-center gap-2"
          >
            <span>🏠</span>
            <span>返回首页</span>
          </button>
          <div className="text-xs text-gray-500 text-center pt-2">
            v1.0.0 · 本地存储
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="lg:hidden w-10" />
          <h2 className="text-lg font-semibold text-gray-900">
            {modes.find(m => m.id === currentMode)?.name || 'EchoVault'}
          </h2>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${modes.find(m => m.id === currentMode)?.color} text-white`}>
              {modes.find(m => m.id === currentMode)?.name}
            </span>
          </div>
        </header>

        {/* Content Area */}
        {renderContent()}
      </main>
    </div>
  );
}

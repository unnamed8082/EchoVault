'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

interface CardData {
  id: string;
  icon: string;
  title: string;
  description: string;
  href: string;
  color: string;
}

const cards: CardData[] = [
  {
    id: 'treehole',
    icon: '🌳',
    title: '情感树洞',
    description: '安全记录你的情感记忆，保护隐私，绝不泄露',
    href: '/treehole',
    color: 'from-green-50 to-emerald-50 border-green-200 hover:border-green-400'
  },
  {
    id: 'distill',
    icon: '🧠',
    title: '人格蒸馏',
    description: '基于聊天记录，智能蒸馏专属人格模型',
    href: '/distill',
    color: 'from-purple-50 to-pink-50 border-purple-200 hover:border-purple-400'
  },
  {
    id: 'models',
    icon: '🤖',
    title: '多模型支持',
    description: '支持 DeepSeek、GLM、Kimi 等主流大模型',
    href: '/settings',
    color: 'from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400'
  }
];

export default function HomePage() {
  const router = useRouter();
  const { username } = useAuth();
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [pressedCard, setPressedCard] = useState<string | null>(null);

  const handleCardClick = useCallback((cardId: string, href: string) => {
    setActiveCard(cardId);
    
    setTimeout(() => {
      router.push(href);
    }, 150);
  }, [router]);

  const handleCardMouseDown = useCallback((cardId: string) => {
    setPressedCard(cardId);
  }, []);

  const handleCardMouseUp = useCallback(() => {
    setPressedCard(null);
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    setPressedCard(null);
  }, []);

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
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id, card.href)}
              onMouseDown={() => handleCardMouseDown(card.id)}
              onMouseUp={handleCardMouseUp}
              onMouseLeave={handleCardMouseLeave}
              onTouchStart={() => handleCardMouseDown(card.id)}
              onTouchEnd={() => {
                handleCardMouseUp();
                handleCardClick(card.id, card.href);
              }}
              className={`
                bg-gradient-to-br ${card.color}
                rounded-2xl shadow-xl p-6 border-2 cursor-pointer
                transition-all duration-200 ease-out
                transform active:scale-[0.98] hover:scale-[1.02] hover:shadow-2xl
                ${pressedCard === card.id ? 'scale-[0.97] shadow-inner' : ''}
                ${activeCard === card.id ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                select-none
              `}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(card.id, card.href);
                }
              }}
            >
              <div className={`text-4xl mb-4 transform transition-transform duration-200 ${pressedCard === card.id ? 'scale-110' : ''}`}>
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {card.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {card.description}
              </p>
              <div className="mt-4 flex items-center text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span>点击进入</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/app"
              className="
                inline-block bg-gradient-to-r from-indigo-600 to-purple-600
                text-white px-10 py-4 rounded-xl text-lg font-medium
                hover:from-indigo-700 hover:to-purple-700
                transition-all duration-200 shadow-lg hover:shadow-xl
                no-underline transform hover:scale-105 active:scale-95
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              "
            >
              🚀 进入 EchoVault 主界面
            </Link>

            {!username && (
              <>
                <Link
                  href="/login"
                  className="
                    inline-block bg-white text-indigo-600 border-2 border-indigo-200
                    px-8 py-4 rounded-xl text-lg font-medium
                    hover:border-indigo-400 hover:bg-indigo-50
                    transition-all duration-200 shadow-md hover:shadow-lg
                    no-underline transform hover:scale-105 active:scale-95
                  "
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="
                    inline-block bg-white text-purple-600 border-2 border-purple-200
                    px-8 py-4 rounded-xl text-lg font-medium
                    hover:border-purple-400 hover:bg-purple-50
                    transition-all duration-200 shadow-md hover:shadow-lg
                    no-underline transform hover:scale-105 active:scale-95
                  "
                >
                  注册
                </Link>
              </>
            )}
          </div>

          <div className="pt-2">
            <Link
              href="/treehole"
              className="
                inline-block text-gray-500 hover:text-gray-700
                transition-colors text-sm font-medium
              "
            >
              或直接使用树洞功能（无需登录）→
            </Link>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500 space-y-2">
          <p>提示：访问 /treehole 进入情感树洞</p>
          <p>访问 /distill 进入人格蒸馏功能</p>
          <p>访问 /settings 配置 AI 模型</p>
        </div>
      </div>
    </div>
  );
}

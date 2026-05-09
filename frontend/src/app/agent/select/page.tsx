'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getJSON, setJSON } from '../../../lib/storage';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  description: string;
  personality: string[];
  color: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

const STORAGE_KEY_AGENTS = 'echovault_agents';
const STORAGE_KEY_CHAT = 'echovault_agent_chat_';

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

export default function AgentSelectPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const savedAgents = await getJSON<Agent[]>(STORAGE_KEY_AGENTS, []);
      if (savedAgents && savedAgents.length > 0) {
        setAgents(savedAgents);
      }
    } catch (error) {
      console.error('加载智能体失败:', error);
    } finally {
      setLoaded(true);
    }
  };

  const handleSelectAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setTimeout(() => {
      router.push(`/agent/chat/${agent.id}`);
    }, 200);
  }, [router]);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        let parsedData: any;

        if (file.name.endsWith('.json')) {
          parsedData = JSON.parse(content);
        } else if (file.name.endsWith('.txt') || file.name.endsWith('.html')) {
          parsedData = parseTextContent(content);
        }

        if (parsedData && parsedData.messages) {
          const newAgent: Agent = {
            id: `imported_${Date.now()}`,
            name: parsedData.name || file.name.replace(/\.[^/.]+$/, ''),
            avatar: '📱',
            description: `从 ${file.name} 导入的聊天记录`,
            personality: ['基于真实对话', '个性化特征', '学习型'],
            color: 'from-green-500 to-teal-500'
          };

          const updatedAgents = [...agents, newAgent];
          await setJSON(STORAGE_KEY_AGENTS, updatedAgents);
          await setJSON(`${STORAGE_KEY_CHAT}${newAgent.id}`, parsedData.messages);
          setAgents(updatedAgents);
          
          alert(`成功导入 ${parsedData.messages.length} 条聊天记录`);
          setShowImport(false);
        }
      } catch (error) {
        console.error('文件解析失败:', error);
        alert('文件格式不支持或解析失败');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  }, [agents]);

  const parseTextContent = (content: string): { messages: any[]; name?: string } => {
    const lines = content.split('\n').filter(line => line.trim());
    const messages: any[] = [];
    
    lines.forEach((line, index) => {
      if (line.includes(':')) {
        const [role, ...contentParts] = line.split(':');
        const messageContent = contentParts.join(':').trim();
        
        if (messageContent) {
          messages.push({
            id: `${index}`,
            role: role.toLowerCase().includes('我') || role.includes('User') ? 'user' : 'agent',
            content: messageContent,
            timestamp: Date.now() - (lines.length - index) * 1000
          });
        }
      }
    });

    return { messages };
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <div className="text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <span>🤖</span>
            选择你的数字分身
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            每个智能体都有独特的人格和交流风格，选择最适合你当前需求的一个
          </p>
        </div>

        {/* Import Button */}
        <div className="mb-8 flex justify-center gap-4">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-6 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all text-gray-700 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            导入聊天记录
          </button>

          {showImport && (
            <label className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl cursor-pointer hover:from-purple-600 hover:to-pink-600 transition-all font-medium flex items-center gap-2">
              <input
                type="file"
                accept=".txt,.json,.html"
                onChange={handleFileImport}
                className="hidden"
              />
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              选择文件
            </label>
          )}
        </div>

        {/* Agents Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => handleSelectAgent(agent)}
              className="
                bg-white rounded-2xl shadow-lg p-6 border-2 border-transparent
                cursor-pointer transform transition-all duration-300
                hover:scale-105 hover:shadow-2xl hover:border-purple-200
                active:scale-95 group relative overflow-hidden
              "
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${agent.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              <div className="relative z-10">
                {/* Avatar */}
                <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${agent.color} rounded-full flex items-center justify-center text-4xl shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300`}>
                  {agent.avatar}
                </div>

                {/* Name & Description */}
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2 group-hover:text-purple-700 transition-colors">
                  {agent.name}
                </h3>
                <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
                  {agent.description}
                </p>

                {/* Personality Tags */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {agent.personality.map((trait) => (
                    <span
                      key={trait}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors"
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {/* Action Hint */}
                <div className="mt-4 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-sm font-medium text-purple-600">点击开始对话 →</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>💡</span>
            如何使用智能体？
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">1️⃣ 选择智能体</h3>
              <p>根据当前心情和需求，选择最合适的智能体人格</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">2️⃣ 开始对话</h3>
              <p>每个智能体都有独特的交流方式和回应风格</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">3️⃣ 导入记录（可选）</h3>
              <p>支持从微信、QQ等平台导入聊天记录，创建专属分身</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <strong>提示：</strong>
            导入的聊天记录仅用于生成个性化智能体，所有数据存储在本地设备，我们无法访问。
          </div>
        </div>
      </div>
    </div>
  );
}

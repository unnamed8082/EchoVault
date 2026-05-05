# EchoVault - 隐私至上的 AI 数字陪伴

EchoVault 是一款开源的情感树洞 + 人格蒸馏应用。支持用户自主选择大模型（GLM/DeepSeek/千问/Kimi/小米MiMo/本地Ollama），自主提供 API Key，所有数据端侧脱敏，绝不上传原始隐私。

## ✨ 核心功能

- 🌳 匿名树洞倾诉
- 🫂 AI 情感陪伴（可选）
- 🧠 上传聊天记录 → 蒸馏人格 → 生成数字分身对话
- 🔄 支持多种大模型，用户自选，费用透明
- 🔒 端侧脱敏 + 加密存储 API Key

## 🚀 快速开始

### 方式一：一键启动脚本（推荐）

**Windows PowerShell：**
```powershell
.\start_dev.ps1
```

**Linux/Mac：**
```bash
chmod +x start_dev.sh
./start_dev.sh
```

### 方式二：手动启动

**1. 环境准备：**
- Node.js >= 20
- Python >= 3.9

**2. 配置环境：**
```bash
# 复制并编辑环境变量
cp .env.example .env
# Windows: Copy-Item .env.example .env

# 填入密钥（可选使用默认值用于开发）
```

**3. 启动后端：**
```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v  # 运行测试（可选）
python -m uvicorn src.main:app --host 0.0.0.0 --port 9000 --reload
```

**4. 启动前端（新终端）：**
```bash
cd frontend
npm install
npm run dev
```

**5. 访问应用：**
- 前端: http://localhost:3000
- 后端 API: http://localhost:9000
- 文档: http://localhost:9000/docs

### 方式三：Docker

```bash
docker-compose up -d
```

## 📋 页面路由

| 路由 | 功能 |
|------|------|
| `/` | 首页 - 功能介绍 |
| `/distill` | 人格蒸馏 - 创建 Skill |
| `/chat/[skillId]` | 对话 - 与数字分身聊天 |
| `/settings` | 设置 - LLM 模型配置 |

## 🤖 支持的模型

| 供应商       | 模型 ID          | 费用 (每1K tokens)     |
| :-------- | :------------- | :------------------ |
| DeepSeek  | deepseek-chat  | ¥0.001(入)/¥0.002(出) |
| 智谱 GLM    | glm-4-flash    | ¥0.001/¥0.001       |
| Kimi      | moonshot-v1-8k | ¥0.012/¥0.012       |
| 通义千问      | qwen-turbo     | ¥0.008/¥0.008       |
| 小米 MiMo   | mimo-v2.5      | 申请 Token Plan 后免费   |
| Ollama 本地 | qwen2.5:7b     | 免费                  |

## 🔐 隐私设计

所有文本数据仅在浏览器 IndexedDB 存储，上传到服务器前已完成 PII 脱敏和统计向量化。用户提供的 API Key 经 AES-256-GCM 加密后存于服务器，密钥不在前端留存。

## 🧪 测试

**后端测试（49 个）：**
```bash
cd backend
python -m pytest tests/ -v
```

**前端测试（31 个）：**
```bash
cd frontend
npm test
```

**E2E 测试：**
```bash
cd frontend
npm run test:e2e
```

## 📚 文档

- 部署指南: [docs/deployment.md](./docs/deployment.md)
- 生产环境配置: [docs/production-guide.md](./docs/production-guide.md)
- 架构设计: [docs/architecture.md](./docs/architecture.md)
- 隐私设计: [docs/privacy_design.md](./docs/privacy_design.md)
- 多模型指南: [docs/multi_llm_guide.md](./docs/multi_llm_guide.md)

## 🔧 项目结构

```
EchoVault/
├── backend/           # FastAPI 后端
│   ├── src/api/       # API 路由
│   ├── src/llm/       # LLM 适配器
│   └── tools/         # 工具脚本
├── frontend/          # Next.js 前端
│   ├── src/app/       # 页面
│   ├── src/components/# 组件
│   └── e2e/           # E2E 测试
├── docs/              # 文档
└── docker-compose.yml # Docker 配置
```

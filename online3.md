EchoVault 零成本上线技术决策方案

1\. 数据访问层抽象设计图（Repository 模式）

迁移路径

text

当前状态                        目标状态

┌─────────────────┐            ┌──────────────────────┐

│  原生 sqlite3    │            │   SQLAlchemy Core     │

│  硬编码 SQL      │  ──────→  │   + asyncpg 驱动      │

│  routes 中散落   │            │   Repository 模式封装  │

└─────────────────┘            └──────────────────────┘

2\. 流式响应改动清单

涉及文件共 6 个：



文件	改动量	改动内容

src/llm/adapters/deepseek.py	\~20 行	增加 chat\_stream() 生成器方法

src/llm/adapters/mimo.py	\~20 行	同上

src/llm/adapters/kimi.py	\~20 行	同上

src/llm/base.py	\~10 行	增加 chat\_stream() 抽象方法

src/api/routes\_chat.py	\~30 行	路由改为返回 StreamingResponse

frontend/.../chat/page.tsx	\~40 行	用 fetch + ReadableStream 读取 SSE

总改动量：约 140 行新增代码。适配器改动模式完全相同，可批量复制。



适配器示例（deepseek.py）

python

from typing import AsyncGenerator



async def chat\_stream(self, messages: list, temperature=0.7, max\_tokens=2048) -> AsyncGenerator\[str, None]:

&#x20;   response = await self.async\_client.chat.completions.create(

&#x20;       model=self.\_model,

&#x20;       messages=messages,

&#x20;       temperature=temperature,

&#x20;       max\_tokens=max\_tokens,

&#x20;       stream=True,

&#x20;   )

&#x20;   async for chunk in response:

&#x20;       if chunk.choices\[0].delta.content:

&#x20;           yield chunk.choices\[0].delta.content

后端路由改动（routes\_chat.py）

python

from fastapi.responses import StreamingResponse



@router.post("/chat/stream")

async def chat\_stream(req: ChatRequest):

&#x20;   async def event\_generator():

&#x20;       async for token in llm\_client.chat\_stream(req.messages):

&#x20;           yield f"data: {token}\\n\\n"

&#x20;       yield "data: \[DONE]\\n\\n"

&#x20;   

&#x20;   return StreamingResponse(event\_generator(), media\_type="text/event-stream")

前端消费

tsx

const response = await fetch('/api/chat/stream', { 

&#x20;   method: 'POST', 

&#x20;   body: JSON.stringify({ messages }) 

});

const reader = response.body!.getReader();

const decoder = new TextDecoder();

while (true) {

&#x20;   const { done, value } = await reader.read();

&#x20;   if (done) break;

&#x20;   const text = decoder.decode(value);

&#x20;   // 逐字追加到聊天界面

&#x20;   appendToChat(text);

}

3\. 冷启动平台的最新信息

各免费平台现状对比：



平台	免费额度	休眠？	适合本项目？

Fly.io	已取消免费层（2024/10起新用户全付费）	无休眠	❌ 已不可用

Railway	$5 免费额度/月	无休眠	✅ 首选

Render	750h/月	15min休眠	✅ 可用（接受冷启动）

Koyeb	1 免费实例 (512MB/0.1vCPU)	数据库仅5h/月	⚠️ 适合纯后端

决策：



如果追求零成本和最小折腾，接受 Render 的冷启动（首次打开等 30-60s，之后正常）。



如果冷启动不可接受，切换至 Railway 的 $5 免费额度基本够用。



4\. PWA 实现方案更新

官方推荐方案已更新为 @serwist/next（替代 next-pwa）。



安装与配置

bash

npm install @serwist/next

javascript

// next.config.js

const withSerwist = require('@serwist/next').default({

&#x20;   swSrc: 'src/app/sw.ts',

&#x20;   swDest: 'public/sw.js',

&#x20;   cacheOnFrontEndNav: true,

&#x20;   reloadOnOnline: true,

});



module.exports = withSerwist({ /\* 原有配置 \*/ });

Service Worker 文件（src/app/sw.ts）

typescript

import { defaultCache } from '@serwist/next/worker';

import type { PrecacheEntry } from '@serwist/precaching';



declare const self: ServiceWorkerGlobalScope;



self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', () => self.clients.claim());

defaultCache();

支持离线 API 缓存（对话历史）

typescript

import { NetworkFirst, registerRoute } from 'serwist';



registerRoute(

&#x20;   ({ url }) => url.pathname.startsWith('/api/chat/'),

&#x20;   new NetworkFirst({ 

&#x20;       cacheName: 'chat-cache', 

&#x20;       expiration: { maxEntries: 50 } 

&#x20;   })

);

5\. Capacitor 作为移动端首选方案

核心流程

Next.js 导出静态文件 → Capacitor 打包为原生 WebView。



bash

\# 1. 配置静态导出（next.config.js）

const nextConfig = {

&#x20;   output: 'export',  # 开启静态导出

&#x20;   images: { unoptimized: true },

&#x20;   distDir: 'out',

};



\# 2. 构建并安装 Capacitor

npm run build

npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

npx cap init EchoVault com.echovault.app --web-dir=out

npx cap add android

npx cap add ios

npx cap sync



\# 3. 用 Android Studio / Xcode 打开 android/ 或 ios/ 目录

\# 打包为 APK / IPA 并发布到应用商店

放弃 SSR：静态导出意味着 API Routes 不可用，后端 API 仍需部署在 Render/Railway 上，前端调用远程 API。



不想放弃 SSR：可用 Capacitor 的 server.url 模式直接指向 Vercel 域名，但 App 变成纯 WebView 外壳，好处是无需每次改前端都重新打包。



6\. 完整的 CI/CD 流水线定义

创建 .github/workflows/deploy.yml：



yaml

name: CI/CD Pipeline



on:

&#x20; push:

&#x20;   branches: \[main]

&#x20; pull\_request:

&#x20;   branches: \[main]



jobs:

&#x20; # 1. 后端测试（Python）

&#x20; test-backend:

&#x20;   runs-on: ubuntu-latest

&#x20;   defaults:

&#x20;     run:

&#x20;       working-directory: backend

&#x20;   steps:

&#x20;     - uses: actions/checkout@v4

&#x20;     - uses: actions/setup-python@v5

&#x20;       with:

&#x20;         python-version: '3.12'

&#x20;         cache: 'pip'

&#x20;     - run: pip install -r requirements-dev.txt

&#x20;     - run: pytest tests/ -v --cov=src --cov-report=term-missing



&#x20; # 2. 前端测试（Node.js）

&#x20; test-frontend:

&#x20;   runs-on: ubuntu-latest

&#x20;   defaults:

&#x20;     run:

&#x20;       working-directory: frontend

&#x20;   steps:

&#x20;     - uses: actions/checkout@v4

&#x20;     - uses: actions/setup-node@v4

&#x20;       with:

&#x20;         node-version: '20'

&#x20;         cache: 'npm'

&#x20;     - run: npm ci

&#x20;     - run: npm run lint

&#x20;     - run: npm test -- --watchAll=false



&#x20; # 3. 安全扫描

&#x20; security-scan:

&#x20;   runs-on: ubuntu-latest

&#x20;   steps:

&#x20;     - uses: actions/checkout@v4

&#x20;     - name: Run Trivy vulnerability scanner

&#x20;       uses: aquasecurity/trivy-action@master

&#x20;       with:

&#x20;         scan-type: fs

&#x20;         scan-ref: .

&#x20;         severity: HIGH,CRITICAL

&#x20;     - name: CodeQL Analysis

&#x20;       uses: github/codeql-action/analyze@v3



&#x20; # 4. 构建 Docker 镜像

&#x20; build-and-push:

&#x20;   needs: \[test-backend, test-frontend, security-scan]

&#x20;   if: github.ref == 'refs/heads/main'

&#x20;   runs-on: ubuntu-latest

&#x20;   steps:

&#x20;     - uses: actions/checkout@v4

&#x20;     - name: Build Docker image

&#x20;       run: |

&#x20;         docker build -t echovault-backend ./backend

&#x20;         docker tag echovault-backend ghcr.io/${{ github.repository }}/backend:${{ github.sha }}

&#x20;     - name: Push to GHCR

&#x20;       run: |

&#x20;         echo "${{ secrets.GITHUB\_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

&#x20;         docker push ghcr.io/${{ github.repository }}/backend:${{ github.sha }}

依赖关系：build-and-push 需要前三项全部通过。部署触发由 Render/Railway 按平台设定的分支自动完成。



7\. AI 合规要求

EchoVault 属于 AI 拟人化互动服务，需满足三层合规：



一、《生成式人工智能服务管理暂行办法》基础合规

算法备案（上线前）



安全评估（省级网信部门）



数据合规（训练数据不含个人信息）



用户实名（手机号/身份证认证，项目尚未实现）



二、《人工智能拟人化互动服务管理暂行办法》（2026.7.15 起施行）

强制可关：提供“一键直关”AI 功能入口，关闭后终止后台运行并暂停数据采集



禁止二次收费



禁止“魔改”和“数字泔水”



三、应用商店审核要点

苹果 App Store：纯对话类不涉及代码执行，不受2.5.2条款影响，审核风险较低



华为/小米等国内商店：要求出示《算法备案证明》《安全评估报告》《用户协议》《隐私政策》，必须展示算法备案号



⚠️ 最高风险：人格蒸馏（赛博永生）属于“模拟特定人物特征”，必须明确禁止用户蒸馏他人聊天记录，只允许蒸馏自己的数据或已获授权的数据，并在隐私政策中写明。否则应用商店直接拒审。



8\. 实施优先级排序

优先级	任务	预计工时	依赖	说明

P0	数据层迁移 (SQLite→SQLAlchemy)	4h	无	所有功能基础

P0	选择部署平台并验证	1h	无	优先 Render（接受冷启动），备选 Railway

P1	流式响应改造	3h	LLM 适配器已有	核心体验

P1	用户实名认证 (手机号)	2h	数据层迁移	合规硬性要求

P1	一键关闭 AI + 数据擦除	1.5h	数据层迁移	合规硬性要求（2026.7 施行）

P2	PWA + Serwist	2h	流式响应	离线缓存依赖 API 路径确定

P2	Capacitor 打包移动端	3h	PWA 完成	需先有静态导出版本

P2	隐私协议 + 授权机制 + 内容过滤	2h	无	合规硬性要求，决定审核成败

P3	CI/CD 流水线	2h	核心功能完成	自动化节省时间

P3	备案材料准备	4h+	核心功能冻结	备案周期 30-60 天，提前并行准备

P4	Sentry / 监控	1h	所有功能完成	辅助运维

P0 为基础设施，必须先完成。P2 中的合规授权是应用上架前提。P3 备案材料可与开发并行推进，未备案前不向公众开放或上架应用商店。


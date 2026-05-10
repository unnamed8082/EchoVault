🔴 P0 - 重大脱节修正

1\. 数据库迁移（SQLite → PostgreSQL）

问题确认：项目使用原生 sqlite3，硬编码 SQL，改用 Supabase PostgreSQL 需要彻底重写数据访问层。



修正方案：



渐进式重构：不用一次性全部迁移。可以先用 sqlite3 将现有数据导出为 SQL 转储（.dump），然后用 pgloader 或手动调整 SQL 语法导入 Supabase。



引入 SQLAlchemy：创建 models.py 用 SQLAlchemy ORM 重写核心表（用户、Skill、会话）。用 asyncpg 驱动保持异步。



保持兼容分支：重构完成后，保留一个 sqlite3 版本用于离线/本地测试，通过环境变量切换数据库驱动。



迁移脚本：编写 alembic 迁移脚本，自动创建表结构和索引。



立即行动：我可以为你生成一份 SQLAlchemy 模型代码和 Alembic 配置。



2\. 认证体系冲突

问题确认：已实现自定义 JWT + bcrypt，与 Supabase Auth 功能重叠。



修正方案：



保留自定义认证：Supabase Auth 可以作为可选功能，但为了降低迁移成本，建议继续使用自己的 JWT 方案。前端只需存储 token，后端自己签发和验证即可，不依赖 Supabase Auth。



Supabase 仅作数据库：Supabase 提供 PostgreSQL，我们不使用其 Auth、Storage 等捆绑服务，只把它当成一个免费的、支持 RLS 的 PostgreSQL 供应商。这样既享受免费数据库，又避免重写认证逻辑。



如果需要更安全的密钥管理：可以使用 Supabase Vault 来存储加密密钥，但这不是必须的。



立即行动：保持当前 JWT 机制，只需修改数据库连接方式即可。



3\. 文件存储（上传的聊天文件）

问题确认：Render 容器无状态，本地 data/uploads/ 重启即丢。



修正方案：



对于小型文件（<5MB）：将文件内容编码为 Base64，存入 PostgreSQL 的 BYTEA 字段。虽然不太高效，但对蒸馏场景足够（用户只上传少量聊天记录文件）。



或者使用 Supabase Storage（但注意免费 1GB 限制）：设置 RLS 策略确保用户只能访问自己的文件。



更简单的方案：蒸馏文件只是一次性上传，提取出文本后就不再需要。我们可以在文件上传后立即解析，提取纯文本，然后把文本内容存进数据库，不再保留原始文件。这样完全不需要文件存储服务。



立即行动：修改 routes\_distill.py，上传文件后立刻解析为文本，保存文本到数据库，删除本地临时文件。文件解析功能前端也可以做（选择文件后直接读成文本再发 API），进一步节省后端开销。



🟡 P1 - 技术方案补充

4\. PWA 基础设施缺失

问题确认：没有 manifest.json、Service Worker、离线缓存。



修正方案：



最小可行 PWA：添加一个 manifest.json 和简单的 Service Worker。至少支持“添加到主屏幕”和基本离线缓存。



使用 next-pwa 插件：npm install next-pwa，在 next.config.js 中配置即可自动生成 SW 和 manifest。可以快速实现离线访问和安装提示。



Manifest 文件：我在第一次代码中已经提供了 public/manifest.json 的示例，可以直接使用。



立即行动：集成 next-pwa，配置静态资源缓存策略。离线消息缓存可稍后实现。



5\. 流式响应缺失

问题确认：同步调用 LLM API，无打字机效果。



修正方案：



后端改为 SSE：FastAPI 中使用 StreamingResponse 和 async 生成器。



修改适配器：在 deepseek.py 等适配器中，增加 stream=True 参数，返回一个生成器，然后将每个 chunk 通过 SSE 推送给前端。



前端处理：使用 EventSource 或 fetch 读取流式响应。



Vercel 免费 Edge Functions 支持流式响应（有 10s 超时），但 Render 的免费实例也支持 WebSocket/SSE。



立即行动：可以实现一个通用的流式代理。我可以提供 FastAPI 流式示例。



6\. Render 冷启动

问题确认：UptimeRobot 有违规风险，且不能彻底解决延迟。



修正方案：



使用 Cloudflare Workers 作为轻量代理：将最常访问的静态页面和健康检查端点缓存到 Cloudflare 的 CDN 边缘节点，用户请求直接命中缓存，不需要回源到 Render。



选择其他免费平台：Fly.io 免费层提供 3 个 256MB 实例，不会休眠；或者 Railway 的免费额度也没有休眠问题（每月 $5 额度）。



如果继续用 Render，可以接受首次访问的几秒延迟，作为一种取舍。



立即行动：推荐 Railway 或 Fly.io 替代 Render，彻底解决休眠问题。



7\. Supabase 免费额度可能不够

问题确认：500MB 存储可能紧张，免费项目 7 天暂停。



修正方案：



优化数据存储：



聊天记录压缩存储（只保留最近 N 条）。



Skill 文件（蒸馏结果）存储纯文本，不用大字段。



启用垃圾回收，定期删除匿名未登录用户的临时数据。



替代数据库：Neon (https://neon.tech) 也提供免费的 Serverless PostgreSQL，同样 500MB，但无暂停问题。可以作为 Supabase 的备选。



如果用户量真的涨到需要更大空间，那时已经可以考虑付费了（Supabase Pro $25/月）。



立即行动：先用 Supabase，同时加入数据清理策略。



🟢 P2 - 补充完善

8\. CI/CD 流水线

修正方案：



在 GitHub 仓库中添加 .github/workflows/test.yml，运行 pytest 测试。



Vercel 和 Render 都支持通过 Git 自动部署，只需在平台设置中连接仓库即可。



环境变量通过平台的后台管理界面注入，不提交到代码库。



立即行动：写一个简单的 GitHub Actions 文件。



9\. 监控

修正方案：



前端性能：Vercel Analytics（免费额度包含 Web Vitals）。



后端错误：Sentry 免费 Developer 计划。



API 监控：UptimeRobot 仅监控健康检查，不违规（5 分钟一次不构成滥用）。



LLM 成本追踪：在数据库中新建 usage\_logs 表，每次调用后记录 token 消耗，前端展示。



10\. 合规

修正方案：



编写隐私政策页面，说明数据收集、存储、删除的规则。



实现“导出我的数据”和“永久删除账户”功能（已设计的擦除 Agent 可复用）。



在注册页增加同意隐私政策的复选框。



11\. 打包替代方案

修正方案：



手机 App：直接用 React Native 或 Flutter 构建一个简单的 WebView 封装，上传到应用商店，避免 PWA 壳被拒。但开发成本高。



Plan B：如果 PWA 不够，可以先用 Capacitor (Ionic) 将 Next.js 项目打包成原生壳，它比 PWABuilder 更稳定，且支持一些原生插件。



12\. 前端渲染模式

修正方案：



不要用 output: 'export'，使用 Vercel 默认的 SSR/SSG 混合模式。API 路由可以正常使用（Vercel Serverless Functions）。



免费额度：Vercel 提供 100GB 带宽和 100GB-Hrs 执行时间，对小项目足够。


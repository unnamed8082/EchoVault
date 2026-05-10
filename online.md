### 🎯 目标

将 EchoVault 从本地运行变为一个**公共网站 + 手机App + 桌面应用**，同时满足**高隐私**要求和**极低成本**。

## 1. 总体架构

用户浏览器（PWA）
↓ HTTPS
\[ Vercel ] ← 部署 Next.js 前端
↓ API 请求
\[ Render ] ← 部署 FastAPI 后端
↓
\[ Supabase ] ← 托管 PostgreSQL + 认证 + 行级安全

- **前端**：Next.js 生成的静态页面 + 客户端渲染，部署在 Vercel（免费）。
- **后端**：FastAPI Docker 容器，部署在 Render（免费额度）。
- **数据库**：Supabase 托管的 PostgreSQL，自带用户认证和行级安全策略。
- **全域 HTTPS**：Vercel 和 Render 均免费提供自动 SSL，也可绑定自定义域名后由 Cloudflare 提供免费 CDN / HTTPS。

***

## 2. 跨平台方案：PWA + 工具打包

由于预算有限，采用 **PWA（渐进式 Web 应用）** 一次开发，多处运行：

目标平台

实现方式

工具

成本

**网页**

部署到 Vercel

Vercel

¥0

**手机 App**

PWA 添加至主屏幕 / 打包 APK

PWABuilder

¥0

**桌面应用**

PWA 打包为轻量桌面程序

PakePlus

¥0

- **PWA**：用户访问网站时浏览器会弹出“安装”提示，安装后体验接近原生 App（离线访问、推送通知等）。
- **PWABuilder**：在线填入网址，自动生成 Android APK 包。
- **PakePlus**：同样在线服务，一键打包为 Windows/macOS/Linux 桌面应用，体积仅几 MB。

***

## 3. 隐私保护设计

### 3.1 传输层加密

- 全站启用 HTTPS，由 Vercel/Render 自动签发 Let's Encrypt 证书。
- 若绑定域名，可通过 Cloudflare 代理获得更强的 DDoS 防护和 SSL 加速。

### 3.2 数据静态加密

- Supabase 中的数据默认在磁盘加密存储。
- 用户提供的第三方 API Key **绝不存储明文**：
  - 后端收到 Key 后，用 AES-256-GCM 加密，密钥仅保存在服务器环境变量（`ENC_KEY`）。
  - 即使数据库泄露，也无法解密 Key。

### 3.3 端侧加密（最高级别隐私）

对于对话内容，可实现**零知识架构**：

- 用户在浏览器端输入一个“会话密钥”或由密码派生密钥。
- 所有聊天记录在**浏览器内**先用该密钥加密，再上传到服务器和数据库。
- 服务器只存储密文，无法解读用户对话内容。
- 密钥仅用户自己持有，平台方也无法查看。

### 3.4 数据库隔离

- 使用 Supabase 的 **Row Level Security (RLS)** 策略，确保用户 A 无法访问用户 B 的数据。
- 即使 SQL 注入漏洞被利用，RLS 也能在数据库层面拦截越权访问。

***

## 4. 部署步骤（详细路线图）

### 第一步：注册域名（仅此花费 20 元）

- 在阿里云 / 腾讯云 / Namesilo 等注册一个便宜域名，如 `echovault.xyz`（约 ¥20/年）。
- 购买后暂不解析，全部操作结束后再绑定。

### 第二步：准备数据库 (Supabase)

1. 注册 [Supabase](https://supabase.com/) 免费账号。
2. 创建一个新项目，获得数据库连接 URL 和 API 密钥。
3. 在项目中启用 Email 认证（或其他方式），并配置 RLS 策略。
4. 在本地通过 Supabase CLI 或 SQL 管理工具初始化数据表。

### 第三步：部署后端 (FastAPI)

1. 确保你的后端项目已经添加了 Dockerfile，并可以通过 `docker build` 成功运行。
2. 将代码推送到 GitHub 仓库。
3. 登录 [Render](https://render.com/)，新建 Web Service，连接你的仓库。
4. 设置环境变量：
   - `DATABASE_URL`：Supabase 的 PostgreSQL 连接字符串。
   - `SECRET_KEY`：JWT 签名密钥。
   - `ENC_KEY`：用于加密用户 API Key 的主密钥。
   - `MIMO_API_KEY`：你的小米 Token Plan 密钥。
5. Render 会自动构建 Docker 镜像并启动服务，并提供 `https://你的服务名.onrender.com` 的域名。

### 第四步：部署前端 (Next.js)

1. 确保前端代码中 API 请求的 base URL 指向 Render 提供的地址。
2. 在 `next.config.js` 中添加 `output: 'export'`（如果采用静态导出）或直接使用 Vercel 的 SSR 支持。
3. 将前端代码推送到 GitHub（可放在同一仓库的 `/frontend` 目录）。
4. 登录 [Vercel](https://vercel.com/)，导入该仓库，设置构建目录为 `/frontend`。
5. 设置环境变量 `NEXT_PUBLIC_API_URL` 为 Render 后端地址。
6. Vercel 自动构建并分配 `*.vercel.app` 域名。

### 第五步：绑定自定义域名 + 开启 HTTPS

1. 在域名管理后台，将域名的 CNAME 记录指向 Vercel 提供的地址（如 `cname.vercel-dns.com`）。
2. 在 Vercel 项目设置中，添加自定义域名，Vercel 会自动签发 SSL 证书。
3. 后端如果需要自定义域名，可以通过 Cloudflare Workers 反向代理，或者直接使用 Render 提供的免费域名。

### 第六步：打包移动端和桌面端

- **手机 App**：
  1. 访问 [PWABuilder](https://www.pwabuilder.com/)。
  2. 输入你的网站网址（例如 `https://echovault.xyz`）。
  3. 网站会生成下载包。选择 Android，填写应用名和包名，生成 APK。
  4. 用户可直接下载安装。
- **桌面应用**：
  1. 访问 [PakePlus](https://www.pakeplus.com/)。
  2. 输入网站网址，选择平台（Windows/macOS）。
  3. 提供你的 GitHub Token（用于自动上传发布到 GitHub Release）。
  4. 等待几分钟，下载打包好的应用程序。

### 第七步：监控与备份

- **错误监控**：在 Render 和 Vercel 面板中查看日志；或者集成免费的 Sentry 账号绑定你的后端。
- **数据库备份**：Supabase 提供每7天的自动备份，你也可以在数据库管理面板手动导出，定期下载到本地。

***

## 5. 预算分配

项目

费用

说明

域名 (`echovault.xyz`)

¥20/年

唯一实际开销

前端托管 (Vercel)

¥0

100GB 带宽/月

后端托管 (Render)

¥0

750小时/月（不活动会休眠，可用 UptimeRobot 免费监控保持唤醒）

数据库 (Supabase)

¥0

500MB 存储，50万行数据

SSL 证书

¥0

自动签发

PWA 打包移动端

¥0

PWABuilder 免费

桌面应用打包

¥0

PakePlus 免费

**总计**

**¥20/年**

**约 ¥1.7/月**

***

## 6. 注意事项

- Render 免费实例在 15 分钟无流量后会休眠，首次唤醒需要几十秒。可以通过 [UptimeRobot](https://uptimerobot.com/)（免费）每5分钟 ping 一次你的后端健康检查接口，防止休眠。
- 如果后续流量增长超出免费额度，可随时升级为付费方案，或迁移到国内云厂商的低配服务器（约 ¥50/月），但现阶段完全够用。
- 隐私方面，要特别告知用户：他们使用的第三方模型 API Key 只存储在你们的服务器加密保存，对话内容可选择端到端加密（需要用户输入密码），这样即使平台方也无法查看。


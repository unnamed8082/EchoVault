# EchoVault Docker 部署指南

## 架构概览

```
┌──────────────────────────────────────────────┐
│                   Nginx (80/443)              │
│              HTTPS 终端 / 反向代理            │
└──────┬───────────────────────┬───────────────┘
       │                       │
       ▼                       ▼
┌──────────────┐       ┌──────────────┐
│  Frontend    │       │   Backend    │
│  Next.js     │──────▶│   FastAPI    │
│  :3000       │       │   :9000      │
└──────────────┘       └──────┬───────┘
                              │
                              ▼
                       ┌──────────────┐
                       │   SQLite     │
                       │   (Volume)   │
                       └──────────────┘
```

## 快速部署（开发环境）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入安全密钥

# 2. 启动所有服务
docker compose up -d

# 3. 查看服务状态
docker compose ps

# 4. 查看日志
docker compose logs -f
```

访问地址：
- 前端: http://localhost:3000
- API 文档: http://localhost:9000/docs
- 健康检查: http://localhost:9000/health

## 生产环境部署

### 1. 准备环境

```bash
# 生成安全密钥
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "from cryptography.fernet import Fernet; print('ENCRYPT_KEY=' + Fernet.generate_key().decode())"

# 创建 .env 文件并填入生成的密钥
cp .env.example .env
```

### 2. SSL 证书配置

```bash
# 创建 SSL 目录
mkdir -p nginx/ssl

# 使用 Let's Encrypt (推荐)
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 或使用自签名证书（仅测试）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

### 3. 修改生产配置文件

编辑 `docker-compose.prod.yml`：
- 替换 `your-domain.com` 为实际域名
- 调整资源限制（CPU/内存）

### 4. 启动生产环境

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 服务管理

### 停止服务

```bash
# 停止但不删除容器
docker compose stop

# 停止并删除容器、网络
docker compose down
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 数据备份

```bash
# 查看数据卷位置
docker volume inspect echovault_echo_data

# 备份 SQLite 数据库
docker compose exec api cp /app/data/echovault.db /app/data/echovault.db.bak
```

## 监控和日志

### 查看实时日志

```bash
# 所有服务
docker compose logs -f

# 仅 API 服务
docker compose logs -f api

# 仅前端
docker compose logs -f frontend
```

### 健康检查

```bash
# 检查所有容器状态
docker compose ps

# 手动 API 健康检查
curl http://localhost:9000/health
```

## Dockerfile 说明

### 后端 (backend/Dockerfile)

- 基础镜像: `python:3.12-slim`
- 安装依赖后复制源代码
- 暴露端口 9000
- 内置健康检查: `curl /health`

### 前端 (frontend/Dockerfile)

- 多阶段构建: deps → builder → runner
- builder 阶段编译 Next.js standalone 输出
- runner 阶段使用最小镜像运行
- 非 root 用户 `nextjs` 运行
- 内置健康检查

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| 端口冲突 | `docker compose down` 后重试 |
| 数据库锁 | 重启 API 容器: `docker compose restart api` |
| 前端构建失败 | 检查 Node.js 版本 (≥22) |
| API 500 错误 | 检查 `.env` 密钥是否正确配置 |

## CI/CD 集成 (GitHub Actions 示例)

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/echovault
            git pull
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

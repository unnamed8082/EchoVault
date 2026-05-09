# EchoVault 生产环境配置指南

## 服务器要求

| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 4 GB |
| 磁盘 | 10 GB | 50 GB SSD |
| 系统 | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 |
| Docker | 24.0+ | 28.0+ |
| Docker Compose | 2.20+ | 2.30+ |

## 安全配置

### 操作系统安全

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 配置防火墙
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 安装 fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

### 密钥管理

**绝对不要将密钥提交到版本控制！**

```bash
# 生成所有需要的密钥
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
ENCRYPT_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

echo "SECRET_KEY=${SECRET_KEY}" >> .env
echo "ENCRYPT_KEY=${ENCRYPT_KEY}" >> .env

# 限制权限
chmod 600 .env
```

### HTTPS 配置

使用 Let's Encrypt 自动获取免费证书：

```yaml
# 添加 certbot 服务到 docker-compose.prod.yml
certbot:
  image: certbot/certbot
  volumes:
    - ./nginx/ssl:/etc/letsencrypt
    - ./certbot-www:/var/www/certbot
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

### CORS 配置

生产环境必须限制来源：

```env
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

## 性能优化

### 后端优化

```env
# 调整 uvicorn worker 数量（通常为 CPU 核数的 2-4 倍）
WEB_CONCURRENCY=4
```

在 Dockerfile 中修改启动命令：

```dockerfile
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "9000", "--workers", "4"]
```

### 前端优化

Next.js 已启用以下优化：

- **静态页面生成 (SSG)**: 首页自动静态化
- **Gzip 压缩**: Nginx 配置已包含
- **资源缓存**: 静态资源带哈希缓存

### Nginx 缓存配置

```nginx
# 静态资源缓存 30 天
location /_next/static {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# API 不缓存
location /api/ {
    add_header Cache-Control "no-store";
}
```

## 监控告警

### 健康检查端点

```
GET /health → {"status": "ok"}
```

### 容器资源监控

```bash
docker stats
```

### 日志聚合

使用 Docker 日志驱动：

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
```

### 推荐监控方案

- **Uptime Kuma**: 轻量级状态监控
- **Prometheus + Grafana**: 全面指标监控
- **Sentry**: 错误追踪

## 备份与恢复

### 自动备份脚本

创建 `scripts/backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/backup/echovault"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR/$DATE"

# 备份数据库
docker compose exec -T api cp /app/data/echovault.db /tmp/backup.db
docker compose cp api:/tmp/backup.db "$BACKUP_DIR/$DATE/echovault.db"

# 备份 Skills 数据
docker compose exec -T api tar -czf /tmp/skills.tar.gz -C /app/data skills versions
docker compose cp api:/tmp/skills.tar.gz "$BACKUP_DIR/$DATE/skills.tar.gz"

# 保留最近 7 天的备份
find "$BACKUP_DIR" -maxdepth 1 -mtime +7 -type d -exec rm -rf {} \;
```

添加定时任务：

```bash
# 每天凌晨 2 点备份
0 2 * * * /opt/echovault/scripts/backup.sh >> /var/log/echovault-backup.log 2>&1
```

### 恢复流程

```bash
# 1. 停止服务
docker compose down

# 2. 恢复数据库
cp /backup/echovault/YYYYMMDD_HHMMSS/echovault.db ./data/echovault.db

# 3. 恢复 Skills 数据
tar -xzf /backup/echovault/YYYYMMDD_HHMMSS/skills.tar.gz -C ./data/

# 4. 重新启动
docker compose up -d
```

## 安全检查清单

- [ ] `.env` 权限设为 600
- [ ] `SECRET_KEY` 和 `ENCRYPT_KEY` 已更换为随机值
- [ ] 防火墙已配置，仅开放必要端口
- [ ] SSL/TLS 证书已正确配置
- [ ] CORS 限制为生产域名
- [ ] 日志级别设为 WARNING 或 ERROR
- [ ] API 不暴露调试信息
- [ ] 数据库定期备份已配置
- [ ] 监控告警已设置
- [ ] 容器以非 root 用户运行

## 容器非 root 运行

前端 Dockerfile 已配置为 `nextjs` 用户运行。后端如需配置：

```dockerfile
RUN adduser --system --no-create-home appuser
USER appuser
```

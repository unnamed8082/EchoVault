# EchoVault - 技能说明

这是 EchoVault 的核心 Skill 定义文件。

## 功能

- 匿名树洞倾诉
- AI 情感陪伴
- 人格蒸馏（上传聊天记录生成数字分身）
- 多种模型支持（DeepSeek、GLM、千问、Kimi、小米 MiMo、本地 Ollama）

## 隐私设计

所有文本数据仅在浏览器 IndexedDB 存储，上传到服务器前已完成 PII 脱敏和统计向量化。用户提供的 API Key 经 AES-256-GCM 加密后存于服务器，密钥不在前端留存。

## 快速开始

参见 README.md

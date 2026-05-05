"""
EchoVault FastAPI 主入口
隐私至上的 AI 数字陪伴服务
"""

# 首先配置路径，然后再导入其他模块
import sys
from pathlib import Path
src_dir = Path(__file__).parent
sys.path.insert(0, str(src_dir))

# 现在可以安全导入
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from config import settings

# 导入路由
from api.routes_auth import router as auth_router
from api.routes_llm_config import router as models_router
from api.routes_distill import router as distill_router
from api.routes_chat import router as chat_router

# 加载环境变量
load_dotenv()

# 初始化 FastAPI
app = FastAPI(
    title="EchoVault API",
    description="""
## 概述

EchoVault 是一个隐私至上的 AI 数字陪伴服务，提供：

- 🌳 匿名树洞倾诉
- 🫂 AI 情感陪伴
- 🧠 人格蒸馏：从聊天记录中提取人格特征，创建数字分身
- 🔄 多模型支持：DeepSeek、GLM、Kimi、Qwen、MiMo、Ollama
- 🔐 数据安全：端侧脱敏、API Key 加密存储

## 主要模块

- `/api/auth` - 认证相关
- `/api/models` - LLM 配置相关
- `/api/distill` - 人格蒸馏相关
- `/api/chat` - 聊天对话相关

## 快速开始

1. 配置环境变量：复制 `.env.example` 为 `.env`
2. 启动后端：`uvicorn src.main:app --reload`
3. 访问文档：`http://localhost:9000/docs`
    """,
    version="1.0.0",
    terms_of_service="https://github.com/unnamed8082/EchoVault",
    contact={
        "name": "EchoVault Team",
        "url": "https://github.com/unnamed8082/EchoVault",
    },
    license_info={
        "name": "MIT License",
        "url": "https://github.com/unnamed8082/EchoVault/blob/main/LICENSE",
    },
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router, prefix="/api/auth", tags=["认证"])
app.include_router(models_router, prefix="/api/models", tags=["LLM配置"])
app.include_router(distill_router, prefix="/api/distill", tags=["人格蒸馏"])
app.include_router(chat_router, prefix="/api/chat", tags=["聊天对话"])


@app.get("/", summary="服务信息", description="获取服务的基本信息，包括名称、版本和文档链接")
async def root():
    """
    ## 响应示例

    ```json
    {
        "name": "EchoVault API",
        "version": "1.0.0",
        "docs": "/docs"
    }
    ```
    """
    return {
        "name": "EchoVault API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", summary="健康检查", description="检查服务是否正常运行")
async def health_check():
    """
    ## 响应示例

    ```json
    {
        "status": "ok"
    }
    ```

    ## 状态码

    - `200 OK` - 服务正常
    """
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.API_PORT, reload=True)

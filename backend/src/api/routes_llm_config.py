"""
模型配置 API 路由
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import json
import base64
from cryptography.fernet import Fernet

router = APIRouter(prefix="/api/models", tags=["models"])

# 路径配置
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_FILE = DATA_DIR / "llm_config.json"

# 确保数据目录存在
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 简单加密（生产环境应使用更安全的密钥管理）
# 使用固定密钥仅用于演示
SECRET_KEY = b"EchoVaultSecretKeyForDemo1234567890"[:32]
FERNET_KEY = base64.urlsafe_b64encode(SECRET_KEY)
cipher = Fernet(FERNET_KEY)


class ModelProvider(BaseModel):
    """模型提供商"""
    name: str
    models: List[str]
    api_key_required: bool = True
    base_url: Optional[str] = None


class ModelConfig(BaseModel):
    """模型配置"""
    provider: str = Field(..., description="提供商")
    model: str = Field(..., description="模型名称")
    api_key: Optional[str] = Field(None, description="API Key（会被加密存储）")
    base_url: Optional[str] = Field(None, description="自定义 API Base URL")
    temperature: float = Field(0.7, ge=0, le=2, description="温度")
    max_tokens: int = Field(2048, ge=1, description="最大 Token 数")


class TokenCost(BaseModel):
    """Token 费用"""
    input_cost_per_1k: float
    output_cost_per_1k: float
    currency: str = "CNY"


class ConfigResponse(BaseModel):
    """配置响应（不包含敏感信息）"""
    provider: str
    model: str
    base_url: Optional[str] = None
    temperature: float
    max_tokens: int
    has_api_key: bool = False


# 支持的模型列表
SUPPORTED_PROVIDERS = [
    ModelProvider(
        name="DeepSeek",
        models=["deepseek-chat", "deepseek-coder"],
        api_key_required=True,
        base_url="https://api.deepseek.com/v1",
    ),
    ModelProvider(
        name="GLM",
        models=["glm-4-flash", "glm-4", "glm-3-turbo"],
        api_key_required=True,
        base_url="https://open.bigmodel.cn/api/paas/v4",
    ),
    ModelProvider(
        name="Kimi",
        models=["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        api_key_required=True,
        base_url="https://api.moonshot.cn/v1",
    ),
    ModelProvider(
        name="Qwen",
        models=["qwen-turbo", "qwen-plus", "qwen-max"],
        api_key_required=True,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    ),
    ModelProvider(
        name="MiMo",
        models=["mimo-v2.5"],
        api_key_required=True,
        base_url="https://api.mimo.ai/v1",
    ),
    ModelProvider(
        name="Ollama",
        models=["qwen2.5:7b", "llama3.1:8b"],
        api_key_required=False,
        base_url="http://localhost:11434/api",
    ),
]

# 各模型的定价
MODEL_COSTS = {
    "deepseek-chat": TokenCost(input_cost_per_1k=0.001, output_cost_per_1k=0.002),
    "deepseek-coder": TokenCost(input_cost_per_1k=0.001, output_cost_per_1k=0.002),
    "glm-4-flash": TokenCost(input_cost_per_1k=0.001, output_cost_per_1k=0.001),
    "glm-4": TokenCost(input_cost_per_1k=0.1, output_cost_per_1k=0.1),
    "glm-3-turbo": TokenCost(input_cost_per_1k=0.005, output_cost_per_1k=0.005),
    "moonshot-v1-8k": TokenCost(input_cost_per_1k=0.012, output_cost_per_1k=0.012),
    "moonshot-v1-32k": TokenCost(input_cost_per_1k=0.024, output_cost_per_1k=0.024),
    "moonshot-v1-128k": TokenCost(input_cost_per_1k=0.06, output_cost_per_1k=0.06),
    "qwen-turbo": TokenCost(input_cost_per_1k=0.008, output_cost_per_1k=0.008),
    "qwen-plus": TokenCost(input_cost_per_1k=0.04, output_cost_per_1k=0.04),
    "qwen-max": TokenCost(input_cost_per_1k=0.12, output_cost_per_1k=0.12),
    "mimo-v2.5": TokenCost(input_cost_per_1k=0, output_cost_per_1k=0),
    "qwen2.5:7b": TokenCost(input_cost_per_1k=0, output_cost_per_1k=0),
    "llama3.1:8b": TokenCost(input_cost_per_1k=0, output_cost_per_1k=0),
}


def encrypt_api_key(api_key: Optional[str]) -> Optional[str]:
    """加密 API Key"""
    if not api_key:
        return None
    return cipher.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: Optional[str]) -> Optional[str]:
    """解密 API Key"""
    if not encrypted:
        return None
    try:
        return cipher.decrypt(encrypted.encode()).decode()
    except:
        return None


def load_config() -> Optional[Dict[str, Any]]:
    """从文件加载配置"""
    if not CONFIG_FILE.exists():
        return None
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 解密 API Key
        if "api_key" in data:
            data["api_key"] = decrypt_api_key(data["api_key"])
        return data
    except:
        return None


def save_config_to_file(config: Dict[str, Any]):
    """保存配置到文件"""
    data = config.copy()
    # 加密 API Key 后保存
    if "api_key" in data:
        data["api_key"] = encrypt_api_key(data["api_key"])
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/providers", response_model=List[ModelProvider], summary="列出模型提供商", description="获取所有支持的 LLM 提供商和模型列表")
async def list_providers():
    """
    ## 功能说明
    
    获取所有支持的 LLM 提供商及其可用模型列表。
    
    ## 响应示例
    
    ```json
    [
        {
            "name": "DeepSeek",
            "models": ["deepseek-chat", "deepseek-coder"],
            "api_key_required": true,
            "base_url": "https://api.deepseek.com/v1"
        },
        {
            "name": "GLM",
            "models": ["glm-4-flash", "glm-4", "glm-3-turbo"],
            "api_key_required": true,
            "base_url": "https://open.bigmodel.cn/api/paas/v4"
        }
    ]
    ```
    
    ## 支持的提供商
    
    - DeepSeek
    - GLM
    - Kimi
    - Qwen
    - MiMo
    - Ollama
    """
    return SUPPORTED_PROVIDERS


@router.get("/costs/{model}", response_model=TokenCost, summary="获取模型定价", description="获取指定模型的 Token 费用")
async def get_model_cost(model: str):
    """
    ## 功能说明
    
    获取指定模型的 Token 费用信息。
    
    ## 请求示例
    
    ```
    GET /api/models/costs/deepseek-chat
    ```
    
    ## 参数说明
    
    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | model | string | 是 | 模型名称 |
    
    ## 响应示例
    
    ```json
    {
        "input_cost_per_1k": 0.001,
        "output_cost_per_1k": 0.002,
        "currency": "CNY"
    }
    ```
    
    ## 错误码
    
    | 状态码 | 说明 |
    |--------|------|
    | 200 | 获取成功 |
    | 404 | 模型不存在 |
    """
    if model not in MODEL_COSTS:
        raise HTTPException(status_code=404, detail="Model not found")
    return MODEL_COSTS[model]


@router.post("/config", summary="保存模型配置", description="保存用户的 LLM 配置，API Key 会被加密存储")
async def save_config(config: ModelConfig):
    """
    ## 功能说明
    
    保存用户的 LLM 配置，API Key 会被加密存储。
    
    ## 请求示例
    
    ```json
    {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "api_key": "sk-...",
        "base_url": null,
        "temperature": 0.7,
        "max_tokens": 2048
    }
    ```
    
    ## 参数说明
    
    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | provider | string | 是 | 提供商名称 |
    | model | string | 是 | 模型名称 |
    | api_key | string | 否 | API Key（会被加密存储） |
    | base_url | string | 否 | 自定义 API Base URL |
    | temperature | float | 否 | 温度参数，0-2，默认 0.7 |
    | max_tokens | int | 否 | 最大 Token 数，默认 2048 |
    
    ## 响应示例
    
    ```json
    {
        "success": true,
        "message": "Config saved"
    }
    ```
    """
    config_dict = {
        "provider": config.provider,
        "model": config.model,
        "api_key": config.api_key,
        "base_url": config.base_url,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    save_config_to_file(config_dict)
    return {"success": True, "message": "Config saved"}


@router.get("/config", response_model=ConfigResponse, summary="获取模型配置", description="获取用户的 LLM 配置（不含敏感信息）")
async def get_config():
    """
    ## 功能说明
    
    获取用户的 LLM 配置，不包含敏感的 API Key 信息。
    
    ## 响应示例
    
    ```json
    {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "base_url": null,
        "temperature": 0.7,
        "max_tokens": 2048,
        "has_api_key": true
    }
    ```
    
    ## 说明
    
    - 如果没有保存的配置，返回默认配置
    - `has_api_key` 字段指示是否已配置 API Key
    """
    config = load_config()
    if not config:
        # 返回默认配置
        return ConfigResponse(
            provider="deepseek",
            model="deepseek-chat",
            base_url=None,
            temperature=0.7,
            max_tokens=2048,
            has_api_key=False,
        )
    return ConfigResponse(
        provider=config.get("provider", "deepseek"),
        model=config.get("model", "deepseek-chat"),
        base_url=config.get("base_url"),
        temperature=config.get("temperature", 0.7),
        max_tokens=config.get("max_tokens", 2048),
        has_api_key=bool(config.get("api_key")),
    )


@router.get("/config/full", summary="获取完整配置", description="获取完整的 LLM 配置（包含解密的 API Key，内部使用）")
async def get_config_full():
    """
    ## 功能说明
    
    获取完整的 LLM 配置，包含解密的 API Key。
    
    **注意：此接口仅供内部使用，包含敏感信息。**
    
    ## 响应示例
    
    ```json
    {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "api_key": "sk-...",
        "base_url": null,
        "temperature": 0.7,
        "max_tokens": 2048
    }
    ```
    """
    config = load_config()
    if not config:
        return {
            "provider": "deepseek",
            "model": "deepseek-chat",
            "api_key": None,
            "base_url": None,
            "temperature": 0.7,
            "max_tokens": 2048,
        }
    return config

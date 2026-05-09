"""
聊天 API 路由
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import sys

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools"))

from llm.factory import create_llm_client
from llm.base import LLMResponse
from skill_writer import SkillWriter

router = APIRouter(tags=["chat"])

# 路径配置
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
SKILLS_DIR = DATA_DIR / "skills"

# 初始化工具
skill_writer = SkillWriter(SKILLS_DIR, DATA_DIR / "versions")


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str = Field(..., description="角色: user, assistant, system")
    content: str = Field(..., description="内容")


class CompletionsRequest(BaseModel):
    """通用聊天补全请求（前端直接调用）"""
    provider: str = Field("deepseek", description="LLM 提供商")
    model: str = Field("deepseek-chat", description="模型名称")
    messages: List[ChatMessage] = Field(..., description="消息列表")
    max_tokens: int = Field(2048, description="最大生成 token 数")
    temperature: float = Field(0.7, description="温度")
    api_key: Optional[str] = Field(None, description="API Key")


class ChatRequest(BaseModel):
    """聊天请求"""
    slug: str = Field(..., description="Skill 的 slug")
    messages: List[ChatMessage] = Field(..., description="消息历史")
    mode: str = Field("full", description="模式: full, memory, persona, reflection")
    stream: bool = Field(False, description="是否流式响应")
    provider: str = Field("deepseek", description="LLM 提供商")
    model: str = Field("deepseek-chat", description="模型名称")
    api_key: Optional[str] = Field(None, description="API Key")


class ChatResponse(BaseModel):
    """聊天响应"""
    content: str
    model: str
    usage: Dict[str, Any] = Field(default_factory=dict)


def build_system_prompt(skill, mode: str = "full") -> str:
    """根据模式构建系统提示词"""
    persona_content = skill.persona_content or ""
    memory_content = skill.memory_content or ""
    lessons_content = skill.lessons_content or ""
    
    if mode == "persona":
        return f"""你是 {skill.metadata.name}。请根据以下人格设定进行对话：

{persona_content}

请完全代入这个角色，用该角色的语气、风格和知识背景回复用户。"""
    
    elif mode == "memory":
        return f"""你是 {skill.metadata.name}。请基于以下共同记忆进行对话：

{memory_content}

请回忆这些经历，用自然的方式与用户交流。"""
    
    elif mode == "reflection":
        return f"""你是 {skill.metadata.name}。请基于以下人格和经验教训进行对话：

{persona_content}

{lessons_content}

请在对话中体现出这些经验和成长。"""
    
    else:  # full mode
        return f"""你是 {skill.metadata.name}。请完全代入这个角色进行对话。

--- 人格设定 ---
{persona_content}

--- 共同记忆 ---
{memory_content}

--- 经验教训 ---
{lessons_content}

请用该角色的语气、风格和知识背景回复用户，自然地进行对话。"""


@router.post("/completions", summary="通用聊天补全", description="前端 AI 助手直接调用的通用聊天接口")
async def completions(request: CompletionsRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty")

    if not request.api_key:
        raise HTTPException(status_code=400, detail="API Key is required. Please configure it in Settings.")

    try:
        client = create_llm_client(
            provider=request.provider,
            model=request.model,
            api_key=request.api_key,
        )

        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        llm_response: LLMResponse = client.chat(
            messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        return {
            "id": f"chatcmpl-{int(__import__('time').time() * 1000)}",
            "content": llm_response.content,
            "model": llm_response.model,
            "provider": request.provider,
            "usage": {
                "prompt_tokens": llm_response.usage.input_tokens,
                "completion_tokens": llm_response.usage.output_tokens,
                "total_tokens": llm_response.usage.total_tokens,
            },
            "finish_reason": "stop",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {str(e)}")


@router.post("/", response_model=ChatResponse, summary="发送聊天消息", description="与数字分身进行对话")
async def chat(request: ChatRequest):
    """
    ## 功能说明
    
    与指定的数字分身进行对话，支持多种对话模式。
    
    ## 请求示例
    
    ```json
    {
        "slug": "xiaoming",
        "messages": [
            {
                "role": "user",
                "content": "你好！"
            }
        ],
        "mode": "full",
        "stream": false,
        "provider": "deepseek",
        "model": "deepseek-chat",
        "api_key": "sk-..."
    }
    ```
    
    ## 参数说明
    
    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | slug | string | 是 | Skill 的唯一标识符 |
    | messages | array | 是 | 消息历史列表 |
    | mode | string | 否 | 对话模式：full（完整）、memory（仅记忆）、persona（仅人格）、reflection（反思），默认 full |
    | stream | boolean | 否 | 是否流式响应，默认 false |
    | provider | string | 否 | LLM 提供商，默认 deepseek |
    | model | string | 否 | 模型名称，默认 deepseek-chat |
    | api_key | string | 否 | API Key，优先使用此值 |
    
    ## 响应示例
    
    ```json
    {
        "content": "你好！很高兴见到你。",
        "model": "deepseek-chat",
        "usage": {
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150,
            "estimated_cost": 0.0002
        }
    }
    ```
    
    ## 错误码
    
    | 状态码 | 说明 |
    |--------|------|
    | 200 | 对话成功 |
    | 404 | Skill 不存在 |
    | 500 | 服务器内部错误 |
    """
    # 1. 加载对应的 Skill
    skill = skill_writer.load_skill(request.slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{request.slug}' not found")
    
    # 2. 构建系统提示词
    system_prompt = build_system_prompt(skill, request.mode)
    
    # 3. 准备消息列表
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})
    
    # 4. 调用 LLM 生成回复（使用 Mock 模式便于测试）
    try:
        # 优先使用用户提供的 API Key，否则尝试默认
        client = create_llm_client(
            provider=request.provider,
            model=request.model,
            api_key=request.api_key or "demo_key"
        )
        
        llm_response: LLMResponse = client.chat(messages)
        
        return ChatResponse(
            content=llm_response.content,
            model=llm_response.model,
            usage={
                "input_tokens": llm_response.usage.input_tokens,
                "output_tokens": llm_response.usage.output_tokens,
                "total_tokens": llm_response.usage.total_tokens,
                "estimated_cost": llm_response.usage.estimated_cost
            }
        )
        
    except Exception as e:
        # 如果真实 LLM 调用失败，返回 Mock 响应便于测试
        mock_response = f"你好！我是 {skill.metadata.name}。（这是 Mock 响应，因为 LLM 调用失败：{str(e)}）"
        return ChatResponse(
            content=mock_response,
            model="mock",
            usage={
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost": 0.0
            }
        )


@router.post("/{slug}/correction", summary="添加对话修正", description="添加对话修正记录到 Skill 的经验教训")
async def add_correction(slug: str, note: str):
    """
    ## 功能说明
    
    添加对话修正记录，保存到 Skill 的经验教训中，帮助数字分身持续改进。
    
    ## 请求示例
    
    ```
    POST /api/chat/xiaoming/correction?note=刚才的回复应该更温柔一些
    ```
    
    ## 参数说明
    
    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | slug | string | 是 | Skill 的唯一标识符 |
    | note | string | 是 | 修正内容 |
    
    ## 响应示例
    
    ```json
    {
        "success": true,
        "message": "Correction added"
    }
    ```
    
    ## 错误码
    
    | 状态码 | 说明 |
    |--------|------|
    | 200 | 添加成功 |
    | 404 | Skill 不存在 |
    | 500 | 保存失败 |
    """
    # 加载 Skill
    skill = skill_writer.load_skill(slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{slug}' not found")
    
    # 更新 Lessons 内容（简单追加）
    original_lessons = skill.lessons_content or ""
    new_lessons = original_lessons + f"\n\n--- 对话修正 ---\n{note}\n"
    
    # 保存更新
    skill.lessons_content = new_lessons
    success = skill_writer.save_skill(skill)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save correction")
    
    return {"success": True, "message": "Correction added"}

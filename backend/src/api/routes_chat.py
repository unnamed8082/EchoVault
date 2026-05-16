"""
聊天 API 路由
使用 StorageBackend + 安全过滤 + 流式响应
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools"))

from config import settings
from llm.factory import create_llm_client
from llm.base import LLMResponse
from storage.factory import create_storage_backend
from privacy.sanitizer import sanitize_text
from privacy.content_filter import ContentFilter

router = APIRouter(tags=["chat"])

storage = create_storage_backend(
    "filesystem",
    skills_dir=settings.SKILLS_DIR,
    uploads_dir=settings.UPLOADS_DIR,
)

content_filter = ContentFilter()


class ChatMessage(BaseModel):
    role: str = Field(..., description="角色: user, assistant, system")
    content: str = Field(..., description="内容")


class CompletionsRequest(BaseModel):
    provider: str = Field("deepseek", description="LLM 提供商")
    model: str = Field("deepseek-chat", description="模型名称")
    messages: List[ChatMessage] = Field(..., description="消息列表")
    max_tokens: Optional[int] = Field(2048, description="最大生成 token 数")
    temperature: Optional[float] = Field(0.7, description="温度参数")
    stream: Optional[bool] = Field(False, description="是否流式返回")
    api_key: Optional[str] = Field(None, description="API Key（可选）")
    base_url: Optional[str] = Field(None, description="API 基础 URL（可选）")


class SkillChatRequest(BaseModel):
    slug: str = Field(..., description="Skill 的唯一标识符")
    messages: List[ChatMessage] = Field(..., description="消息列表")
    provider: str = Field("deepseek", description="LLM 提供商")
    model: str = Field("deepseek-chat", description="模型名称")
    api_key: Optional[str] = Field(None, description="API Key")
    base_url: Optional[str] = Field(None, description="API 基础 URL")
    stream: Optional[bool] = Field(False, description="是否流式返回")


class CorrectionRequest(BaseModel):
    note: str = Field(..., description="修正内容")


def _build_skill_system_prompt(skill) -> str:
    import json
    parts = []
    if skill.metadata and skill.metadata.name:
        parts.append(f"你现在扮演的是「{skill.metadata.name}」。")
    if skill.persona_content:
        try:
            persona = json.loads(skill.persona_content)
            tags = persona.get("tags", [])
            if tags:
                parts.append(f"人格特质: {', '.join(tags)}")
            values = persona.get("core_values", [])
            if values:
                parts.append(f"核心价值观: {', '.join(values)}")
        except (json.JSONDecodeError, TypeError):
            parts.append(f"人格: {skill.persona_content[:500]}")
    if skill.memory_content:
        try:
            memory = json.loads(skill.memory_content)
            for key, value in memory.items():
                if isinstance(value, str) and len(value) < 500:
                    parts.append(f"记忆-{key}: {value}")
        except (json.JSONDecodeError, TypeError):
            parts.append(f"记忆: {skill.memory_content[:500]}")
    if skill.lessons_content:
        parts.append(f"经验教训:\n{skill.lessons_content[:1000]}")
    return "\n".join(parts) if parts else "你是一个有帮助的AI助手。"


async def _stream_llm_response(client, messages, max_tokens=2048, temperature=0.7):
    async def event_generator():
        async for chunk in client.chat_stream(messages, max_tokens=max_tokens, temperature=temperature):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/completions",
    summary="通用聊天补全",
    description="""
    ## 功能说明

    提供通用的 LLM 聊天补全接口，支持多种 LLM 提供商。适用于直接与 AI 对话的场景。

    ## 请求示例

    ```
    POST /api/chat/completions
    {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "messages": [
            {"role": "user", "content": "你好，请介绍一下自己"}
        ],
        "max_tokens": 2048,
        "temperature": 0.7
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | provider | string | 否 | LLM 提供商，默认 deepseek |
    | model | string | 否 | 模型名称 |
    | messages | array | 是 | 消息列表 |
    | max_tokens | int | 否 | 最大生成 token 数，默认 2048 |
    | temperature | float | 否 | 温度参数，默认 0.7 |
    | api_key | string | 否 | API Key |
    | base_url | string | 否 | API 基础 URL |

    ## 响应示例

    ```json
    {
        "response": "你好！我是你的AI助手...",
        "provider": "deepseek",
        "model": "deepseek-chat"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 成功 |
    | 502 | LLM 服务不可用 |
    | 422 | 参数验证失败 |
    """
)
async def completions(req: CompletionsRequest):
    client = create_llm_client(
        provider=req.provider,
        api_key=req.api_key or "not-needed",
        model=req.model,
        base_url=req.base_url,
    )

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    if req.stream:
        async def event_generator():
            try:
                async for chunk in client.chat_stream(messages, max_tokens=req.max_tokens, temperature=req.temperature):
                    yield f"data: {chunk}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

    try:
        response: LLMResponse = await client.chat(messages, max_tokens=req.max_tokens, temperature=req.temperature)
        return {"response": response.content, "provider": req.provider, "model": req.model}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 服务不可用: {str(e)}")


@router.post("/",
    summary="Skill 聊天",
    description="""
    ## 功能说明

    与指定的数字分身进行对话。系统会自动加载 Skill 配置，构建上下文，并调用相应的 LLM。

    ## 请求示例

    ```
    POST /api/chat/
    {
        "slug": "xiaoming",
        "messages": [
            {"role": "user", "content": "你好，小明！"}
        ],
        "provider": "deepseek",
        "model": "deepseek-chat"
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | slug | string | 是 | Skill 的唯一标识符 |
    | messages | array | 是 | 消息列表 |
    | provider | string | 否 | LLM 提供商 |
    | model | string | 否 | 模型名称 |
    | api_key | string | 否 | API Key |
    | stream | bool | 否 | 是否流式返回，默认 false |

    ## 响应示例

    ```json
    {
        "response": "你好！我是小明，很高兴见到你！",
        "provider": "deepseek",
        "model": "deepseek-chat"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 成功 |
    | 404 | Skill 不存在 |
    | 502 | LLM 服务不可用 |
    | 422 | 参数验证失败 |
    """
)
async def chat(req: SkillChatRequest):
    skill = await storage.load_skill(req.slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{req.slug}' 不存在")

    client = create_llm_client(
        provider=req.provider,
        api_key=req.api_key or "not-needed",
        model=req.model,
        base_url=req.base_url,
    )

    system_prompt = _build_skill_system_prompt(skill)
    llm_messages = [{"role": "system", "content": system_prompt}]
    for m in req.messages:
        filtered = content_filter.check_content(m.content)
        safe_content = filtered["filtered_text"] if not filtered["safe"] else m.content
        sanitized = sanitize_text(safe_content)
        llm_messages.append({"role": m.role, "content": sanitized})

    if req.stream:
        async def event_generator():
            try:
                async for chunk in client.chat_stream(llm_messages):
                    yield f"data: {chunk}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

    try:
        response: LLMResponse = await client.chat(llm_messages)
        return {"response": response.content, "provider": req.provider, "model": req.model}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 服务不可用: {str(e)}")


@router.post("/{slug}/correction",
    summary="添加对话修正",
    description="""
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
)
async def add_correction(slug: str, note: str):
    skill = await storage.load_skill(slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{slug}' not found")

    original_lessons = skill.lessons_content or ""
    skill.lessons_content = original_lessons + f"\n\n--- 对话修正 ---\n{note}\n"

    success = await storage.save_skill(skill)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save correction")

    return {"success": True, "message": "Correction added"}

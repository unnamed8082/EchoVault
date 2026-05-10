from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import List, Dict, Optional, Any, AsyncGenerator
import json
import re

class LLMUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost: float = 0.0

class LLMResponse(BaseModel):
    content: str
    usage: LLMUsage
    model: str
    
    def extract_json(self) -> Optional[Dict[str, Any]]:
        try:
            return json.loads(self.content)
        except json.JSONDecodeError:
            pass
        
        start = self.content.find('{')
        if start == -1:
            return None
        
        brace_count = 1
        end = start + 1
        while end < len(self.content) and brace_count > 0:
            if self.content[end] == '{':
                brace_count += 1
            elif self.content[end] == '}':
                brace_count -= 1
            end += 1
        
        if brace_count == 0:
            json_str = self.content[start:end]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass
        
        return None

class BaseLLMClient(ABC):
    def __init__(self):
        self.total_usage = LLMUsage()
    
    @abstractmethod
    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 2048) -> LLMResponse:
        pass

    @abstractmethod
    async def chat_stream(self, messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 2048) -> AsyncGenerator[str, None]:
        yield ""

    async def distillation_analyze(
        self, 
        chat_summary: str, 
        target_name: str,
        enable_retry: bool = True
    ) -> LLMResponse:
        system_prompt = f"""你是一个专业的人格蒸馏专家。
你的任务是从给定的聊天摘要中分析并生成目标人物「{target_name}」的人格模型。

请按照以下 5 层结构输出严格的 JSON 格式，不要添加任何额外文本：
{{
  "hard_rules": ["绝对不会做/说的事项"],
  "identity": {{"身份": "描述", "职业": "描述", "爱好": "描述"}},
  "speech_style": {{"语速": "描述", "语癖": "描述", "语气": "描述"}},
  "emotion_pattern": {{"表达模式": "描述", "触发点": "描述"}},
  "relationship_behavior": {{"互动方式": "描述", "边界": "描述"}}
}}

输出要求：
1. 只输出 JSON，不要添加 Markdown、说明或其他文本
2. JSON 必须完整且格式正确
3. 如果信息不足，合理推断但不要编造
"""
        
        user_prompt = f"关于「{target_name}」的聊天摘要:\n{chat_summary}\n请根据摘要输出该人物的 5 层人格模型 JSON。"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        response = await self.chat(messages, temperature=0.3, max_tokens=4096)
        
        parsed = response.extract_json()
        
        if parsed is None and enable_retry:
            retry_prompt = f"""之前的输出格式不正确。请严格只输出有效的 JSON，不要任何额外内容。
聊天摘要：
{chat_summary}
"""
            retry_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": retry_prompt}
            ]
            retry_response = await self.chat(retry_messages, temperature=0.2, max_tokens=4096)
            
            response.usage.input_tokens += retry_response.usage.input_tokens
            response.usage.output_tokens += retry_response.usage.output_tokens
            response.usage.total_tokens += retry_response.usage.total_tokens
            response.usage.estimated_cost += retry_response.usage.estimated_cost
            
            response.content = retry_response.content
        
        self.total_usage.input_tokens += response.usage.input_tokens
        self.total_usage.output_tokens += response.usage.output_tokens
        self.total_usage.total_tokens += response.usage.total_tokens
        self.total_usage.estimated_cost += response.usage.estimated_cost
        
        return response

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass
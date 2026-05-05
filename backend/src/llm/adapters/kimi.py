import os
from openai import OpenAI
from ..base import BaseLLMClient, LLMResponse, LLMUsage

class KimiClient(BaseLLMClient):
    def __init__(self, api_key: str, model: str = "moonshot-v1-8k", base_url: str = None):
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url or os.getenv("KIMI_BASE_URL", "https://api.moonshot.cn/v1")
        )
        self._model = model

    @property
    def model_name(self) -> str:
        return self._model

    def chat(self, messages, temperature=0.7, max_tokens=2048):
        resp = self.client.chat.completions.create(
            model=self._model, messages=messages,
            temperature=temperature, max_tokens=max_tokens
        )
        usage = LLMUsage(
            input_tokens=resp.usage.prompt_tokens,
            output_tokens=resp.usage.completion_tokens,
            total_tokens=resp.usage.total_tokens
        )
        return LLMResponse(content=resp.choices[0].message.content, usage=usage, model=self._model)

    def distillation_analyze(self, chat_summary, target_name):
        system = """你是一个人格蒸馏专家...（输出严格JSON）"""
        user = f"关于「{target_name}」的聊天摘要:\n{chat_summary}\n请输出5层人格模型的JSON。"
        return self.chat(
            messages=[{"role":"system","content":system}, {"role":"user","content":user}],
            temperature=0.3, max_tokens=4096
        )
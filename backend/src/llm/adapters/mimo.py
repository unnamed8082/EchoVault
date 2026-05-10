from openai import AsyncOpenAI
from typing import AsyncGenerator
from ..base import BaseLLMClient, LLMResponse, LLMUsage
from ..cost import estimate_cost

class MiMoClient(BaseLLMClient):
    def __init__(self, api_key: str, model: str = "mimo-v2.5", base_url: str = None):
        super().__init__()
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or "https://token-plan-cn.xiaomimimo.com/v1"
        )
        self._model = model

    @property
    def model_name(self): return self._model

    async def chat(self, messages, temperature=0.7, max_tokens=2048):
        resp = await self.client.chat.completions.create(
            model=self._model, messages=messages,
            temperature=temperature, max_tokens=max_tokens
        )
        usage = LLMUsage(
            input_tokens=resp.usage.prompt_tokens if resp.usage else 0,
            output_tokens=resp.usage.completion_tokens if resp.usage else 0,
            total_tokens=resp.usage.total_tokens if resp.usage else 0,
            estimated_cost=estimate_cost(
                self._model,
                resp.usage.prompt_tokens if resp.usage else 0,
                resp.usage.completion_tokens if resp.usage else 0
            )
        )
        return LLMResponse(content=resp.choices[0].message.content, usage=usage, model=self._model)

    async def chat_stream(self, messages, temperature=0.7, max_tokens=2048):
        response = await self.client.chat.completions.create(
            model=self._model, messages=messages,
            temperature=temperature, max_tokens=max_tokens,
            stream=True
        )
        async for chunk in response:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content

    async def distillation_analyze(self, chat_summary, target_name, enable_retry=True):
        return await super().distillation_analyze(chat_summary, target_name, enable_retry)
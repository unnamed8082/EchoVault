from openai import OpenAI
from ..base import BaseLLMClient, LLMResponse, LLMUsage

class MiMoClient(BaseLLMClient):
    def __init__(self, api_key: str, model: str = "mimo-v2.5", base_url: str = None):
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url or "https://token-plan-cn.xiaomimimo.com/v1"
        )
        self._model = model

    @property
    def model_name(self): return self._model

    def chat(self, messages, temperature=0.7, max_tokens=2048):
        resp = self.client.chat.completions.create(
            model=self._model, messages=messages,
            temperature=temperature, max_tokens=max_tokens
        )
        usage = LLMUsage(...)
        return LLMResponse(content=resp.choices[0].message.content, usage=usage, model=self._model)

    def distillation_analyze(self, chat_summary, target_name):
        # 使用 Pro 模型
        ...
        return self.chat(..., model="mimo-v2.5-pro", temperature=0.3, max_tokens=4096)